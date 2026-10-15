interface FaydaVerificationResult {
  verified: boolean
  message: string
  identity?: {
    fullName: string
    dateOfBirth: string
  }
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

  return {
    verified: true,
    message: 'Mock identity verification successful.',
    identity: {
      fullName: trimmedName,
      dateOfBirth: trimmedDate,
    },
  }
}
