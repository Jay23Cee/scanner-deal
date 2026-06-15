import { describe, expect, it } from 'vitest'
import { deriveEbaySoldSearchQuery, buildEbaySoldUrl } from '@/lib/ebay/sold'

describe('eBay sold listing helpers', () => {
  it('builds the sold/completed eBay URL with an encoded query', () => {
    expect(buildEbaySoldUrl('sony wh-1000xm4')).toBe(
      'https://www.ebay.com/sch/i.html?_nkw=sony+wh-1000xm4&_ipg=120&LH_Sold=1&LH_Complete=1'
    )
  })

  it('uses the original search text for keyword searches', () => {
    expect(
      deriveEbaySoldSearchQuery({
        mode: 'keyword',
        query: '  iphone 15 pro max  ',
        rawListings: []
      })
    ).toBe('iphone 15 pro max')
  })

  it('uses the first returned listing title for GTIN searches', () => {
    expect(
      deriveEbaySoldSearchQuery({
        mode: 'gtin',
        query: '012345678905',
        rawListings: [
          {
            title: 'Sony WH-1000XM4 Noise Canceling Headphones',
            price: 199,
            currency: 'USD',
            shippingCost: 0,
            shippingKnown: true,
            totalPrice: 199,
            condition: 'Used',
            conditionId: '3000',
            itemUrl: 'https://example.com/item',
            itemId: 'item-1',
            sellerUsername: 'seller-one',
            sellerFeedbackPercentage: 99.9,
            itemLocation: null,
            matchScore: 0.95,
            primaryImageUrl: null,
            thumbnailUrl: null,
            additionalImageUrls: [],
            itemCreationDate: null,
            itemOriginDate: null,
            itemEndDate: null,
            buyingOptions: []
          }
        ]
      })
    ).toBe('Sony WH-1000XM4 Noise Canceling Headphones')
  })

  it('falls back to the raw GTIN when no listing titles are available', () => {
    expect(
      deriveEbaySoldSearchQuery({
        mode: 'gtin',
        query: '012345678905',
        rawListings: []
      })
    ).toBe('012345678905')
  })
})
