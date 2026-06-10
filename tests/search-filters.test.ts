import { describe, expect, it } from 'vitest'
import {
  buildAppliedFilterSummary,
  createDefaultSearchFilters,
  DEFAULT_SEARCH_FILTERS
} from '@/lib/search-filters'

describe('search filter defaults', () => {
  it('returns a fresh copy of the default filters', () => {
    const nextFilters = createDefaultSearchFilters()

    expect(nextFilters).toEqual(DEFAULT_SEARCH_FILTERS)
    expect(nextFilters).not.toBe(DEFAULT_SEARCH_FILTERS)
  })

  it('builds summary chips only for non-default filters', () => {
    const chips = buildAppliedFilterSummary({
      ...createDefaultSearchFilters(),
      resultsCondition: 'used',
      buyingOptions: 'auction',
      freeShipping: true,
      minPrice: 100,
      maxPrice: 300,
      listingAgeDays: 7,
      minMatchScore: 0.8,
      limit: 50,
      sort: 'ending_soon',
      excludeWords: 'locked, cracked'
    })

    expect(chips).toEqual([
      'Used',
      'Auction',
      'Free shipping',
      '$100.00 - $300.00',
      'Within 7 days',
      '80%+',
      '50 results',
      'Sort: Ending soon',
      'Exclude: locked, cracked'
    ])
  })
})
