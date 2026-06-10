import {
  BuyingFormatFilter,
  ItemCondition,
  ItemLocationSummary,
  ListingResult,
  ResultsConditionFilter,
  SearchFilters,
  SearchMode
} from '@/lib/types'
import { getListingAgeSourceDate } from '@/lib/listings'

export const EXCLUDED_TERMS = [
  'case',
  'cover',
  'box only',
  'for parts',
  'repair',
  'replacement',
  'screen protector',
  'manual',
  'charger only',
  'parts only',
  'not working',
  'cracked',
  'locked'
]

const OPEN_BOX_CONDITION_ID = '1500'
const FOR_PARTS_CONDITION_ID = '7000'
const FIXED_PRICE_BUYING_OPTION = 'FIXED_PRICE'
const AUCTION_BUYING_OPTION = 'AUCTION'
const BEST_OFFER_BUYING_OPTION = 'BEST_OFFER'

type RawBrowseItem = {
  title?: string
  condition?: string
  conditionId?: string
  itemWebUrl?: string
  itemId?: string
  itemCreationDate?: string
  itemOriginDate?: string
  itemEndDate?: string
  buyingOptions?: string[]
  image?: {
    imageUrl?: string
  }
  thumbnailImages?: Array<{
    imageUrl?: string
  }>
  additionalImages?: Array<{
    imageUrl?: string
  }>
  itemLocation?: {
    city?: string
    stateOrProvince?: string
    country?: string
    postalCode?: string
  }
  price?: {
    value?: string
    currency?: string
  }
  shippingOptions?: Array<{
    shippingCost?: {
      value?: string
      currency?: string
    }
    shippingCostType?: string
  }>
  shippingCost?: {
    value?: string
    currency?: string
  }
  seller?: {
    username?: string
    feedbackPercentage?: string
  }
}

interface NormalizeOptions {
  mode: SearchMode
  query: string
  condition: ItemCondition
}

interface CandidateListing extends ListingResult {
  conditionClose: boolean
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function parseTerms(rawValue: string) {
  return rawValue
    .split(',')
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
}

function titleIncludesExcludedTerm(title: string, additionalTerms: string[] = []) {
  const allTerms = [...EXCLUDED_TERMS, ...additionalTerms]

  return allTerms.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
    return new RegExp(`\\b${escaped}\\b`, 'i').test(title)
  })
}

function getShippingCost(item: RawBrowseItem) {
  if (item.shippingOptions?.[0]?.shippingCostType === 'FREE') {
    return 0
  }

  if (item.shippingOptions?.[0]?.shippingCost?.value) {
    return Number(item.shippingOptions[0].shippingCost.value)
  }

  if (item.shippingCost?.value) {
    return Number(item.shippingCost.value)
  }

  return 0
}

function isShippingKnown(item: RawBrowseItem) {
  return Boolean(
    item.shippingOptions?.[0]?.shippingCostType === 'FREE' ||
      item.shippingOptions?.[0]?.shippingCost?.value ||
      item.shippingCost?.value
  )
}

function getCurrency(item: RawBrowseItem) {
  return item.price?.currency ?? item.shippingOptions?.[0]?.shippingCost?.currency ?? 'USD'
}

function getImageUrl(item: RawBrowseItem) {
  return item.image?.imageUrl?.trim() || null
}

function getThumbnailUrl(item: RawBrowseItem) {
  return item.thumbnailImages?.[0]?.imageUrl?.trim() || getImageUrl(item)
}

function getAdditionalImageUrls(item: RawBrowseItem) {
  return (item.additionalImages ?? [])
    .map((image) => image.imageUrl?.trim() || null)
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl))
}

function getBuyingOptions(item: RawBrowseItem) {
  return (item.buyingOptions ?? []).filter(
    (option): option is string => typeof option === 'string' && option.length > 0
  )
}

function getItemLocation(item: RawBrowseItem): ItemLocationSummary | null {
  const itemLocation = item.itemLocation
  if (!itemLocation) {
    return null
  }

  const location = {
    city: itemLocation.city?.trim() || null,
    stateOrProvince: itemLocation.stateOrProvince?.trim() || null,
    country: itemLocation.country?.trim() || null,
    postalCode: itemLocation.postalCode?.trim() || null
  }

  if (!location.city && !location.stateOrProvince && !location.country && !location.postalCode) {
    return null
  }

  return location
}

