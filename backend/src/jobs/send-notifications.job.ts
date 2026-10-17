import {
  processPendingNotifications,
  type ProcessNotificationsResult,
} from '../services/notification.service'

export const DEFAULT_SEND_INTERVAL_MS = 60_000

export async function runSendNotificationsJob(): Promise<ProcessNotificationsResult> {
  return processPendingNotifications()
}

export function startSendNotificationsJob(
  intervalMs: number = DEFAULT_SEND_INTERVAL_MS
): NodeJS.Timeout {
  const timer = setInterval(() => {
    runSendNotificationsJob().catch((error) => {
      console.error('Send notifications job failed:', error)
    })
  }, intervalMs)

  // Let the process exit even if the interval is still registered.
  timer.unref()

  return timer
}
