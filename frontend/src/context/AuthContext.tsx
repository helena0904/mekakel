import { useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './AuthContext'

interface User {
  id: number
  email: string
  name: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  role: string
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('token')
  )

  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('user')

    return savedUser ? JSON.parse(savedUser) : null
  })

  function loginUser(newToken: string, newUser: User) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))

    setToken(newToken)
    setUser(newUser)
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loginUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}