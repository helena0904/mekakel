import bcrypt from 'bcrypt'

import prisma from '../../src/lib/prisma'

let sequence = 0

export const TEST_PASSWORD = 'Password1!'

export function uniqueEmail(prefix = 'user'): string {
  sequence += 1
  return `${prefix}.${Date.now()}.${sequence}@example.test`
}

export function uniqueFaydaId(): string {
  sequence += 1
  return `9${String(sequence).padStart(15, '0')}`
}

export function uniqueIp(): string {
  sequence += 1
  const a = Math.floor(sequence / 65536) % 256
  const b = Math.floor(sequence / 256) % 256
  const c = sequence % 256
  return `10.${a}.${b}.${c}`
}

export interface MockFaydaRecord {
  faydaId: string
  fullName: string
  dateOfBirth: string
}

// Must stay in sync with src/services/fayda.service.ts.
export const MOCK_FAYDA: readonly MockFaydaRecord[] = [
  { faydaId: '9999000000000001', fullName: 'Abebe Kebede', dateOfBirth: '2000-05-15' },
  { faydaId: '9999000000000002', fullName: 'Hana Tesfaye', dateOfBirth: '1998-09-20' },
  { faydaId: '9999000000000003', fullName: 'Mekdes Alemu', dateOfBirth: '2002-04-11' },
  { faydaId: '9999000000000004', fullName: 'Dawit Bekele', dateOfBirth: '1995-12-03' },
  { faydaId: '9999000000000005', fullName: 'Tigist Haile', dateOfBirth: '1996-03-08' },
  { faydaId: '9999000000000006', fullName: 'Yonas Gebre', dateOfBirth: '1993-07-19' },
  { faydaId: '9999000000000007', fullName: 'Sara Mohammed', dateOfBirth: '2001-01-27' },
  { faydaId: '9999000000000008', fullName: 'Bemnet Assefa', dateOfBirth: '1999-11-05' },
  { faydaId: '9999000000000009', fullName: 'Rahel Girma', dateOfBirth: '1997-06-14' },
  { faydaId: '9999000000000010', fullName: 'Abel Tadesse', dateOfBirth: '2000-09-30' },
  { faydaId: '9999000000000011', fullName: 'Meron Desta', dateOfBirth: '1994-02-22' },
  { faydaId: '9999000000000012', fullName: 'Kalkidan Wolde', dateOfBirth: '2003-08-17' },
  { faydaId: '9999000000000013', fullName: 'Natnael Solomon', dateOfBirth: '1992-04-09' },
  { faydaId: '9999000000000014', fullName: 'Eden Fikru', dateOfBirth: '2005-05-21' },
  { faydaId: '9999000000000015', fullName: 'Samrawit Tesfaye', dateOfBirth: '1998-12-11' },
  { faydaId: '9999000000000016', fullName: 'Yohannes Kibret', dateOfBirth: '1991-10-02' },
  { faydaId: '9999000000000017', fullName: 'Helen Tesfaye', dateOfBirth: '2005-12-24' },
]

export function ageFromDob(dateOfBirth: string): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number)
  const today = new Date()

  let age = today.getUTCFullYear() - year
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day)

  if (beforeBirthday) {
    age -= 1
  }

  return age
}

export function dobAndAge(): { dateOfBirth: string; age: number } {
  const today = new Date()
  const year = today.getUTCFullYear() - 25
  const dateOfBirth = `${year}-06-15`

  let age = today.getUTCFullYear() - year
  const beforeBirthday =
    today.getUTCMonth() + 1 < 6 ||
    (today.getUTCMonth() + 1 === 6 && today.getUTCDate() < 15)

  if (beforeBirthday) {
    age -= 1
  }

  return { dateOfBirth, age }
}

interface CreateUserOptions {
  email?: string
  password?: string
  name?: string
  role?: string
  isActive?: boolean
  accountType?: 'INDIVIDUAL' | 'HOSPITAL'
  createHospital?: boolean
  hospitalVerified?: boolean
  hospitalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
  passwordVersion?: number
}

export async function createUser(options: CreateUserOptions = {}) {
  const password = options.password ?? TEST_PASSWORD
  const passwordHash = await bcrypt.hash(password, 4)
  const accountType = options.accountType ?? 'INDIVIDUAL'
  const role =
    options.role ??
    (accountType === 'HOSPITAL' ? 'HOSPITAL_STAFF' : 'DONOR')
  const hospitalVerified = options.hospitalVerified ?? false
  const hospitalStatus =
    options.hospitalStatus ??
    (hospitalVerified ? 'APPROVED' : 'PENDING')
  const shouldCreateHospital =
    accountType === 'HOSPITAL' &&
    options.createHospital !== false

  const user = await prisma.user.create({
    data: {
      email: options.email ?? uniqueEmail(),
      passwordHash,
      name: options.name ?? 'Test User',
      accountType,
      role,
      isActive: options.isActive ?? true,
      passwordVersion: options.passwordVersion ?? 0,
      ...(shouldCreateHospital
        ? {
            hospitalProfile: {
              create: {
                hospitalName: 'Test Hospital',
                address: 'Test Address',
                phone: '+251900000000',
                isVerified: hospitalVerified,
                status: hospitalStatus,
              },
            },
          }
        : {}),
    },
    include: {
      hospitalProfile: true,
      donorProfile: true,
    },
  })

  return { user, password }
}

export async function createStaffMember(
  hospitalProfileId: number,
  options: {
    staffRole?:
      | 'OWNER'
      | 'ADMIN'
      | 'MANAGER'
      | 'TECHNICIAN'
      | 'VIEWER'
    isActive?: boolean
    accountActive?: boolean
    email?: string
  } = {}
) {
  const created = await createUser({
    accountType: 'HOSPITAL',
    email: options.email,
    isActive: options.accountActive ?? true,
    createHospital: false,
  })

  const member = await prisma.hospitalStaffMember.create({
    data: {
      hospitalProfileId,
      userId: created.user.id,
      staffRole: options.staffRole ?? 'VIEWER',
      isActive: options.isActive ?? true,
    },
  })

  return { user: created.user, password: created.password, member }
}

export async function createDonorProfile(
  userId: number,
  faydaId = uniqueFaydaId()
) {
  const { dateOfBirth } = dobAndAge()

  return prisma.donorProfile.create({
    data: {
      userId,
      faydaId,
      dateOfBirth: new Date(dateOfBirth),
      phone: '+251900000000',
      address: 'Test Address',
      age: 25,
      weight: 70,
      height: 175,
    },
  })
}
