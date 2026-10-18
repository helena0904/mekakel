import jwt from 'jsonwebtoken'
import { randomUUID } from 'node:crypto'

import prisma from '../../src/lib/prisma'
import { createDonorProfile, createUser } from './factories'

export const DAY = 24 * 60 * 60 * 1000

export interface TokenUser {
  id: number
  role: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

export function tokenFor(
  user: TokenUser,
  passwordVersion = 0
): string {
  return jwt.sign(
    {
      userId: user.id,
      role: user.role,
      accountType: user.accountType,
      passwordVersion,
    },
    process.env.JWT_SECRET!,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      jwtid: randomUUID(),
    }
  )
}

export function auth(token: string): string {
  return `Bearer ${token}`
}

export async function approvedHospital() {
  const { user } = await createUser({
    accountType: 'HOSPITAL',
    hospitalVerified: true,
  })

  return {
    user,
    token: tokenFor(user),
    hospitalProfileId: user.hospitalProfile!.id,
  }
}

export async function adminUser() {
  const { user } = await createUser({ role: 'ADMIN' })

  return { user, token: tokenFor(user) }
}

export async function doctorUser() {
  const { user } = await createUser({ role: 'DOCTOR' })

  return { user, token: tokenFor(user) }
}

export function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY)
    .toISOString()
    .slice(0, 10)
}

export interface UnitOverrides {
  bagId?: string
  bloodType?: string
  component?: string
  collectionDate?: Date
  expiryDate?: Date
  screeningStatus?: string
  confirmationStatus?: string
  status?: string
  storageLocation?: string
}

export async function addUnit(
  hospitalProfileId: number,
  overrides: UnitOverrides = {}
) {
  return prisma.bloodUnit.create({
    data: {
      hospitalProfileId,
      bagId: overrides.bagId ?? `BAG-${randomUUID().slice(0, 8)}`,
      bloodType: (overrides.bloodType ?? 'O_NEGATIVE') as never,
      component: (overrides.component ?? 'RED_CELLS') as never,
      collectionDate:
        overrides.collectionDate ?? new Date(Date.now() - 5 * DAY),
      expiryDate:
        overrides.expiryDate ?? new Date(Date.now() + 30 * DAY),
      screeningStatus: (overrides.screeningStatus ??
        'PASSED') as never,
      confirmationStatus: (overrides.confirmationStatus ??
        'CONFIRMED') as never,
      status: (overrides.status ?? 'AVAILABLE') as never,
      storageLocation: overrides.storageLocation ?? 'Fridge A',
    },
  })
}

export interface DonorOverrides {
  bloodType?: string
  verificationStatus?: string
  currentAvailability?: string
  consentToContact?: boolean
  shareLocation?: boolean
  address?: string
  lastDonation?: Date | null
  weight?: number
  dateOfBirth?: Date
  donationIntervalDays?: number
  userActive?: boolean
}

export async function addDonor(overrides: DonorOverrides = {}) {
  const { user } = await createUser({
    accountType: 'INDIVIDUAL',
    isActive: overrides.userActive ?? true,
  })

  const profile = await createDonorProfile(user.id)

  return prisma.donorProfile.update({
    where: { id: profile.id },
    data: {
      bloodType: (overrides.bloodType ?? 'O_NEGATIVE') as never,
      verificationStatus: (overrides.verificationStatus ??
        'VERIFIED') as never,
      currentAvailability: (overrides.currentAvailability ??
        'AVAILABLE') as never,
      consentToContact: overrides.consentToContact ?? true,
      shareLocation: overrides.shareLocation ?? true,
      address: overrides.address ?? 'Addis Ababa, Bole',
      lastDonation: overrides.lastDonation ?? null,
      weight: overrides.weight ?? 70,
      dateOfBirth:
        overrides.dateOfBirth ??
        new Date(`${new Date().getUTCFullYear() - 25}-06-15`),
      donationIntervalDays: overrides.donationIntervalDays ?? 90,
    },
  })
}

export interface RequestOverrides {
  component?: string
  bloodType?: string
  requiredUnits?: number
  urgency?: string
  location?: string
}

export function requestBody(
  overrides: RequestOverrides = {}
): Record<string, unknown> {
  return {
    component: 'RED_CELLS',
    bloodType: 'O_NEGATIVE',
    requiredUnits: 2,
    urgency: 'ROUTINE',
    location: 'Addis Ababa',
    ...overrides,
  }
}