function getSellerFeedbackPercentage(item: RawBrowseItem) {
  const value = item.seller?.feedbackPercentage
  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isConditionClose(label: string, selectedCondition: ItemCondition) {
  const lower = label.toLowerCase()

  if (selectedCondition === 'new') {
    return lower.includes('new') && !lower.includes('new other') && !lower.includes('open box')
  }

  if (selectedCondition === 'open_box') {
    return (
      lower.includes('open box') ||
      lower.includes('like new') ||
      lower.includes('new other') ||
      lower.includes('new without')
    )
  }

  return (
    lower.includes('used') ||
    lower.includes('pre-owned') ||
    lower.includes('seller refurbished') ||
    lower.includes('certified refurbished')
  )
}

function matchesResultsCondition(listing: ListingResult, resultsCondition: ResultsConditionFilter) {
  if (resultsCondition === 'any') {
    return true
  }

  if (resultsCondition === 'new') {
    return listing.condition.toLowerCase().includes('new')
  }

  if (resultsCondition === 'used') {
    return isConditionClose(listing.condition, 'used')
  }

  if (resultsCondition === 'open_box') {
    return listing.conditionId === OPEN_BOX_CONDITION_ID || isConditionClose(listing.condition, 'open_box')
  }

  return listing.conditionId === FOR_PARTS_CONDITION_ID || /for parts|not working/i.test(listing.condition)
}

function matchesBuyingFormat(listing: ListingResult, buyingOptions: BuyingFormatFilter) {
  if (buyingOptions === 'any') {
    return true
  }

  if (buyingOptions === 'buy_it_now') {
    return listing.buyingOptions.includes(FIXED_PRICE_BUYING_OPTION)
  }

  if (buyingOptions === 'auction') {
    return listing.buyingOptions.includes(AUCTION_BUYING_OPTION)
  }

  return listing.buyingOptions.includes(BEST_OFFER_BUYING_OPTION)
}

function matchesListingAge(listing: ListingResult, listingAgeDays: number | null) {
  if (listingAgeDays === null) {
    return true
  }

  const sourceDate = getListingAgeSourceDate(listing)
  if (!sourceDate) {
    return false
  }

  const timestamp = Date.parse(sourceDate)
  if (!Number.isFinite(timestamp)) {
    return false
  }

  const diffDays = Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)))
  return listingAgeDays === 0 ? diffDays === 0 : diffDays <= listingAgeDays
}

function computeTitleScore(mode: SearchMode, query: string, title: string) {
  if (mode === 'gtin') {
    return 0.9
  }

  const queryTokens = tokenize(query)
  const titleTokens = new Set(tokenize(title))

  if (queryTokens.length === 0) {
    return 0
  }

  const matches = queryTokens.filter((token) => titleTokens.has(token)).length
  return matches / queryTokens.length
}

function computeConditionScore(label: string, selectedCondition: ItemCondition) {
  if (isConditionClose(label, selectedCondition)) {
    return 1
  }

  if (selectedCondition === 'open_box' && label.toLowerCase().includes('new')) {
    return 0.65
  }

  if (selectedCondition === 'used' && label.toLowerCase().includes('refurbished')) {
    return 0.7
  }

  return 0.2
}

function computePriceSanity(totalPrice: number, middlePrice: number) {
  if (middlePrice <= 0) {
    return 0.5
  }

  const ratio = Math.abs(totalPrice - middlePrice) / middlePrice
  return Math.max(0, 1 - Math.min(1, ratio))
}

