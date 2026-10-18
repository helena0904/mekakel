export interface MockFaydaIdentity {
  faydaId: string
  fullName: string
  dateOfBirth: string
}

interface FaydaVerificationResult {
  verified: boolean
  message: string
  identity?: {
    fullName: string
    dateOfBirth: string
  }
}

/**
 * Fixed test identities used by the simulated Fayda check.
 *
 * The mock only succeeds when the submitted Fayda ID, full name and date of
 * birth all match one of these records. It performs no call to the real Fayda
 * registry.
 */
export const MOCK_FAYDA_IDENTITIES: readonly MockFaydaIdentity[] = [
  {
    faydaId: '9999000000000001',
    fullName: 'Abebe Kebede',
    dateOfBirth: '2000-05-15',
  },
  {
    faydaId: '9999000000000002',
    fullName: 'Hana Tesfaye',
    dateOfBirth: '1998-09-20',
  },
  {
    faydaId: '9999000000000003',
    fullName: 'Mekdes Alemu',
    dateOfBirth: '2002-04-11',
  },
  {
    faydaId: '9999000000000004',
    fullName: 'Dawit Bekele',
    dateOfBirth: '1995-12-03',
  },
  {
    faydaId: '9999000000000005',
    fullName: 'Tigist Haile',
    dateOfBirth: '1996-03-08',
  },
  {
    faydaId: '9999000000000006',
    fullName: 'Yonas Gebre',
    dateOfBirth: '1993-07-19',
  },
  {
    faydaId: '9999000000000007',
    fullName: 'Sara Mohammed',
    dateOfBirth: '2001-01-27',
  },
  {
    faydaId: '9999000000000008',
    fullName: 'Bemnet Assefa',
    dateOfBirth: '1999-11-05',
  },
  {
    faydaId: '9999000000000009',
    fullName: 'Rahel Girma',
    dateOfBirth: '1997-06-14',
  },
  {
    faydaId: '9999000000000010',
    fullName: 'Abel Tadesse',
    dateOfBirth: '2000-09-30',
  },
  {
    faydaId: '9999000000000011',
    fullName: 'Meron Desta',
    dateOfBirth: '1994-02-22',
  },
  {
    faydaId: '9999000000000012',
    fullName: 'Kalkidan Wolde',
    dateOfBirth: '2003-08-17',
  },
  {
    faydaId: '9999000000000013',
    fullName: 'Natnael Solomon',
    dateOfBirth: '1992-04-09',
  },
  {
    faydaId: '9999000000000014',
    fullName: 'Eden Fikru',
    dateOfBirth: '2005-05-21',
  },
  {
    faydaId: '9999000000000015',
    fullName: 'Samrawit Tesfaye',
    dateOfBirth: '1998-12-11',
  },
  {
    faydaId: '9999000000000016',
    fullName: 'Yohannes Kibret',
    dateOfBirth: '1991-10-02',
  },
  {
    faydaId: '9999000000000017',
    fullName: 'Helen Tesfaye',
    dateOfBirth: '2005-12-24',
  },
]

function normalizeName(name: string): string {
  return name
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

export function verifyMockFayda(
  faydaId: string,
  fullName: string,
  dateOfBirth: string,
): FaydaVerificationResult {
  const trimmedId = faydaId.trim()
  const trimmedName = fullName.trim()
  const trimmedDate = dateOfBirth.trim()

  if (!/^\d{16}$/.test(trimmedId)) {
    return {
      verified: false,
      message: 'Fayda ID must contain exactly 16 digits.',
    }
  }

  if (!trimmedName) {
    return {
      verified: false,
      message: 'Please provide your full name.',
    }
  }

  if (!trimmedDate || Number.isNaN(Date.parse(trimmedDate))) {
    return {
      verified: false,
      message: 'Please provide a valid date of birth.',
    }
  }

  const identity = MOCK_FAYDA_IDENTITIES.find(
    (record) => record.faydaId === trimmedId,
  )

  if (
    !identity ||
    normalizeName(identity.fullName) !== normalizeName(trimmedName) ||
    identity.dateOfBirth !== trimmedDate
  ) {
    return {
      verified: false,
      message:
        'Mock verification failed. The provided details do not match a test record.',
    }
  }

  return {
    verified: true,
    message: 'Mock identity verification successful.',
    identity: {
      fullName: identity.fullName,
      dateOfBirth: identity.dateOfBirth,
    },
  }
}
export { verifyMockFayda as verifyFayda }
