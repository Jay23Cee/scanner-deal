import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/client'
import { buildSoldCompsHandoffPath } from '@/lib/ebayLinks'
import HistoryPage from '../app/history/page'
import SearchHistoryDetailPage from '../app/history/[searchId]/page'

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;')
}

async function createSearchLog(query = 'iphone 15 pro max') {
  return prisma.searchLog.create({
    data: {
      status: 'success',
      mode: 'keyword',
      query,
      selectedCondition: 'used',
      resultsCondition: 'any',
      buyingOptions: 'any',
      minPrice: null,
      maxPrice: null,
      freeShipping: false,
      sort: 'best_match',
      limit: 25,
      excludeWords: '',
      minMatchScore: null,
      listingAgeDays: null,
      marketplaceId: 'EBAY_US',
      environment: 'production',
      totalReturned: 12,
      excludedCount: 2,
      fallbackApplied: false,
      fallbackReason: null,
      errorMessage: null
    }
  })
}

describe('history pages', () => {
  beforeEach(async () => {
    await prisma.searchLog.deleteMany()
  })

  it('renders a sold comps button for saved searches on the history list page', async () => {
    await createSearchLog('sony wh-1000xm4')

    const page = await HistoryPage()
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Open Sold Comps')
    expect(markup).toContain(escapeAttribute(buildSoldCompsHandoffPath('sony wh-1000xm4')))
  })

  it('renders a sold comps button for an individual saved search', async () => {
    const search = await createSearchLog('ti 84 plus ce')

    const page = await SearchHistoryDetailPage({
      params: Promise.resolve({ searchId: search.id })
    })
    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('Open Sold Comps')
    expect(markup).toContain(escapeAttribute(buildSoldCompsHandoffPath('ti 84 plus ce')))
    expect(markup).toContain('Saved search detail')
  })
})
