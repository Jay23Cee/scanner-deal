import { buildEbaySoldCompsUrl } from '@/lib/ebayLinks'
import { ListingResult, SearchMode } from '@/lib/types'

export function buildEbaySoldUrl(query: string) {
  return buildEbaySoldCompsUrl(query)
}

export function deriveEbaySoldSearchQuery(input: {
  mode: SearchMode
  query: string
  rawListings: ListingResult[]
}) {
  const normalizedQuery = input.query.trim()

  if (input.mode !== 'gtin') {
    return normalizedQuery
  }

  const detectedTitle = input.rawListings.find((listing) => listing.title.trim().length > 0)?.title.trim()
  return detectedTitle ?? normalizedQuery
}
