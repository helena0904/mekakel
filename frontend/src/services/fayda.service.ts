import api from './api'

export interface FaydaVerificationData {
  faydaId: string
  fullName: string
  dateOfBirth: string
}

export interface FaydaVerificationResponse {
  success: boolean
  simulated: boolean
  message: string
  identity: {
    fullName: string
    dateOfBirth: string
  } | null
}

export async function verifyFayda(
  data: FaydaVerificationData,
): Promise<FaydaVerificationResponse> {
  const response = await api('/fayda/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return response as FaydaVerificationResponse
}