function median(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function parseBrowseItem(item: RawBrowseItem): CandidateListing | null {
  const title = item.title?.trim()
  const price = Number(item.price?.value ?? NaN)

  if (!title || !Number.isFinite(price)) {
    return null
  }

  const shippingCost = getShippingCost(item)
  const shippingKnown = isShippingKnown(item)

  return {
    title,
    price,
    currency: getCurrency(item),
    shippingCost,
    shippingKnown,
    totalPrice: Number((price + shippingCost).toFixed(2)),
    condition: item.condition?.trim() || 'Unknown',
    conditionId: item.conditionId?.trim() || null,
    itemUrl: item.itemWebUrl?.trim() || 'https://www.ebay.com',
    itemId: item.itemId?.trim() || 'Unavailable',
    sellerUsername: item.seller?.username?.trim() || null,
    sellerFeedbackPercentage: getSellerFeedbackPercentage(item),
    itemLocation: getItemLocation(item),
    matchScore: 0,
    primaryImageUrl: getImageUrl(item),
    thumbnailUrl: getThumbnailUrl(item),
    additionalImageUrls: getAdditionalImageUrls(item),
    itemCreationDate: item.itemCreationDate?.trim() || null,
    itemOriginDate: item.itemOriginDate?.trim() || null,
    itemEndDate: item.itemEndDate?.trim() || null,
    buyingOptions: getBuyingOptions(item),
    conditionClose: false
  }
}

function stripCandidate(listing: CandidateListing): ListingResult {
  const { conditionClose: _conditionClose, ...publicListing } = listing
  return publicListing
}

export function mapResultsConditionToBrowseFilter(resultsCondition: ResultsConditionFilter) {
  if (resultsCondition === 'new') {
    return 'conditions:{NEW}'
  }

  if (resultsCondition === 'used') {
    return 'conditions:{USED}'
  }

  if (resultsCondition === 'open_box') {
    return `conditionIds:{${OPEN_BOX_CONDITION_ID}}`
  }

  if (resultsCondition === 'for_parts') {
    return `conditionIds:{${FOR_PARTS_CONDITION_ID}}`
  }

  return null
}

export function mapBuyingOptionsToBrowseFilter(buyingOptions: BuyingFormatFilter) {
  if (buyingOptions === 'buy_it_now') {
    return `buyingOptions:{${FIXED_PRICE_BUYING_OPTION}}`
  }

  if (buyingOptions === 'auction') {
    return `buyingOptions:{${AUCTION_BUYING_OPTION}}`
  }

  if (buyingOptions === 'best_offer') {
    return `buyingOptions:{${BEST_OFFER_BUYING_OPTION}}`
  }

  return null
}

export function normalizeBrowseItems(
  items: RawBrowseItem[],
  options: NormalizeOptions
) {
  let excludedCount = 0

  const parsedListings = items.flatMap((item) => {
    const listing = parseBrowseItem(item)

    if (!listing) {
      excludedCount += 1
      return []
    }

    return [listing]
  })

  const middlePrice = median(parsedListings.map((listing) => listing.totalPrice))

  const rawListings = parsedListings.map((listing) => {
    const titleScore = computeTitleScore(options.mode, options.query, listing.title)
    const conditionScore = computeConditionScore(listing.condition, options.condition)
    const priceSanity = computePriceSanity(listing.totalPrice, middlePrice)
    const matchScore = Number((titleScore * 0.55 + conditionScore * 0.25 + priceSanity * 0.2).toFixed(2))

    return stripCandidate({
      ...listing,
      matchScore,
      conditionClose: isConditionClose(listing.condition, options.condition)
    })
  })

  return {
    rawListings,
    excludedCount
  }
}

export function applyListingPostFilters(listings: ListingResult[], filters: SearchFilters) {
  const additionalTerms = parseTerms(filters.excludeWords)
  let excludedCount = 0

  const filteredListings = listings.filter((listing) => {
    if (titleIncludesExcludedTerm(listing.title, additionalTerms)) {
      excludedCount += 1
      return false
    }

    if (!matchesResultsCondition(listing, filters.resultsCondition)) {
      excludedCount += 1
      return false
    }

    if (!matchesBuyingFormat(listing, filters.buyingOptions)) {
      excludedCount += 1
      return false
    }

    if (filters.minMatchScore !== null && listing.matchScore < filters.minMatchScore) {
      excludedCount += 1
      return false
    }

    if (!matchesListingAge(listing, filters.listingAgeDays)) {
      excludedCount += 1
      return false
    }

    return true
  })

  return {
    rawListings: filteredListings,
    excludedCount
  }
}

export function getSuggestedComparisonItemIds(
  listings: ListingResult[],
  selectedCondition: ItemCondition
) {
  return listings
    .filter((listing) => {
      const threshold = selectedCondition === 'open_box' ? 0.5 : 0.45
      return listing.matchScore >= threshold
    })
    .map((listing) => listing.itemId)
}
