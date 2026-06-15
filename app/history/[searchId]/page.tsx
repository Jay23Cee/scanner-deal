import Link from 'next/link'
import { notFound } from 'next/navigation'
import { buildSoldCompsHandoffPath } from '@/lib/ebayLinks'
import {
  getBuyingFormatLabel,
  getListingAgeLabel,
  getMinMatchLabel,
  getResultsConditionLabel,
  getSortOptionLabel
} from '@/lib/search-filters'
import { getSearchLogById } from '@/lib/history'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

function formatStatus(status: 'success' | 'error') {
  return status === 'error' ? 'Error' : 'Saved'
}

function formatConditionLabel(condition: string) {
  return condition.replace('_', ' ')
}

function formatOptionalMoney(value: number | null) {
  return value === null ? 'Any' : money.format(value)
}

export default async function SearchHistoryDetailPage({
  params
}: {
  params: Promise<{ searchId: string }>
}) {
  const { searchId } = await params
  const search = await getSearchLogById(searchId)

  if (!search) {
    notFound()
  }

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Saved search detail</p>
            <h2>{search.query}</h2>
            <p className="panel__lede">
              {search.mode.toUpperCase()} / {formatConditionLabel(search.selectedCondition)} /{' '}
              {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                search.createdAt
              )}
            </p>
          </div>
          <div className="actions">
            <a
              href={buildSoldCompsHandoffPath(search.query)}
              target="_blank"
              rel="noopener noreferrer"
              className="button"
            >
              Open Sold Comps
            </a>
            <Link href="/history" className="button button--ghost">
              Back to searches
            </Link>
          </div>
        </div>

        <div className="quick-metrics">
          <span>Status: {formatStatus(search.status)}</span>
          <span>Results: {search.totalReturned ?? 0}</span>
          <span>Excluded: {search.excludedCount ?? 0}</span>
          <span>Fallback applied: {search.fallbackApplied ? 'Yes' : 'No'}</span>
        </div>
      </section>

      {search.errorMessage ? <div className="error-banner">{search.errorMessage}</div> : null}
      {search.fallbackReason ? (
        <section className="diagnostics-card">
          <p>{search.fallbackReason}</p>
        </section>
      ) : null}

      <section className="panel">
        <p className="eyebrow">Search settings</p>
        <h2>Filters and request summary</h2>

        <div className="analysis-grid history-detail-grid">
          <div>
            <span>Condition</span>
            <strong>{formatConditionLabel(search.selectedCondition)}</strong>
          </div>
          <div>
            <span>Results condition</span>
            <strong>{getResultsConditionLabel(search.resultsCondition)}</strong>
          </div>
          <div>
            <span>Buying format</span>
            <strong>{getBuyingFormatLabel(search.buyingOptions)}</strong>
          </div>
          <div>
            <span>Sort</span>
            <strong>{getSortOptionLabel(search.sort)}</strong>
          </div>
          <div>
            <span>Price range</span>
            <strong>
              {formatOptionalMoney(search.minPrice)} - {formatOptionalMoney(search.maxPrice)}
            </strong>
          </div>
          <div>
            <span>Free shipping</span>
            <strong>{search.freeShipping ? 'Yes' : 'No'}</strong>
          </div>
          <div>
            <span>Match score</span>
            <strong>{getMinMatchLabel(search.minMatchScore)}</strong>
          </div>
          <div>
            <span>Listing age</span>
            <strong>{getListingAgeLabel(search.listingAgeDays)}</strong>
          </div>
          <div>
            <span>Result limit</span>
            <strong>{search.limit}</strong>
          </div>
          <div>
            <span>Marketplace</span>
            <strong>{search.marketplaceId ?? 'Not available'}</strong>
          </div>
          <div>
            <span>Environment</span>
            <strong>{search.environment ?? 'Not available'}</strong>
          </div>
          <div>
            <span>Exclude words</span>
            <strong>{search.excludeWords.trim() || 'None'}</strong>
          </div>
        </div>
      </section>
    </div>
  )
}
