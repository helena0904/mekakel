import { Prisma } from '@prisma/client'

import prisma from '../lib/prisma'
import type {
  BloodRequestStatusValue,
  CreateBloodRequestInput,
  ListBloodRequestsQuery,
} from '../validators/blood-request.schema'

export interface SerializableBloodRequest {
  id: number
  hospitalProfileId: number
  createdByUserId: number
  component: string
  bloodType: string
  requiredUnits: number
  urgency: string
  location: string | null
  notes: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

function buildWhere(
  hospitalProfileId: number,
  filters: ListBloodRequestsQuery
): Prisma.BloodRequestWhereInput {
  const where: Prisma.BloodRequestWhereInput = {
    hospitalProfileId,
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.bloodType) {
    where.bloodType = filters.bloodType
  }

  if (filters.component) {
    where.component = filters.component
  }

  if (filters.urgency) {
    where.urgency = filters.urgency
  }

  return where
}

export function listRequests(
  hospitalProfileId: number,
  filters: ListBloodRequestsQuery
) {
  return prisma.bloodRequest.findMany({
    where: buildWhere(hospitalProfileId, filters),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
}

export function findRequest(
  hospitalProfileId: number,
  requestId: number
) {
  return prisma.bloodRequest.findFirst({
    where: { id: requestId, hospitalProfileId },
  })
}

export function createRequest(
  hospitalProfileId: number,
  userId: number,
  data: CreateBloodRequestInput
) {
  return prisma.bloodRequest.create({
    data: {
      hospitalProfileId,
      createdByUserId: userId,
      component: data.component,
      bloodType: data.bloodType,
      requiredUnits: data.requiredUnits,
      urgency: data.urgency ?? 'ROUTINE',
      location: data.location || null,
      notes: data.notes || null,
      status: 'OPEN',
    },
  })
}

export function updateRequestStatus(
  requestId: number,
  status: BloodRequestStatusValue
) {
  return prisma.bloodRequest.update({
    where: { id: requestId },
    data: { status },
  })
}

export function deleteRequest(requestId: number) {
  return prisma.bloodRequest.delete({
    where: { id: requestId },
  })
}
