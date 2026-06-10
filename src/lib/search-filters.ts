import {
  BuyingFormatFilter,
  ListingSortMode,
  ResultsConditionFilter,
  SearchFilters
} from '@/lib/types'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

export const LISTING_SORT_MODES = [
  'best_match',
  'lowest_total',
  'highest_total',
  'newest_listed',
  'ending_soon'
] as const satisfies ReadonlyArray<ListingSortMode>

export const RESULTS_CONDITION_VALUES = [
  'any',
  'new',
  'used',
  'open_box',
  'for_parts'
] as const satisfies ReadonlyArray<ResultsConditionFilter>

export const BUYING_FORMAT_VALUES = [
  'any',
  'buy_it_now',
  'auction',
  'best_offer'
] as const satisfies ReadonlyArray<BuyingFormatFilter>

export const LISTING_AGE_DAY_VALUES = [0, 3, 7, 30] as const
export const MIN_MATCH_SCORE_VALUES = [0.7, 0.8, 0.9, 0.95] as const
export const RESULT_LIMIT_VALUES = [10, 25, 50, 100] as const

export const LISTING_SORT_OPTIONS: ReadonlyArray<{ value: ListingSortMode; label: string }> = [
  { value: 'best_match', label: 'Best match' },
  { value: 'lowest_total', label: 'Lowest total' },
  { value: 'highest_total', label: 'Highest total' },
  { value: 'newest_listed', label: 'Newly listed' },
  { value: 'ending_soon', label: 'Ending soon' }
]

export const RESULTS_CONDITION_OPTIONS: ReadonlyArray<{
  value: ResultsConditionFilter
  label: string
}> = [
  { value: 'any', label: 'Any condition' },
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
  { value: 'open_box', label: 'Open box' },
  { value: 'for_parts', label: 'For parts or not working' }
]

export const BUYING_FORMAT_OPTIONS: ReadonlyArray<{
  value: BuyingFormatFilter
  label: string
}> = [
  { value: 'any', label: 'Any format' },
  { value: 'buy_it_now', label: 'Buy It Now' },
  { value: 'auction', label: 'Auction' },
  { value: 'best_offer', label: 'Best Offer' }
]

export const LISTING_AGE_OPTIONS: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: null, label: 'Any' },
  { value: 0, label: 'Today' },
  { value: 3, label: 'Within 3 days' },
  { value: 7, label: 'Within 7 days' },
  { value: 30, label: 'Within 30 days' }
]

export const MIN_MATCH_OPTIONS: ReadonlyArray<{ value: number | null; label: string }> = [
  { value: null, label: 'Any' },
  { value: 0.7, label: '70%+' },
  { value: 0.8, label: '80%+' },
  { value: 0.9, label: '90%+' },
  { value: 0.95, label: '95%+' }
]

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  resultsCondition: 'any',
  buyingOptions: 'any',
  minPrice: null,
  maxPrice: null,
  freeShipping: false,
  sort: 'best_match',
  limit: 25,
  excludeWords: '',
  minMatchScore: null,
  listingAgeDays: null
}

export function createDefaultSearchFilters(): SearchFilters {
  return { ...DEFAULT_SEARCH_FILTERS }
}

export function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null
  }

  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : null
}

export function getSortOptionLabel(sort: ListingSortMode) {
  return LISTING_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? 'Best match'
}

export function getResultsConditionLabel(resultsCondition: SearchFilters['resultsCondition']) {
  return RESULTS_CONDITION_OPTIONS.find((option) => option.value === resultsCondition)?.label ?? 'Any condition'
}

export function getBuyingFormatLabel(buyingOptions: SearchFilters['buyingOptions']) {
  return BUYING_FORMAT_OPTIONS.find((option) => option.value === buyingOptions)?.label ?? 'Any format'
}

export function getListingAgeLabel(listingAgeDays: number | null) {
  if (listingAgeDays === null) {
    return 'Any'
  }

  return LISTING_AGE_OPTIONS.find((option) => option.value === listingAgeDays)?.label ?? `${listingAgeDays} days`
}

export function getMinMatchLabel(minMatchScore: number | null) {
  if (minMatchScore === null) {
    return 'Any'
  }

  return (
    MIN_MATCH_OPTIONS.find((option) => option.value === minMatchScore)?.label ??
    `${Math.round(minMatchScore * 100)}%+`
  )
}

export function buildAppliedFilterSummary(filters: SearchFilters) {
  const chips: string[] = []

  if (filters.resultsCondition !== DEFAULT_SEARCH_FILTERS.resultsCondition) {
    chips.push(getResultsConditionLabel(filters.resultsCondition))
  }

  if (filters.buyingOptions !== DEFAULT_SEARCH_FILTERS.buyingOptions) {
    chips.push(getBuyingFormatLabel(filters.buyingOptions))
  }

  if (filters.freeShipping) {
    chips.push('Free shipping')
  }

  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const start = filters.minPrice === null ? 'Any' : currencyFormatter.format(filters.minPrice)
    const end = filters.maxPrice === null ? 'Any' : currencyFormatter.format(filters.maxPrice)
    chips.push(`${start} - ${end}`)
  }

  if (filters.listingAgeDays !== DEFAULT_SEARCH_FILTERS.listingAgeDays) {
    chips.push(getListingAgeLabel(filters.listingAgeDays))
  }

  if (filters.minMatchScore !== DEFAULT_SEARCH_FILTERS.minMatchScore) {
    chips.push(getMinMatchLabel(filters.minMatchScore))
  }

  if (filters.limit !== DEFAULT_SEARCH_FILTERS.limit) {
    chips.push(`${filters.limit} results`)
  }

  if (filters.sort !== DEFAULT_SEARCH_FILTERS.sort) {
    chips.push(`Sort: ${getSortOptionLabel(filters.sort)}`)
  }

  if (filters.excludeWords.trim()) {
    chips.push(`Exclude: ${filters.excludeWords.trim()}`)
  }

  return chips
}
