const QUERY_SANITIZER = /[^\w\s\-+./:#&'"]/g

export function cleanEbayQuery(input: string): string {
  return input.replace(/\s+/g, ' ').replace(QUERY_SANITIZER, '').replace(/\s+/g, ' ').trim()
}

export function buildEbaySoldCompsUrl(query: string): string {
  const cleanQuery = cleanEbayQuery(query)
  const params = new URLSearchParams({
    _nkw: cleanQuery,
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
