import { randomBytes } from 'node:crypto'

export const SELLER_STATE_COOKIE = 'ebay_sell_state'

export function createSellerAuthState() {
  return randomBytes(24).toString('hex')
}

export function readCookieValue(cookieHeader: string | null, cookieName: string) {
  if (!cookieHeader) {
    return null
  }

  const cookieEntry = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))

  if (!cookieEntry) {
    return null
  }

  return decodeURIComponent(cookieEntry.slice(cookieName.length + 1))
}

export function validateSellerAuthState(expected: string | null, actual: string | null) {
  return Boolean(expected) && Boolean(actual) && expected === actual
}
