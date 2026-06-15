import Link from 'next/link'
import { DecisionBadge } from '@/components/results/DecisionBadge'
import { getRecentScans } from '@/lib/analyses'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

export default async function AnalysesPage() {
  const scans = await getRecentScans()

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <p className="eyebrow">Saved analyses</p>
        <h2>Recent deal checks</h2>
        <p className="panel__lede">
          Review completed deal analyses with their saved profit assumptions and comparison sets.
        </p>
      </section>

      {scans.length === 0 ? (
        <section className="empty-state">
          <h3>No saved analyses yet</h3>
          <p>Analyze a deal from the scanner page and it will show up here.</p>
        </section>
      ) : (
        <div className="history-grid">
          {scans.map((scan) => (
            <article key={scan.id} className="history-card panel">
              <div className="history-card__meta">
                <div>
                  <p className="eyebrow">{scan.mode.toUpperCase()}</p>
                  <h3>{scan.query}</h3>
                  <p>
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    }).format(scan.createdAt)}
                  </p>
                </div>
                <DecisionBadge decision={scan.decision as 'BUY' | 'MAYBE' | 'PASS'} />
              </div>

              <div className="history-card__metrics">
                <span>
                  <small>Store price</small>
                  <strong>{money.format(scan.storePrice)}</strong>
                </span>
                <span>
                  <small>Profit</small>
                  <strong>{money.format(scan.estimatedProfit)}</strong>
                </span>
                <span>
                  <small>ROI</small>
                  <strong>{(scan.roi * 100).toFixed(1)}%</strong>
                </span>
                <span>
                  <small>Confidence</small>
                  <strong>{scan.confidence}</strong>
                </span>
                <span>
                  <small>Range</small>
                  <strong>
                    {money.format(scan.estimatedLowPrice)} - {money.format(scan.estimatedHighPrice)}
                  </strong>
                </span>
              </div>

              <p>{scan.reason}</p>
              <Link href={`/analyses/${scan.id}`}>Open saved analysis</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
