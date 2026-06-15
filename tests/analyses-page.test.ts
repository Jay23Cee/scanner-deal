import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/client'
import { buildSoldCompsHandoffPath } from '@/lib/ebayLinks'
import AnalysisDetailPage from '../app/analyses/[scanId]/page'

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;')
}

async function createSavedScan(overrides: { query?: string; soldSearchQuery?: string | null } = {}) {
  return prisma.scanRecord.create({
    data: {
      mode: 'keyword',
      query: overrides.query ?? 'iphone 15 pro max',
      soldSearchQuery:
        overrides.soldSearchQuery === undefined ? 'iphone 15 pro max 256gb unlocked' : overrides.soldSearchQuery,
      selectedCondition: 'used',
      storePrice: 300,
      sellerShippingCost: 10,
      feeRate: 0.15,
      packagingCost: 2,
      promotedListingCost: 0,
      safetyBuffer: 5,
      targetProfit: 20,
      estimatedLowPrice: 760,
      estimatedMedianPrice: 800,
      estimatedHighPrice: 840,
      suggestedListPrice: 819.99,
      estimatedProfit: 90,
      roi: 0.3,
      confidence: 'HIGH',
      decision: 'BUY',
      reason: 'Strong spread between cost and sold comps.',
      listingCount: 5,
      excludedCount: 1
    }
  })
}

describe('analysis detail page', () => {
  beforeEach(async () => {
    await prisma.manualSoldCompSnapshot.deleteMany()
    await prisma.listingSnapshot.deleteMany()
    await prisma.scanRecord.deleteMany()
  })

  it('renders the saved sold-search query and sold-comps link', async () => {
    const scan = await createSavedScan()

    const page = await AnalysisDetailPage({
      params: Promise.resolve({ scanId: scan.id })
    })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Saved sold search')
    expect(markup).toContain('iphone 15 pro max 256gb unlocked')
    expect(markup).toContain(
      escapeAttribute(buildSoldCompsHandoffPath('iphone 15 pro max 256gb unlocked'))
    )
    expect(markup).toContain('Open Sold Comps')
  })

  it('falls back to the original scan query when older analyses have no saved sold-search query', async () => {
    const scan = await createSavedScan({
      query: 'sony wh-1000xm4',
      soldSearchQuery: null
    })

    const page = await AnalysisDetailPage({
      params: Promise.resolve({ scanId: scan.id })
    })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Saved sold search')
    expect(markup).toContain('sony wh-1000xm4')
    expect(markup).toContain(escapeAttribute(buildSoldCompsHandoffPath('sony wh-1000xm4')))
  })
})
