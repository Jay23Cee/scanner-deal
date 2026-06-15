const QUERY_SANITIZER = /[^\w\s\-+./:#&'"]/g

export type SoldCompsHandoffMode = 'auto' | 'manual'

export function cleanEbayQuery(input: string): string {
  return input.replace(/\s+/g, ' ').replace(QUERY_SANITIZER, '').replace(/\s+/g, ' ').trim()
}

export function buildSoldCompsHandoffPath(
  query: string,
  mode: SoldCompsHandoffMode = 'auto'
): string {
  const cleanQuery = cleanEbayQuery(query)
  const params = new URLSearchParams()

  if (cleanQuery.length > 0) {
    params.set('query', cleanQuery)
  }

  if (mode !== 'auto') {
    params.set('mode', mode)
  }

  const search = params.toString()
  return search.length > 0 ? `/ebay/sold-comps?${search}` : '/ebay/sold-comps'
}

export function buildAndroidChromeIntentUrl(ebayUrl: string, fallbackUrl: string): string {
  const parsedUrl = new URL(ebayUrl)
  const intentPath = `${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`

  return `intent://${intentPath}#Intent;scheme=${parsedUrl.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
    fallbackUrl
  )};end`
}

export function buildEbaySoldCompsUrl(query: string): string {
  const cleanQuery = cleanEbayQuery(query)
  const params = new URLSearchParams({
    _nkw: cleanQuery,
    _ipg: '120',
    LH_Sold: '1',
    LH_Complete: '1'
  })

  return `https://www.ebay.com/sch/i.html?${params.toString()}`
}

export function buildEbayActiveSearchUrl(query: string): string {
  const cleanQuery = cleanEbayQuery(query)
  const params = new URLSearchParams({
    _nkw: cleanQuery
  })

  return `https://www.ebay.com/sch/i.html?${params.toString()}`
}

export function openEbayUrl(url: string): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return Boolean(opened)
}
