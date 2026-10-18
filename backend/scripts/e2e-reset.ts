/**
 * Resets and seeds the database used by the frontend Playwright end-to-end
 * suite, then seeds deterministic accounts so the specs never depend on
 * Mock Fayda registration limits (only four identities exist and each may
 * be registered once).
 *
 * Usage (from backend/):
 *   DATABASE_URL=postgresql://.../mekakel_e2e tsx scripts/e2e-reset.ts
 *
 * The DATABASE_URL in the environment always wins over backend/.env because
 * dotenv does not override pre-existing variables.
 */
import bcrypt from 'bcrypt'

import prisma from '../src/lib/prisma'

const PASSWORD = 'Password1!'

async function reset(): Promise<void> {
  await prisma.$transaction([
    prisma.revokedToken.deleteMany(),
    prisma.rateLimitCounter.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.systemSetting.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.medicalReport.deleteMany(),
    prisma.donorAvailabilitySchedule.deleteMany(),
    prisma.donationRecord.deleteMany(),
    prisma.transferEvent.deleteMany(),
    prisma.transfer.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.bloodUnit.deleteMany(),
    prisma.bloodRequest.deleteMany(),
    prisma.hospitalStaffMember.deleteMany(),
    prisma.donorProfile.deleteMany(),
    prisma.hospitalProfile.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

async function seed(): Promise<void> {
  const passwordHash = await bcrypt.hash(PASSWORD, 4)
  const day = 24 * 60 * 60 * 1000
  const today = new Date()

  await prisma.user.create({
    data: {
      email: 'admin@e2e.test',
      passwordHash,
      name: 'E2E Administrator',
      accountType: 'INDIVIDUAL',
      role: 'ADMIN',
      isActive: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'doctor@e2e.test',
      passwordHash,
      name: 'E2E Doctor',
      accountType: 'INDIVIDUAL',
      role: 'DOCTOR',
      isActive: true,
    },
  })

  await prisma.user.create({
    data: {
      email: 'donor@e2e.test',
      passwordHash,
      name: 'E2E Donor',
      accountType: 'INDIVIDUAL',
      role: 'DONOR',
      isActive: true,
      donorProfile: {
        create: {
          faydaId: '9999000000000001',
          dateOfBirth: new Date('2000-05-15'),
          phone: '+251900000010',
          address: 'Addis Ababa, Bole',
          age: 25,
          weight: 70,
          height: 175,
          bloodType: 'O_NEGATIVE',
          currentAvailability: 'AVAILABLE',
          verificationStatus: 'VERIFIED',
          verifiedAt: today,
          consentToContact: true,
          shareLocation: true,
        },
      },
    },
  })

  const hospital = await prisma.user.create({
    data: {
      email: 'hospital@e2e.test',
      passwordHash,
      name: 'E2E Hospital Owner',
      accountType: 'HOSPITAL',
      role: 'HOSPITAL_STAFF',
      isActive: true,
      hospitalProfile: {
        create: {
          hospitalName: 'E2E General Hospital',
          address: 'Addis Ababa, Kirkos',
          phone: '+251900000011',
          isVerified: true,
          status: 'APPROVED',
          reviewedAt: today,
        },
      },
    },
    include: { hospitalProfile: true },
  })

  await prisma.hospitalStaffMember.create({
    data: {
      hospitalProfileId: hospital.hospitalProfile!.id,
      userId: hospital.id,
      staffRole: 'OWNER',
      isActive: true,
    },
  })

  await prisma.bloodUnit.create({
    data: {
      hospitalProfileId: hospital.hospitalProfile!.id,
      bagId: 'E2E-BAG-001',
      bloodType: 'O_NEGATIVE',
      component: 'RED_CELLS',
      collectionDate: new Date(today.getTime() - 5 * day),
      expiryDate: new Date(today.getTime() + 30 * day),
      screeningStatus: 'PASSED',
      confirmationStatus: 'CONFIRMED',
      status: 'AVAILABLE',
      storageLocation: 'Fridge A',
    },
  })
}

async function main(): Promise<void> {
  await reset()
  await seed()
  console.log(
    '[e2e-reset] database reset and seeded with deterministic accounts'
  )
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('[e2e-reset] failed', error)
  await prisma.$disconnect()
  process.exit(1)
})
