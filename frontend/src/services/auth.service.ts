import apiRequest from './api'

export interface LoginData {
  email: string
  password: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

export interface RegisterData {
  email: string
  password: string
  name: string
  accountType: 'INDIVIDUAL' | 'HOSPITAL'
}

export async function login(data: LoginData) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function register(data: RegisterData) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}