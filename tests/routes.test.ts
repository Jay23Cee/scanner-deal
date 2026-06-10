import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { resetTokenCache } from '@/lib/ebay/auth'
import { getScanById } from '@/lib/history'
import { GET as historyGet } from '../app/api/history/route'
import { POST as analyzePost } from '../app/api/deal/analyze/route'
import { POST as searchPost } from '../app/api/ebay/search/route'

const listingExtras = {
  shippingKnown: true,
  conditionId: '3000',
  sellerFeedbackPercentage: 99.8,
  itemLocation: {
    city: 'Los Angeles',
    stateOrProvince: 'CA',
    country: 'US',
    postalCode: '90001'
  },
  primaryImageUrl: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  additionalImageUrls: ['https://example.com/extra.jpg'],
  itemCreationDate: '2026-06-01T00:00:00.000Z',
  itemOriginDate: '2026-06-02T00:00:00.000Z',
  itemEndDate: '2026-06-15T00:00:00.000Z',
  buyingOptions: ['FIXED_PRICE']
}

describe('API routes', () => {
  beforeEach(async () => {
    delete process.env.EBAY_ENV
    process.env.EBAY_CLIENT_ID = 'client-id'
    process.env.EBAY_CLIENT_SECRET = 'client-secret'
    process.env.EBAY_MARKETPLACE_ID = 'EBAY_US'
    process.env.EBAY_RU_NAME = 'test-runame'
    process.env.APP_SECRET = 'test-app-secret'
    resetTokenCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await prisma.sellerOrder.deleteMany()
    await prisma.sellerConnection.deleteMany()
    await prisma.manualSoldCompSnapshot.deleteMany()
    await prisma.listingSnapshot.deleteMany()
    await prisma.scanRecord.deleteMany()
  })

  it('returns filtered raw listings and suggested comparison ids from POST /api/ebay/search', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemSummaries: [
              {
                title: 'Apple iPhone 15 Pro Max 256GB Unlocked',
                condition: 'Used',
                conditionId: '3000',
                itemWebUrl: 'https://example.com/phone',
                itemId: 'v1|123|0',
                price: { value: '799', currency: 'USD' },
                shippingOptions: [
                  {
                    shippingCost: { value: '12', currency: 'USD' }
                  }
                ],
                seller: { username: 'seller-one', feedbackPercentage: '99.8' },
                image: { imageUrl: 'https://example.com/phone.jpg' },
                thumbnailImages: [{ imageUrl: 'https://example.com/phone-thumb.jpg' }],
                additionalImages: [{ imageUrl: 'https://example.com/phone-extra.jpg' }],
                itemLocation: {
                  city: 'Los Angeles',
                  stateOrProvince: 'CA',
                  country: 'US',
                  postalCode: '90001'
                },
                itemCreationDate: '2026-06-01T00:00:00.000Z',
                itemOriginDate: '2026-06-02T00:00:00.000Z',
                itemEndDate: '2026-06-15T00:00:00.000Z',
                buyingOptions: ['FIXED_PRICE']
              }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const response = await searchPost(
      new Request('http://localhost/api/ebay/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'keyword',
          query: 'iphone 15 pro max',
          condition: 'used'
        })
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.marketplaceId).toBe('EBAY_US')
    expect(payload.environment).toBe('production')
    expect(payload.rawListings).toHaveLength(1)
    expect(payload.suggestedComparisonItemIds).toEqual(['v1|123|0'])
    expect(payload.rawListings[0].primaryImageUrl).toBe('https://example.com/phone.jpg')
    expect(payload.rawListings[0].shippingKnown).toBe(true)
    expect(payload.rawListings[0].sellerFeedbackPercentage).toBe(99.8)
    expect(payload.rawListings[0].itemLocation).toEqual({
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '90001'
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('passes filter payload values through to the Browse search request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ itemSummaries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ itemSummaries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    vi.stubGlobal('fetch', fetchMock)

    const response = await searchPost(
      new Request('http://localhost/api/ebay/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'gtin',
          query: '012345678905',
          condition: 'open_box',
          resultsCondition: 'open_box',
          buyingOptions: 'auction',
          minPrice: 100,
          maxPrice: 300,
          freeShipping: true,
          sort: 'ending_soon',
          limit: 10,
          excludeWords: '',
          minMatchScore: null,
          listingAgeDays: null
        })
      })
    )

    expect(response.status).toBe(200)

    const browseRequestUrl = String(fetchMock.mock.calls[1]?.[0])
    expect(browseRequestUrl).toContain('gtin=012345678905')
    expect(browseRequestUrl).not.toContain('q=')
    expect(browseRequestUrl).toContain('fieldgroups=MATCHING_ITEMS%2CEXTENDED')
    expect(browseRequestUrl).toContain('conditionIds%3A%7B1500%7D')
    expect(browseRequestUrl).toContain('buyingOptions%3A%7BAUCTION%7D')
    expect(browseRequestUrl).toContain('price%3A%5B100..300%5D')
    expect(browseRequestUrl).toContain('priceCurrency%3AUSD')
    expect(browseRequestUrl).toContain('maxDeliveryCost%3A0')
    expect(browseRequestUrl).toContain('sort=endingSoonest')
    expect(browseRequestUrl).toContain('limit=10')
  })

  it('retries without the Browse condition filter when the filtered search returns zero items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ itemSummaries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            itemSummaries: [
              {
                title: 'Apple iPhone 15 Pro Max 256GB Unlocked',
                condition: 'Used',
                conditionId: '3000',
                itemWebUrl: 'https://example.com/phone',
                itemId: 'v1|123|0',
                price: { value: '799', currency: 'USD' },
                shippingOptions: [
                  {
                    shippingCost: { value: '12', currency: 'USD' }
                  }
                ],
                seller: { username: 'seller-one' }
              }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )

    vi.stubGlobal('fetch', fetchMock)

    const response = await searchPost(
      new Request('http://localhost/api/ebay/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'keyword',
          query: 'iphone 15 pro max',
          condition: 'used',
          resultsCondition: 'used'
        })
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.fallbackApplied).toBe(true)
    expect(payload.rawListings).toHaveLength(1)
    expect(payload.fallbackReason).toContain('retried without that Browse condition filter')
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('filter=conditions%3A%7BUSED%7D')
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain('filter=conditions%3A%7BUSED%7D')
  })

  it('returns eBay configuration mismatch errors from POST /api/ebay/search', async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'JacksonC-ScannerD-SBX-app-id'
    process.env.EBAY_CLIENT_SECRET = 'SBX-client-secret'
    const fetchMock = vi.fn()

    vi.stubGlobal('fetch', fetchMock)

    const response = await searchPost(
      new Request('http://localhost/api/ebay/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'keyword',
          query: 'iphone 15 pro max',
          condition: 'used'
        })
      })
    )

    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toContain('EBAY_ENV is set to production')
    expect(payload.error).toContain('Sandbox keys')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('persists manually selected comparison listings and exposes enriched detail through history', async () => {
    const response = await analyzePost(
      new Request('http://localhost/api/deal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'keyword',
          query: 'iphone 15 pro max',
          condition: 'used',
          storePrice: 300,
          sellerShippingCost: 10,
          feeRate: 0.15,
          packagingCost: 2,
          promotedListingCost: 0,
          safetyBuffer: 5,
          targetProfit: 20,
          excludedCount: 2,
          manualSoldComps: [
            {
              title: 'iPhone 15 Pro Max sold comp',
              soldPrice: 760,
              shippingCost: 15,
              condition: 'Used',
              soldDate: '2026-06-03',
              notes: 'Clean sale with box'
            },
            {
              title: '',
              soldPrice: null,
              shippingCost: null,
              condition: '',
              soldDate: null,
              notes: ''
            }
          ],
          comparisonListings: [
            {
              title: 'Apple iPhone 15 Pro Max 256GB Unlocked',
              price: 780,
              currency: 'USD',
              shippingCost: 10,
              totalPrice: 790,
              condition: 'Used',
              itemUrl: 'https://example.com/1',
              itemId: '1',
              sellerUsername: 'seller-1',
              matchScore: 0.92,
              ...listingExtras
            },
            {
              title: 'Apple iPhone 15 Pro Max 256GB Carrier Unlocked',
              price: 815,
              currency: 'USD',
              shippingCost: 12,
              totalPrice: 827,
              condition: 'Used',
              itemUrl: 'https://example.com/2',
              itemId: '2',
              sellerUsername: 'seller-2',
              matchScore: 0.84,
              ...listingExtras
            },
            {
              title: 'Apple iPhone 15 Pro Max 256GB Good Battery',
              price: 830,
              currency: 'USD',
              shippingCost: 0,
              totalPrice: 830,
              condition: 'Used',
              itemUrl: 'https://example.com/3',
              itemId: '3',
              sellerUsername: 'seller-3',
              matchScore: 0.82,
              ...listingExtras
            },
            {
              title: 'Apple iPhone 15 Pro Max 256GB Clean',
              price: 800,
              currency: 'USD',
              shippingCost: 5,
              totalPrice: 805,
              condition: 'Used',
              itemUrl: 'https://example.com/4',
              itemId: '4',
              sellerUsername: 'seller-4',
              matchScore: 0.88,
              ...listingExtras
            },
            {
              title: 'Apple iPhone 15 Pro Max 256GB',
              price: 820,
              currency: 'USD',
              shippingCost: 0,
              totalPrice: 820,
              condition: 'Used',
              itemUrl: 'https://example.com/5',
              itemId: '5',
              sellerUsername: 'seller-5',
              matchScore: 0.86,
              ...listingExtras
            }
          ]
        })
      })
    )

    const payload = await response.json()
    const scanCount = await prisma.scanRecord.count()
    const listingCount = await prisma.listingSnapshot.count()
    const manualSoldCompCount = await prisma.manualSoldCompSnapshot.count()
    const storedListing = await prisma.listingSnapshot.findFirstOrThrow({
      orderBy: {
        matchScore: 'desc'
      }
    })
    const storedManualSoldComp = await prisma.manualSoldCompSnapshot.findFirstOrThrow()

    expect(response.status).toBe(200)
    expect(payload.scanId).toBeTruthy()
    expect(scanCount).toBe(1)
    expect(listingCount).toBe(5)
    expect(manualSoldCompCount).toBe(1)
    expect(storedListing.primaryImageUrl).toBe('https://example.com/image.jpg')
    expect(storedListing.additionalImageUrls).toEqual(['https://example.com/extra.jpg'])
    expect(storedListing.buyingOptions).toEqual(['FIXED_PRICE'])
    expect(storedListing.shippingKnown).toBe(true)
    expect(storedListing.conditionId).toBe('3000')
    expect(storedListing.sellerFeedbackPercentage).toBe(99.8)
    expect(storedListing.itemLocation).toEqual({
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '90001'
    })
    expect(storedManualSoldComp.title).toBe('iPhone 15 Pro Max sold comp')
    expect(storedManualSoldComp.soldPrice).toBe(760)
    expect(storedManualSoldComp.shippingCost).toBe(15)
    expect(storedManualSoldComp.conditionLabel).toBe('Used')
    expect(storedManualSoldComp.soldDate).toBe('2026-06-03')
    expect(storedManualSoldComp.notes).toBe('Clean sale with box')

    const scanDetail = await getScanById(payload.scanId)

    expect(scanDetail?.listings).toHaveLength(5)
    expect(scanDetail?.manualSoldComps).toEqual([
      {
        title: 'iPhone 15 Pro Max sold comp',
        soldPrice: 760,
        shippingCost: 15,
        condition: 'Used',
        soldDate: '2026-06-03',
        notes: 'Clean sale with box'
      }
    ])
    expect(scanDetail?.listings[0]?.shippingKnown).toBe(true)
    expect(scanDetail?.listings[0]?.conditionId).toBe('3000')
    expect(scanDetail?.listings[0]?.sellerFeedbackPercentage).toBe(99.8)
    expect(scanDetail?.listings[0]?.itemLocation).toEqual({
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '90001'
    })

    const historyResponse = await historyGet()
    const historyPayload = await historyResponse.json()

    expect(historyResponse.status).toBe(200)
    expect(historyPayload.scans).toHaveLength(1)
    expect(historyPayload.scans[0].query).toBe('iphone 15 pro max')
  })
})
