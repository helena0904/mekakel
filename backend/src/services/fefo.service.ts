/**
 * FEFO (First Expired, First Out) ordering.
 *
 * Eligible units are ranked by earliest expiry so that stock closest to expiry
 * is considered first. Ties fall back to the unit id to keep ordering stable.
 */

export interface FefoItem {
  id: number
  expiryDate: Date
}

const DAY_MS = 24 * 60 * 60 * 1000

export function compareFefo(
  a: FefoItem,
  b: FefoItem
): number {
  const diff =
    a.expiryDate.getTime() - b.expiryDate.getTime()

  if (diff !== 0) {
    return diff
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
