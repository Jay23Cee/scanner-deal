import Link from 'next/link'
import { buildSoldCompsHandoffPath } from '@/lib/ebayLinks'
import { getRecentSearchLogs } from '@/lib/history'

function formatStatus(status: 'success' | 'error') {
  return status === 'error' ? 'Error' : 'Saved'
}

export default async function HistoryPage() {
  const searches = await getRecentSearchLogs()

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <p className="eyebrow">Search history</p>
        <h2>Recent keyword and GTIN searches</h2>
        <p className="panel__lede">
          Each search stores summary-only metadata with no images and no saved listing payloads.
        </p>
      </section>

      {searches.length === 0 ? (
        <section className="empty-state">
          <h3>No saved searches yet</h3>
          <p>Run a keyword or GTIN search from the scanner page and it will show up here.</p>
        </section>
      ) : (
        <div className="history-grid">
          {searches.map((search) => (
            <article key={search.id} className="history-card panel">
              <div className="history-card__meta">
                <div>
                  <p className="eyebrow">{search.mode.toUpperCase()}</p>
                  <h3>{search.query}</h3>
                  <p>
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(search.createdAt)}
                  </p>
                </div>
                <div className="status-chip">{formatStatus(search.status)}</div>
              </div>

              <div className="history-card__metrics">
                <span>
                  <small>Condition</small>
                  <strong>{search.selectedCondition.replace('_', ' ')}</strong>
                </span>
                <span>
                  <small>Results</small>
                  <strong>{search.totalReturned ?? 0}</strong>
                </span>
                <span>
                  <small>Excluded</small>
                  <strong>{search.excludedCount ?? 0}</strong>
                </span>
                <span>
                  <small>Fallback</small>
                  <strong>{search.fallbackApplied ? 'Yes' : 'No'}</strong>
                </span>
              </div>

              <p>{search.errorMessage ?? 'Search summary saved successfully.'}</p>
              <div className="actions">
                <a
                  href={buildSoldCompsHandoffPath(search.query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                >
                  Open Sold Comps
                </a>
                <Link href={`/history/${search.id}`} className="button button--ghost">
                  Open saved search
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
