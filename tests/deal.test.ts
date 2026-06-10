import { describe, expect, it } from 'vitest'
import { calculateDealMetrics } from '@/lib/deal/calculator'
import { evaluateDeal } from '@/lib/deal/scoring'
import { ListingResult } from '@/lib/types'

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
} satisfies Pick<
  ListingResult,
  | 'shippingKnown'
  | 'conditionId'
  | 'sellerFeedbackPercentage'
  | 'itemLocation'
  | 'primaryImageUrl'
  | 'thumbnailUrl'
  | 'additionalImageUrls'
  | 'itemCreationDate'
  | 'itemOriginDate'
  | 'itemEndDate'
  | 'buyingOptions'
>

const listings: ListingResult[] = [
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
    title: 'Apple iPhone 15 Pro Max 256GB Clean',
    price: 800,
    currency: 'USD',
    shippingCost: 5,
    totalPrice: 805,
    condition: 'Used',
    itemUrl: 'https://example.com/2',
    itemId: '2',
    sellerUsername: 'seller-2',
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
    itemUrl: 'https://example.com/3',
    itemId: '3',
    sellerUsername: 'seller-3',
    matchScore: 0.86,
    ...listingExtras
  },
  {
    title: 'Apple iPhone 15 Pro Max 256GB Carrier Unlocked',
    price: 815,
    currency: 'USD',
    shippingCost: 12,
    totalPrice: 827,
    condition: 'Used',
    itemUrl: 'https://example.com/4',
    itemId: '4',
    sellerUsername: 'seller-4',
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
    itemUrl: 'https://example.com/5',
    itemId: '5',
    sellerUsername: 'seller-5',
    matchScore: 0.82,
    ...listingExtras
  }
]

describe('deal scoring', () => {
  it('produces a BUY result for strong profit and ROI', () => {
    const metrics = calculateDealMetrics({
      mode: 'keyword',
      condition: 'used',
      storePrice: 300,
      sellerShippingCost: 10,
      feeRate: 0.15,
      packagingCost: 2,
      promotedListingCost: 0,
      safetyBuffer: 5,
      targetProfit: 20,
      listings
    })

    const verdict = evaluateDeal(metrics, {
      mode: 'keyword',
      condition: 'used',
      targetProfit: 20
    })

    expect(metrics.estimatedProfit).toBeGreaterThan(20)
    expect(metrics.roi).toBeGreaterThan(0.4)
    expect(verdict.decision).toBe('BUY')
    expect(verdict.confidence).not.toBe('LOW')
  })

  it('caps open-box confidence when too few close matches exist', () => {
    const metrics = calculateDealMetrics({
      mode: 'gtin',
      condition: 'open_box',
      storePrice: 200,
      sellerShippingCost: 5,
      feeRate: 0.12,
      packagingCost: 1,
      promotedListingCost: 0,
      safetyBuffer: 3,
      targetProfit: 20,
      listings: [
        {
          ...listings[0],
          condition: 'Open box',
          conditionId: '1500'
        },
        {
          ...listings[1],
          condition: 'Used',
          itemId: '6'
        },
        {
          ...listings[2],
          condition: 'Used',
          itemId: '7'
        },
        {
          ...listings[3],
          condition: 'Used',
          itemId: '8'
        },
        {
          ...listings[4],
          condition: 'Used',
          itemId: '9'
        }
      ]
    })

    const verdict = evaluateDeal(metrics, {
      mode: 'gtin',
      condition: 'open_box',
      targetProfit: 20
    })

    expect(metrics.conditionCloseCount).toBe(1)
    expect(verdict.confidence).toBe('MEDIUM')
  })
})
