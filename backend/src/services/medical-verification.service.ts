import prisma from '../lib/prisma'
import { computeEligibility } from './eligibility.service'
import { getEligibilityConfig } from './settings.service'
import { notifyUser } from './notification.service'
import {
  recordAudit,
  type AuditActor,
  type AuditActionValue,
} from './audit.service'
import type {
  DonorReviewDecision,
  ReviewDonorVerificationInput,
} from '../validators/donor.schema'
import type { NotificationTypeValue } from '../validators/notification.schema'

export type VerificationQueueStatus =
  | 'PENDING'
  | 'ADDITIONAL_INFO_REQUIRED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'ALL'

export const VERIFICATION_QUEUE_STATUSES: VerificationQueueStatus[] =
  [
    'PENDING',
    'ADDITIONAL_INFO_REQUIRED',
    'VERIFIED',
    'REJECTED',
    'ALL',
  ]

export interface ListVerificationQueueQuery {
  status?: VerificationQueueStatus
  limit?: number
}

export const DONOR_DECISION_STATUS: Record<
  DonorReviewDecision,
  'VERIFIED' | 'REJECTED' | 'ADDITIONAL_INFO_REQUIRED'
> = {
  VERIFY: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_INFO: 'ADDITIONAL_INFO_REQUIRED',
}

export const DONOR_DECISION_NOTIFICATION: Record<
  DonorReviewDecision,
  NotificationTypeValue
> = {
  VERIFY: 'DONOR_VERIFICATION_APPROVED',
  REJECT: 'DONOR_VERIFICATION_REJECTED',
  REQUEST_INFO: 'DONOR_ADDITIONAL_INFO_REQUIRED',
}

const MEDICAL_REPORT_STATUS: Record<
  DonorReviewDecision,
  'VERIFIED' | 'REJECTED' | 'PENDING'
> = {
  VERIFY: 'VERIFIED',
  REJECT: 'REJECTED',
  REQUEST_INFO: 'PENDING',
}

const donorUserSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
} as const

const queueInclude = {
  user: { select: donorUserSelect },
  medicalReports: { orderBy: { createdAt: 'desc' as const } },
}

const reviewAssignmentInclude = {
  doctor: {
    select: { id: true, name: true, email: true, isActive: true },
  },
  assignedBy: {
    select: { id: true, name: true },
  },
} as const

const MAX_QUEUE_LIMIT = 200

export function listVerificationQueue(
  doctorUserId: number,
  query: ListVerificationQueueQuery = {},
) {
  const status = query.status ?? 'PENDING'
  const limit = Math.min(
    Math.max(query.limit ?? 100, 1),
    MAX_QUEUE_LIMIT,
  )

  return prisma.donorProfile.findMany({
    where: {
      reviewAssignment: { doctorUserId },
      ...(status === 'ALL'
        ? {}
        : { verificationStatus: status }),
    },
    orderBy:
      status === 'PENDING'
        ? { createdAt: 'asc' }
        : { createdAt: 'desc' },
    take: limit,
    include: queueInclude,
  })
}

export function listDonorRegistrations(
  query: ListVerificationQueueQuery = {},
) {
  const status = query.status ?? 'ALL'
  const limit = Math.min(
    Math.max(query.limit ?? 100, 1),
    MAX_QUEUE_LIMIT,
  )

  return prisma.donorProfile.findMany({
    where:
      status === 'ALL'
        ? undefined
        : { verificationStatus: status },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      ...queueInclude,
      reviewAssignment: {
        include: reviewAssignmentInclude,
      },
    },
  })
}

export function findDonorForReview(
  donorProfileId: number,
  doctorUserId?: number,
) {
  return prisma.donorProfile.findFirst({
    where: {
      id: donorProfileId,
      ...(doctorUserId === undefined
        ? {}
        : { reviewAssignment: { doctorUserId } }),
    },
    include: {
      user: { select: donorUserSelect },
      medicalReports: {
        orderBy: { createdAt: 'desc' as const },
      },
      donationHistory: {
        orderBy: { donatedAt: 'desc' as const },
      },
      availabilities: { orderBy: { id: 'asc' as const } },
    },
  })
}

export async function getVerificationDetail(
  doctorUserId: number,
  donorProfileId: number,
) {
  const donor = await findDonorForReview(
    donorProfileId,
    doctorUserId,
  )

  if (!donor) {
    return null
  }

  const config = await getEligibilityConfig()

  const eligibility = computeEligibility(
    donor,
    donor.donationHistory.map((record) => record.donatedAt),
    new Date(),
    config,
  )

  return {
    donor,
    eligibility,
    latestReport: donor.medicalReports[0] ?? null,
  }
}

export async function decideDonorVerification(
  donorProfileId: number,
  data: ReviewDonorVerificationInput,
  actor: AuditActor = {},
  doctorUserId?: number,
) {
  const existing = await prisma.donorProfile.findFirst({
    where: {
      id: donorProfileId,
      ...(doctorUserId === undefined
        ? {}
        : { reviewAssignment: { doctorUserId } }),
    },
    select: { id: true },
  })

  if (!existing) {
    return null
  }

  const status = DONOR_DECISION_STATUS[data.decision]

  const donor = await prisma.$transaction(async (tx) => {
    const updated = await tx.donorProfile.update({
      where: { id: donorProfileId },
      data: {
        verificationStatus: status,
        verificationNotes: data.notes || null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
      include: {
        user: { select: donorUserSelect },
        medicalReports: {
          orderBy: { createdAt: 'desc' as const },
        },
      },
    })

    await tx.medicalReport.updateMany({
      where: { donorProfileId },
      data: {
        verificationStatus: MEDICAL_REPORT_STATUS[data.decision],
        verifiedAt:
          data.decision === 'VERIFY' ? new Date() : null,
        rejectionReason:
          data.decision === 'REJECT'
            ? data.notes || null
            : null,
      },
    })

    const action: AuditActionValue =
      'DONOR_VERIFICATION_DECIDED'

    await recordAudit(
      {
        ...actor,
        action,
        entityType: 'DonorProfile',
        entityId: donorProfileId,
        summary: `Donor verification set to ${status}`,
        metadata: {
          decision: data.decision,
          status,
          notes: data.notes ?? null,
        },
      },
      tx,
    )

    return updated
  })

  try {
    await notifyUser(
      donor.userId,
      DONOR_DECISION_NOTIFICATION[data.decision],
      {
        recipientName: donor.user.name,
        notes: data.notes ?? undefined,
        reason: data.notes ?? undefined,
      },
      {
        relatedEntityType: 'DonorProfile',
        relatedEntityId: donor.id,
        dedupeKey: `donor:${donor.id}:review:${data.decision}:${donor.verifiedAt?.getTime() ?? Date.now()}`,
      },
    )
  } catch (notificationError) {
    console.error(
      '[medical-verification] review notification failed',
      notificationError,
    )
  }

  return donor
}

export function findReportForReview(
  reportId: number,
  doctorUserId: number,
) {
  return prisma.medicalReport.findFirst({
    where: {
      id: reportId,
      donorProfile: {
        reviewAssignment: { doctorUserId },
      },
    },
    select: {
      id: true,
      fileUrl: true,
      reportType: true,
      verificationStatus: true,
      createdAt: true,
      donorProfile: {
        select: {
          id: true,
          bloodType: true,
          verificationStatus: true,
          user: { select: donorUserSelect },
        },
      },
    },
  })
}
