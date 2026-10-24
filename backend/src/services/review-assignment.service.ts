import prisma from '../lib/prisma'
import { AppError } from '../lib/errors'
import {
  recordAudit,
  type AuditActor,
} from './audit.service'

const doctorSelect = {
  id: true,
  name: true,
  email: true,
  isActive: true,
} as const

export function listActiveDoctors() {
  return prisma.user.findMany({
    where: {
      role: 'DOCTOR',
      isActive: true,
    },
    orderBy: { name: 'asc' },
    select: doctorSelect,
  })
}

export async function assignDonorReview(
  donorProfileId: number,
  doctorUserId: number,
  actor: AuditActor = {},
) {
  return prisma.$transaction(async (tx) => {
    const donor = await tx.donorProfile.findUnique({
      where: { id: donorProfileId },
      select: { id: true },
    })

    if (!donor) {
      throw new AppError('Donor not found', 404)
    }

    const doctor = await tx.user.findFirst({
      where: {
        id: doctorUserId,
        role: 'DOCTOR',
        isActive: true,
      },
      select: doctorSelect,
    })

    if (!doctor) {
      throw new AppError(
        'An active doctor account is required for review assignment',
        400,
      )
    }

    const previous = await tx.doctorReviewAssignment.findUnique({
      where: { donorProfileId },
      select: { doctorUserId: true },
    })

    const assignment = await tx.doctorReviewAssignment.upsert({
      where: { donorProfileId },
      create: {
        donorProfileId,
        doctorUserId,
        assignedByUserId: actor.userId ?? null,
      },
      update: {
        doctorUserId,
        assignedByUserId: actor.userId ?? null,
        assignedAt: new Date(),
      },
      include: {
        doctor: { select: doctorSelect },
        assignedBy: {
          select: { id: true, name: true },
        },
      },
    })

    await recordAudit(
      {
        ...actor,
        action: 'DOCTOR_REVIEW_ASSIGNED',
        entityType: 'DonorProfile',
        entityId: donorProfileId,
        summary: `Donor review assigned to ${doctor.name}`,
        metadata: {
          doctorUserId,
          previousDoctorUserId:
            previous?.doctorUserId ?? null,
        },
      },
      tx,
    )

    return assignment
  })
}
