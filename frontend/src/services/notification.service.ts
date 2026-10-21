import apiRequest from './api'

export type NotificationCategoryValue =
  | 'DONOR'
  | 'HOSPITAL'
  | 'RESERVATION'
  | 'TRANSFER'

export type NotificationStatusValue =
  | 'PENDING'
  | 'SENT'
  | 'FAILED'
  | 'SUPPRESSED'

export type NotificationTypeValue =
  | 'DONOR_REGISTERED'
  | 'DONOR_VERIFICATION_APPROVED'
  | 'DONOR_VERIFICATION_REJECTED'
  | 'DONOR_ADDITIONAL_INFO_REQUIRED'
  | 'DONOR_BLOOD_REQUESTED'
  | 'HOSPITAL_APPROVED'
  | 'HOSPITAL_REJECTED'
  | 'HOSPITAL_SUSPENDED'
  | 'HOSPITAL_ACTIVATED'
  | 'RESERVATION_CONFIRMED'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_RELEASED'
  | 'RESERVATION_EXPIRED'
  | 'RESERVATION_CONSUMED'
  | 'TRANSFER_REQUESTED'
  | 'TRANSFER_APPROVED'
  | 'TRANSFER_REJECTED'
  | 'TRANSFER_DISPATCHED'
  | 'TRANSFER_RECEIVED'
  | 'TRANSFER_COMPLETED'
  | 'TRANSFER_CANCELLED'

export interface Notification {
  id: number
  userId: number
  recipientEmail: string
  type: NotificationTypeValue
  category: NotificationCategoryValue
  subject: string
  body: string
  html: string | null
  status: NotificationStatusValue
  attempts: number
  maxAttempts: number
  lastError: string | null
  readAt: string | null
  sentAt: string | null
  createdAt: string
}

export interface NotificationPreferences {
  emailEnabled: boolean
  donorUpdates: boolean
  hospitalUpdates: boolean
  reservationUpdates: boolean
  transferUpdates: boolean
}

export interface NotificationFilters {
  status?: NotificationStatusValue
  category?: NotificationCategoryValue
  unreadOnly?: boolean
  limit?: number
}

function buildQuery(filters: NotificationFilters): string {
  const params = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return
    }

    params.set(key, String(value))
  })

  const query = params.toString()

  return query ? `?${query}` : ''
}

export async function getNotifications(
  filters: NotificationFilters = {}
): Promise<{
  notifications: Notification[]
  unreadCount: number
}> {
  return apiRequest<{
    notifications: Notification[]
    unreadCount: number
  }>(`/notifications${buildQuery(filters)}`)
}

export async function getUnreadCount(): Promise<number> {
  const response = await apiRequest<{
    unreadCount: number
  }>('/notifications/unread-count')

  return response.unreadCount
}

export async function markNotificationRead(
  notificationId: number
): Promise<Notification> {
  const response = await apiRequest<{
    notification: Notification
  }>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  })

  return response.notification
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await apiRequest<{ updated: number }>(
    '/notifications/read-all',
    { method: 'POST' }
  )

  return response.updated
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const response = await apiRequest<{
    preferences: NotificationPreferences
  }>('/notifications/preferences')

  return response.preferences
}

export async function updateNotificationPreferences(
  input: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  const response = await apiRequest<{
    preferences: NotificationPreferences
  }>('/notifications/preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  })

  return response.preferences
}

export const NOTIFICATION_CATEGORY_LABELS: Record<
  NotificationCategoryValue,
  string
> = {
  DONOR: 'Donor',
  HOSPITAL: 'Hospital',
  RESERVATION: 'Reservation',
  TRANSFER: 'Transfer',
}

export const NOTIFICATION_STATUS_LABELS: Record<
  NotificationStatusValue,
  string
> = {
  PENDING: 'Queued',
  SENT: 'Sent',
  FAILED: 'Failed',
  SUPPRESSED: 'Muted',
}

export const NOTIFICATION_PREFERENCE_LABELS: Array<{
  key: keyof NotificationPreferences
  label: string
  description: string
}> = [
  {
    key: 'emailEnabled',
    label: 'Email notifications',
    description:
      'Master switch for all MEKAKEL email notifications.',
  },
  {
    key: 'donorUpdates',
    label: 'Donor updates',
    description:
      'Registration, verification and urgent blood request updates.',
  },
  {
    key: 'hospitalUpdates',
    label: 'Hospital updates',
    description:
      'Approval, rejection and suspension decisions.',
  },
  {
    key: 'reservationUpdates',
    label: 'Reservation updates',
    description:
      'Confirmations, cancellations, releases and expiry.',
  },
  {
    key: 'transferUpdates',
    label: 'Transfer updates',
    description:
      'Transfer requests and status changes.',
  },
]

export function notificationStatusBadgeClass(
  status: NotificationStatusValue
): string {
  switch (status) {
    case 'SENT':
      return 'status-badge status-badge-approved'
    case 'FAILED':
      return 'status-badge status-badge-rejected'
    case 'SUPPRESSED':
      return 'status-badge status-badge-pending'
    default:
      return 'status-badge status-badge-info'
  }
}
