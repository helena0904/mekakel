import { createContext } from 'react'

interface User {
  id: number
  email: string
  name: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  loginUser: (token: string, user: User) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
)