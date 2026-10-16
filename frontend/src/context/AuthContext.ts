
import { createContext } from 'react'

export interface AuthUser {
  id: number
  name: string
  email: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
  role: string
}

export interface AuthContextType {
  user: AuthUser | null
  token: string | null
  isLoading: boolean
  loginUser: (token: string, user: AuthUser) => void
  logout: () => void
}

export const AuthContext = createContext<
  AuthContextType | undefined
>(undefined)

