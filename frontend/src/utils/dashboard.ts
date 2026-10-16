import type { AccountType } from '../services/auth.service'

export function dashboardPathFor(accountType: AccountType): string {
  return accountType === 'INDIVIDUAL'
    ? '/donor-dashboard'
    : '/hospital-dashboard'
}
