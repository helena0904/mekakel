import prisma from '../../src/lib/prisma'

export { prisma }

export async function resetDatabase(): Promise<void> {
  await prisma.$transaction([
    prisma.revokedToken.deleteMany(),
    prisma.rateLimitCounter.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.medicalReport.deleteMany(),
    prisma.donorAvailabilitySchedule.deleteMany(),
    prisma.donationRecord.deleteMany(),
    prisma.bloodUnit.deleteMany(),
    prisma.hospitalStaffMember.deleteMany(),
    prisma.donorProfile.deleteMany(),
    prisma.hospitalProfile.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
