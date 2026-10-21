const RESERVED_DOMAINS = new Set([
  'localhost',
  'test.com',
  'test.local',
  'example.com',
  'example.net',
  'example.org',
])

const RESERVED_TLDS = [
  '.test',
  '.example',
  '.invalid',
  '.localhost',
]

/**
 * Returns true for addresses that can never receive mail (reserved or
 * commonly faked domains such as `test.com`). Sending to these produces
 * bounce messages, so they are suppressed instead.
 */
export function isUndeliverableEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase()
  const atIndex = normalized.lastIndexOf('@')

  if (atIndex === -1) {
    return true
  }

  const domain = normalized
    .slice(atIndex + 1)
    .replace(/\.+$/, '')

  if (!domain || !domain.includes('.')) {
    return true
  }

  if (RESERVED_DOMAINS.has(domain)) {
    return true
  }

  return RESERVED_TLDS.some((tld) => domain.endsWith(tld))
}
