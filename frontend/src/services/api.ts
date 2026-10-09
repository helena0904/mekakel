const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
) {
  const isFormData = options.body instanceof FormData

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong')
  }

  return data
}

export default apiRequest