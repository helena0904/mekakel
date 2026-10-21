import bcrypt from 'bcrypt'

import prisma from '../src/lib/prisma'

const PASSWORD = 'Password1!'

const accounts = [
  {
    email: 'admin@mekakel.test',
    name: 'MEKAKEL Administrator',
    role: 'ADMIN',
  },
  {
    email: 'doctor@mekakel.test',
    name: 'MEKAKEL Clinical Reviewer',
    role: 'DOCTOR',
  },
] as const

async function seedAccount(account: (typeof accounts)[number]) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const existing = await prisma.user.findUnique({
    where: { email: account.email },
    select: { id: true },
  })

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name: account.name,
        role: account.role,
        accountType: 'INDIVIDUAL',
        isActive: true,
        passwordHash,
        passwordVersion: { increment: 1 },
      },
    })
  } else {
    await prisma.user.create({
      data: {
        email: account.email,
        name: account.name,
        role: account.role,
        accountType: 'INDIVIDUAL',
        isActive: true,
        passwordHash,
      },
    })
  }

  console.log(`  ${account.role}: ${account.email}`)
}

async function main() {
  console.log('Seeding demo staff accounts...')

  for (const account of accounts) {
    await seedAccount(account)
  }

  console.log(`\nPassword for both accounts: ${PASSWORD}`)
}

main()
  .catch((error) => {
    console.error('Failed to seed demo staff accounts:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
