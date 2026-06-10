import { ItemLocationSummary, ListingResult, ListingSortMode } from '@/lib/types'

export function getListingAgeSourceDate(input: {
  itemOriginDate?: string | null
  itemCreationDate?: string | null
}) {
  return input.itemOriginDate?.trim() || input.itemCreationDate?.trim() || null
}

function parseListingAgeDate(input: {
  itemOriginDate?: string | null
  itemCreationDate?: string | null
}) {
  const sourceDate = getListingAgeSourceDate(input)
  if (!sourceDate) {
    return null
  }

  const date = new Date(sourceDate)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatListingCalendarDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeZone: 'UTC'
  }).format(date)
}

function parseDisplayListingDate(input: {
  itemOriginDate?: string | null
  itemCreationDate?: string | null
}) {
  const sourceDate = input.itemCreationDate?.trim() || input.itemOriginDate?.trim() || null
  if (!sourceDate) {
    return null
  }

  const date = new Date(sourceDate)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getListingAbsoluteAgeLabel(input: {
  itemOriginDate?: string | null
  itemCreationDate?: string | null
}) {
  const date = parseListingAgeDate(input)
  if (!date) {
    return 'Age unavailable'
  }

  return `Listed ${formatListingCalendarDate(date)}`
}

export function getListingAgeDateLabel(input: {
  itemOriginDate?: string | null
  itemCreationDate?: string | null
}) {
  const date = parseDisplayListingDate(input)
  return date ? formatListingCalendarDate(date) : null
}

export function getListingRelativeAgeLabel(
  input: {
    itemOriginDate?: string | null
    itemCreationDate?: string | null
  },
  now = Date.now()
) {
  const date = parseListingAgeDate(input)
  if (!date) {
    return 'Age unavailable'
  }

  const diffMs = now - date.getTime()
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  if (diffDays === 0) {
    return 'Listed today'
  }

  if (diffDays === 1) {
    return 'Listed 1 day ago'
  }

  return `Listed ${diffDays} days ago`
}

export function getListingSortTimestamp(listing: ListingResult) {
  const sourceDate = getListingAgeSourceDate(listing)
  if (!sourceDate) {
    return 0
  }

  const timestamp = Date.parse(sourceDate)
  return Number.isFinite(timestamp) ? timestamp : 0
}

function getListingEndTimestamp(listing: ListingResult) {
  if (!listing.itemEndDate) {
    return 0
  }

  const timestamp = Date.parse(listing.itemEndDate)
  return Number.isFinite(timestamp) ? timestamp : 0
}

export function sortListings(listings: ListingResult[], mode: ListingSortMode) {
  const sorted = [...listings]

  sorted.sort((left, right) => {
    if (mode === 'lowest_total') {
      return left.totalPrice - right.totalPrice || right.matchScore - left.matchScore
    }

    if (mode === 'highest_total') {
      return right.totalPrice - left.totalPrice || right.matchScore - left.matchScore
    }

    if (mode === 'newest_listed') {
      return getListingSortTimestamp(right) - getListingSortTimestamp(left) || right.matchScore - left.matchScore
    }

    if (mode === 'ending_soon') {
      return getListingEndTimestamp(left) - getListingEndTimestamp(right) || right.matchScore - left.matchScore
    }

    return right.matchScore - left.matchScore || left.totalPrice - right.totalPrice
  })

  return sorted
}

export function formatBuyingOptions(buyingOptions: string[]) {
  if (buyingOptions.length === 0) {
    return 'Not available'
  }

  const labels = buyingOptions.map((option) => {
    if (option === 'FIXED_PRICE') {
      return 'Buy It Now'
    }

    if (option === 'AUCTION') {
      return 'Auction'
    }

    if (option === 'BEST_OFFER') {
      return 'Best Offer'
    }

    return option.replace(/_/g, ' ')
  })

  return labels.join(', ')
}

export function formatListingLocation(itemLocation: ItemLocationSummary | null) {
  if (!itemLocation) {
    return null
  }

  const parts = [itemLocation.city, itemLocation.stateOrProvince, itemLocation.country].filter(Boolean)
  if (parts.length > 0) {
    return parts.join(', ')
  }

  return itemLocation.postalCode || null
}
