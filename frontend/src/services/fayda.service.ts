import apiRequest from './api'

export interface FaydaVerificationInput {
  faydaId: string
  fullName: string
  dateOfBirth: string
}

export interface FaydaVerificationResult {
  success: boolean
  simulated: boolean
  message: string
  identity: {
    fullName: string
    dateOfBirth: string
  } | null
}

export async function verifyFayda(
  input: FaydaVerificationInput,
): Promise<FaydaVerificationResult> {
  return apiRequest<FaydaVerificationResult>('/fayda/verify', {
    method: 'POST',
    body: JSON.stringify({
      faydaId: input.faydaId.trim(),
      fullName: input.fullName.trim(),
      dateOfBirth: input.dateOfBirth.trim(),
    }),
  })
}
