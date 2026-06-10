import { describe, expect, it, vi } from 'vitest'
import {
  applyListingPostFilters,
  getSuggestedComparisonItemIds,
  isConditionClose,
  mapBuyingOptionsToBrowseFilter,
  mapResultsConditionToBrowseFilter,
  normalizeBrowseItems
} from '@/lib/ebay/normalize'
import { buildBrowseSearchRequest } from '@/lib/ebay/search'
import {
  getListingAbsoluteAgeLabel,
  getListingAgeDateLabel,
  getListingAgeSourceDate,
  getListingRelativeAgeLabel
} from '@/lib/listings'
import { ListingResult, SearchRequestPayload } from '@/lib/types'

function buildSearchPayload(overrides: Partial<SearchRequestPayload> = {}): SearchRequestPayload {
  return {
    mode: 'keyword',
    query: 'iphone 15 pro max',
    condition: 'used',
    resultsCondition: 'used',
    buyingOptions: 'buy_it_now',
    minPrice: 700,
    maxPrice: 900,
    freeShipping: true,
    sort: 'lowest_total',
    limit: 50,
    excludeWords: '',
    minMatchScore: null,
    listingAgeDays: null,
    ...overrides
  }
}

describe('eBay search helpers', () => {
  it('builds keyword requests with the expected Browse filters and fieldgroups', () => {
    const request = buildBrowseSearchRequest({
      token: 'token-1',
      browseBaseUrl: 'https://api.ebay.com/buy/browse/v1',
      marketplaceId: 'EBAY_US',
      search: buildSearchPayload()
    })

    expect(request.url).toContain('https://api.ebay.com/buy/browse/v1/item_summary/search?')
    expect(request.url).toContain('q=iphone+15+pro+max')
    expect(request.url).not.toContain('gtin=')
    expect(request.url).toContain('fieldgroups=MATCHING_ITEMS%2CEXTENDED')
    expect(request.url).toContain('filter=conditions%3A%7BUSED%7D')
    expect(request.url).toContain('buyingOptions%3A%7BFIXED_PRICE%7D')
    expect(request.url).toContain('price%3A%5B700..900%5D')
    expect(request.url).toContain('priceCurrency%3AUSD')
    expect(request.url).toContain('maxDeliveryCost%3A0')
    expect(request.url).toContain('sort=price')
    expect(request.url).toContain('limit=50')
    expect(request.init.headers['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US')
  })

  it('builds gtin requests without q and maps open-box and for-parts filters with conditionIds', () => {
    const request = buildBrowseSearchRequest({
      token: 'token-2',
      browseBaseUrl: 'https://api.sandbox.ebay.com/buy/browse/v1',
      marketplaceId: 'EBAY_US',
      search: buildSearchPayload({
        mode: 'gtin',
        query: '012345678905',
        condition: 'open_box',
        resultsCondition: 'open_box',
        buyingOptions: 'auction',
        freeShipping: false,
        sort: 'ending_soon',
        limit: 10
      })
    })

    expect(request.url).toContain('https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?')
    expect(request.url).toContain('gtin=012345678905')
    expect(request.url).not.toContain('q=')
    expect(request.url).toContain('conditionIds%3A%7B1500%7D')
    expect(request.url).toContain('buyingOptions%3A%7BAUCTION%7D')
    expect(request.url).toContain('sort=endingSoonest')
    expect(mapResultsConditionToBrowseFilter('for_parts')).toBe('conditionIds:{7000}')
    expect(mapBuyingOptionsToBrowseFilter('best_offer')).toBe('buyingOptions:{BEST_OFFER}')
    expect(isConditionClose('Open box', 'open_box')).toBe(true)
  })

  it('normalizes seller, location, images, and shipping state from Browse items', () => {
    const normalized = normalizeBrowseItems(
      [
        {
          title: 'Apple iPhone 15 Pro Max 256GB Open Box',
          price: { value: '799', currency: 'USD' },
          itemWebUrl: 'https://example.com/open-box',
          itemId: 'open-box',
          condition: 'Open box',
          conditionId: '1500',
          seller: { username: 'seller-1', feedbackPercentage: '99.8' },
          image: { imageUrl: 'https://example.com/open-box.jpg' },
          thumbnailImages: [{ imageUrl: 'https://example.com/open-box-thumb.jpg' }],
          additionalImages: [{ imageUrl: 'https://example.com/open-box-extra.jpg' }],
          shippingOptions: [{ shippingCostType: 'FREE' }],
          itemLocation: {
            city: 'Los Angeles',
            stateOrProvince: 'CA',
            country: 'US',
            postalCode: '90001'
          },
          itemCreationDate: '2026-06-03T00:00:00.000Z',
          itemOriginDate: '2026-06-04T00:00:00.000Z',
          itemEndDate: '2026-06-12T00:00:00.000Z',
          buyingOptions: ['FIXED_PRICE', 'BEST_OFFER']
        },
        {
          title: 'Apple iPhone 15 Pro Max 256GB Missing Shipping',
          price: { value: '780', currency: 'USD' },
          itemWebUrl: 'https://example.com/missing-shipping',
          itemId: 'missing-shipping',
          condition: 'Used',
          conditionId: '3000',
          seller: { username: 'seller-2' }
        }
      ],
      {
        mode: 'keyword',
        query: 'iphone 15 pro max',
        condition: 'open_box'
      }
    )

    const openBox = normalized.rawListings.find((listing) => listing.itemId === 'open-box')
    const missingShipping = normalized.rawListings.find((listing) => listing.itemId === 'missing-shipping')

    expect(normalized.excludedCount).toBe(0)
    expect(openBox?.shippingKnown).toBe(true)
    expect(openBox?.shippingCost).toBe(0)
    expect(openBox?.conditionId).toBe('1500')
    expect(openBox?.sellerFeedbackPercentage).toBe(99.8)
    expect(openBox?.itemLocation).toEqual({
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '90001'
    })
    expect(openBox?.primaryImageUrl).toBe('https://example.com/open-box.jpg')
    expect(openBox?.thumbnailUrl).toBe('https://example.com/open-box-thumb.jpg')
    expect(openBox?.additionalImageUrls).toEqual(['https://example.com/open-box-extra.jpg'])
    expect(openBox?.buyingOptions).toEqual(['FIXED_PRICE', 'BEST_OFFER'])
    expect(missingShipping?.shippingKnown).toBe(false)
    expect(missingShipping?.shippingCost).toBe(0)
  })

  it('applies exclude-word, match-score, and listing-age filters and still only suggests likely matches', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T00:00:00.000Z'))

    const listings: ListingResult[] = [
      {
        title: 'Apple iPhone 15 Pro Max 256GB Unlocked',
        price: 799,
        currency: 'USD',
        shippingCost: 10,
        shippingKnown: true,
        totalPrice: 809,
        condition: 'Used',
        conditionId: '3000',
        itemUrl: 'https://example.com/good',
        itemId: 'good',
        sellerUsername: 'seller-1',
        sellerFeedbackPercentage: 99.8,
        itemLocation: null,
        matchScore: 0.91,
        primaryImageUrl: null,
        thumbnailUrl: null,
        additionalImageUrls: [],
        itemCreationDate: '2026-06-05T00:00:00.000Z',
        itemOriginDate: '2026-06-06T00:00:00.000Z',
        itemEndDate: null,
        buyingOptions: ['FIXED_PRICE']
      },
      {
        title: 'Apple iPhone 15 Pro Max case only',
        price: 19,
        currency: 'USD',
        shippingCost: 0,
        shippingKnown: true,
        totalPrice: 19,
        condition: 'New',
        conditionId: '1000',
        itemUrl: 'https://example.com/case',
        itemId: 'case',
        sellerUsername: 'seller-2',
        sellerFeedbackPercentage: null,
        itemLocation: null,
        matchScore: 0.88,
        primaryImageUrl: null,
        thumbnailUrl: null,
        additionalImageUrls: [],
        itemCreationDate: '2026-06-05T00:00:00.000Z',
        itemOriginDate: '2026-06-05T00:00:00.000Z',
        itemEndDate: null,
        buyingOptions: ['FIXED_PRICE']
      },
      {
        title: 'Apple iPhone 15 Pro Max Carrier Locked',
        price: 650,
        currency: 'USD',
        shippingCost: 10,
        shippingKnown: true,
        totalPrice: 660,
        condition: 'Used',
        conditionId: '3000',
        itemUrl: 'https://example.com/locked',
        itemId: 'locked',
        sellerUsername: 'seller-3',
        sellerFeedbackPercentage: null,
        itemLocation: null,
        matchScore: 0.93,
        primaryImageUrl: null,
        thumbnailUrl: null,
        additionalImageUrls: [],
        itemCreationDate: '2026-06-05T00:00:00.000Z',
        itemOriginDate: '2026-06-05T00:00:00.000Z',
        itemEndDate: null,
        buyingOptions: ['FIXED_PRICE']
      },
      {
        title: 'Apple iPhone 15 Pro Max Older Listing',
        price: 780,
        currency: 'USD',
        shippingCost: 10,
        shippingKnown: true,
        totalPrice: 790,
        condition: 'Used',
        conditionId: '3000',
        itemUrl: 'https://example.com/old',
        itemId: 'old',
        sellerUsername: 'seller-4',
        sellerFeedbackPercentage: null,
        itemLocation: null,
        matchScore: 0.85,
        primaryImageUrl: null,
        thumbnailUrl: null,
        additionalImageUrls: [],
        itemCreationDate: '2026-05-20T00:00:00.000Z',
        itemOriginDate: '2026-05-20T00:00:00.000Z',
        itemEndDate: null,
        buyingOptions: ['FIXED_PRICE']
      },
      {
        title: 'Apple iPhone 15 Pro Max Low Match',
        price: 775,
        currency: 'USD',
        shippingCost: 10,
        shippingKnown: true,
        totalPrice: 785,
        condition: 'Used',
        conditionId: '3000',
        itemUrl: 'https://example.com/low',
        itemId: 'low',
        sellerUsername: 'seller-5',
        sellerFeedbackPercentage: null,
        itemLocation: null,
        matchScore: 0.72,
        primaryImageUrl: null,
        thumbnailUrl: null,
        additionalImageUrls: [],
        itemCreationDate: '2026-06-05T00:00:00.000Z',
        itemOriginDate: '2026-06-05T00:00:00.000Z',
        itemEndDate: null,
        buyingOptions: ['FIXED_PRICE']
      }
    ]

    const filtered = applyListingPostFilters(listings, {
      resultsCondition: 'used',
      buyingOptions: 'buy_it_now',
      minPrice: null,
      maxPrice: null,
      freeShipping: false,
      sort: 'best_match',
      limit: 25,
      excludeWords: 'locked',
      minMatchScore: 0.8,
      listingAgeDays: 7
    })

    expect(filtered.rawListings.map((listing) => listing.itemId)).toEqual(['good'])
    expect(filtered.excludedCount).toBe(4)
    expect(getSuggestedComparisonItemIds(filtered.rawListings, 'used')).toEqual(['good'])

    vi.useRealTimers()
  })

  it('prefers item origin date for age and uses item creation date for the listed-date field', () => {
    expect(
      getListingAgeSourceDate({
        itemOriginDate: '2026-06-04T00:00:00.000Z',
        itemCreationDate: '2026-06-03T00:00:00.000Z'
      })
    ).toBe('2026-06-04T00:00:00.000Z')

    expect(
      getListingAgeSourceDate({
        itemOriginDate: null,
        itemCreationDate: '2026-06-03T00:00:00.000Z'
      })
    ).toBe('2026-06-03T00:00:00.000Z')

    expect(
      getListingAbsoluteAgeLabel({
        itemOriginDate: '2026-06-04T00:00:00.000Z',
        itemCreationDate: '2026-06-03T00:00:00.000Z'
      })
    ).toBe('Listed Jun 4, 2026')
    expect(
      getListingAgeDateLabel({
        itemOriginDate: '2026-06-04T00:00:00.000Z',
        itemCreationDate: '2026-06-03T00:00:00.000Z'
      })
    ).toBe('Jun 3, 2026')
  })

  it('returns age unavailable when no valid listing age source exists and computes relative age from a fixed now', () => {
    expect(
      getListingAbsoluteAgeLabel({
        itemOriginDate: null,
        itemCreationDate: null
      })
    ).toBe('Age unavailable')
    expect(
      getListingAgeDateLabel({
        itemOriginDate: 'not-a-date',
        itemCreationDate: null
      })
    ).toBeNull()

    expect(
      getListingRelativeAgeLabel(
        {
          itemOriginDate: '2026-06-04T00:00:00.000Z',
          itemCreationDate: '2026-06-03T00:00:00.000Z'
        },
        Date.parse('2026-06-07T00:00:00.000Z')
      )
    ).toBe('Listed 3 days ago')
    expect(
      getListingRelativeAgeLabel(
        {
          itemOriginDate: '2026-06-07T00:00:00.000Z',
          itemCreationDate: null
        },
        Date.parse('2026-06-07T12:00:00.000Z')
      )
    ).toBe('Listed today')
  })
})
