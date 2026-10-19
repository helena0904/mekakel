/**
 * FEFO (First Expired, First Out) ordering.
 *
 * Eligible units are ranked by earliest expiry, then oldest collection,
 * closest location and bag id. The id remains the final deterministic
 * tie-breaker.
 */

export interface FefoItem {
  id: number
  expiryDate: Date
  collectionDate?: Date
  distanceKm?: number | null
  bagId?: string
}

const DAY_MS = 24 * 60 * 60 * 1000

function compareDates(
  a: Date | undefined,
  b: Date | undefined
): number {
  if (!a && !b) {
    return 0
  }

  if (!a) {
    return 1
  }

  if (!b) {
    return -1
  }

  return a.getTime() - b.getTime()
}

function compareDistances(
  a: number | null | undefined,
  b: number | null | undefined
): number {
  const left = a ?? Number.POSITIVE_INFINITY
  const right = b ?? Number.POSITIVE_INFINITY

  if (left === right) {
    return 0
  }

  return left < right ? -1 : 1
}

export function compareFefo(
  a: FefoItem,
  b: FefoItem
): number {
  const expiryDiff =
    a.expiryDate.getTime() - b.expiryDate.getTime()

  if (expiryDiff !== 0) {
    return expiryDiff
  }

  const collectionDiff = compareDates(
    a.collectionDate,
    b.collectionDate
  )

  if (collectionDiff !== 0) {
    return collectionDiff
  }

  const distanceDiff = compareDistances(
    a.distanceKm,
    b.distanceKm
  )

  if (distanceDiff !== 0) {
    return distanceDiff
  }

  const bagDiff = (a.bagId ?? '').localeCompare(b.bagId ?? '')

  if (bagDiff !== 0) {
    return bagDiff
  }

  return a.id - b.id
}

export function sortByFefo<T extends FefoItem>(
  units: T[]
): T[] {
  return [...units].sort(compareFefo)
}

export function assignFefoRank<T extends FefoItem>(
  units: T[]
): Array<T & { fefoRank: number }> {
  return sortByFefo(units).map((unit, index) => ({
    ...unit,
    fefoRank: index + 1,
  }))
}

export function daysUntil(
  date: Date,
  now: Date = new Date()
): number {
  return Math.ceil(
    (date.getTime() - now.getTime()) / DAY_MS
  )
}
