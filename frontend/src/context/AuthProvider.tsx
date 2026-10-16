import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'
import apiRequest from '../services/api'

interface User {
  id: number
  name: string
  email: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  role: string
}

interface Session {
  token: string
  user: User
}

interface AuthProviderProps {
  children: ReactNode
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1]

    if (!payload) {
      return true
    }

    const base64 = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      '='
    )

    const decoded = JSON.parse(atob(padded))

    if (typeof decoded.exp !== 'number') {
      return true
    }

    return Date.now() >= decoded.exp * 1000
  } catch {
    return true
  }
}

function clearStoredSession(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}

function loadStoredSession(): Session | null {
  try {
    const token = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (
      !token ||
      !storedUser ||
      isTokenExpired(token)
    ) {
      clearStoredSession()
      return null
    }

    const user: unknown = JSON.parse(storedUser)

    if (
      !user ||
      typeof user !== 'object' ||
      !('id' in user) ||
      !('name' in user) ||
      !('email' in user) ||
      !('role' in user) ||
      !('accountType' in user) ||
      typeof user.id !== 'number' ||
      typeof user.name !== 'string' ||
      typeof user.email !== 'string' ||
      typeof user.role !== 'string' ||
      (user.accountType !== 'INDIVIDUAL' &&
        user.accountType !== 'HOSPITAL')
    ) {
      clearStoredSession()
      return null
    }

    return {
      token,
      user: user as User,
    }
  } catch {
    clearStoredSession()
    return null
  }
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [initialSession] = useState<Session | null>(
    loadStoredSession
  )

  const [session, setSession] = useState<Session | null>(
    initialSession
  )

  const [isLoading, setIsLoading] = useState<boolean>(
    initialSession !== null
  )

  // Rehydrate from the server on first load so a revoked or stale token is
  // rejected immediately and the cached user stays in sync with the backend.
  useEffect(() => {
    const stored = loadStoredSession()

    if (!stored) {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const response = await apiRequest<{ user: User }>(
          '/users/me'
        )

        if (cancelled) {
          return
        }

        localStorage.setItem(
          'user',
          JSON.stringify(response.user)
        )

        setSession({
          token: stored.token,
          user: response.user,
        })
      } catch {
        if (cancelled) {
          return
        }

        clearStoredSession()
        setSession(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const loginUser = useCallback(
    (newToken: string, newUser: User) => {
      if (!newToken || isTokenExpired(newToken)) {
        throw new Error('Invalid or expired session token')
      }

      localStorage.setItem('token', newToken)
      localStorage.setItem('user', JSON.stringify(newUser))

      setSession({
        token: newToken,
        user: newUser,
      })
    },
    []
  )

  const logout = useCallback(() => {
    const token = localStorage.getItem('token')

    clearStoredSession()
    setSession(null)

    if (token) {
      void apiRequest('/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {
        // The local session is already cleared; ignore network errors.
      })
    }
  }, [])

  useEffect(() => {
    const checkSession = () => {
      const storedToken = localStorage.getItem('token')

      if (
        !storedToken ||
        isTokenExpired(storedToken)
      ) {
        logout()
      }
    }

    const syncSession = () => {
      setSession(loadStoredSession())
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSession()
      }
    }

    const interval = window.setInterval(
      checkSession,
      60_000
    )

    window.addEventListener('focus', checkSession)
    window.addEventListener('storage', syncSession)

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    )

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', checkSession)
      window.removeEventListener('storage', syncSession)

      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      )
    }
  }, [logout])

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        token: session?.token ?? null,
        isLoading,
        loginUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}