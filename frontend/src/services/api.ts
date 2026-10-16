// Default to a same-origin relative path so requests go through the Vite dev
// proxy (see vite.config.ts). This avoids cross-origin/CORS failures. Provide
// VITE_API_URL to point at an explicit backend in other environments.
const API_URL = (
  import.meta.env.VITE_API_URL ||
  '/api'
).replace(/\/+$/, '')

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body instanceof FormData) {
    headers.delete('Content-Type')
  } else if (
    options.body &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }

  const token = localStorage.getItem('token')

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const path = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    })
  } catch {
    throw new Error(
      'Unable to connect to the server. Please check your internet connection or try again later.'
    )
  }

  const contentType =
    response.headers.get('Content-Type') ?? ''

  let data: unknown = null

  if (response.status !== 204) {
    if (contentType.includes('application/json')) {
      try {
        data = await response.json()
      } catch {
        throw new Error(
          'The server returned an invalid response.'
        )
      }
    } else {
      data = await response.text()
    }
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`

    if (
      data !== null &&
      typeof data === 'object' &&
      'message' in data &&
      typeof data.message === 'string'
    ) {
      message = data.message
    }

    throw new Error(message)
  }

  return data as T
}

export default apiRequest