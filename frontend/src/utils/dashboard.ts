import type { AccountType } from '../services/auth.service'

export function dashboardPathFor(accountType: AccountType): string {
  return accountType === 'INDIVIDUAL'
    ? '/donor-dashboard'
    : '/hospital-dashboard'
}

export function dashboardPathForUser(user: {
  accountType: AccountType
  role: string
}): string {
  if (user.role === 'ADMIN') {
    return '/admin-dashboard'
  }

  if (user.role === 'DOCTOR') {
    return '/doctor-dashboard'
  }

  return dashboardPathFor(user.accountType)
}
