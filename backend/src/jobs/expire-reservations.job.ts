import { expireDueReservations } from '../services/reservation.service'

export const DEFAULT_EXPIRE_INTERVAL_MS = 60_000

export async function runExpireReservationsJob(): Promise<{
  scanned: number
  expired: number
}> {
  return expireDueReservations(new Date())
}

export function startExpireReservationsJob(
  intervalMs: number = DEFAULT_EXPIRE_INTERVAL_MS
): NodeJS.Timeout {
  const timer = setInterval(() => {
    runExpireReservationsJob().catch((error) => {
      console.error('Expire reservations job failed:', error)
    })
  }, intervalMs)

  // Let the process exit even if the interval is still registered.
  timer.unref()

  return timer
}
