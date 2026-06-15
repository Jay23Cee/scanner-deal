import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ListingCard } from '@/components/results/ListingCard'
import { ManualSoldCompList } from '@/components/results/ManualSoldCompList'
import { ProfitPanel } from '@/components/results/ProfitPanel'
import { getScanById } from '@/lib/analyses'
import { buildSoldCompsHandoffPath } from '@/lib/ebayLinks'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

export default async function AnalysisDetailPage({
  params
}: {
  params: Promise<{ scanId: string }>
}) {
  const { scanId } = await params
  const scan = await getScanById(scanId)

  if (!scan) {
    notFound()
  }

  const savedSoldSearchQuery = scan.soldSearchQuery?.trim() || scan.query

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Saved analysis detail</p>
            <h2>{scan.query}</h2>
            <p className="panel__lede">
              {scan.mode.toUpperCase()} / {scan.selectedCondition.replace('_', ' ')} /{' '}
              {new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
                scan.createdAt
              )}
            </p>
          </div>
          <Link href="/analyses" className="button button--ghost">
            Back to analyses
          </Link>
        </div>

        <div className="quick-metrics">
          <span>Store price: {money.format(scan.storePrice)}</span>
          <span>Excluded: {scan.excludedCount}</span>
          <span>Listings saved: {scan.listings.length}</span>
        </div>
      </section>

      <ProfitPanel
        analysis={{
          scanId: scan.id,
          decision: scan.decision,
          estimatedLowPrice: scan.estimatedLowPrice,
          estimatedMedianPrice: scan.estimatedMedianPrice,
          estimatedHighPrice: scan.estimatedHighPrice,
          suggestedListPrice: scan.suggestedListPrice,
          estimatedProfit: scan.estimatedProfit,
          roi: scan.roi,
          confidence: scan.confidence,
          reason: scan.reason,
          listingCount: scan.listingCount
        }}
      />

      <section className="panel">
        <p className="eyebrow">Assumptions used</p>
        <h2>Saved analysis inputs</h2>

        <div className="analysis-grid history-detail-grid">
          <div>
            <span>Seller shipping</span>
            <strong>{money.format(scan.sellerShippingCost)}</strong>
          </div>
          <div>
            <span>Fee rate</span>
            <strong>{(scan.feeRate * 100).toFixed(0)}%</strong>
          </div>
          <div>
            <span>Packaging</span>
            <strong>{money.format(scan.packagingCost)}</strong>
          </div>
          <div>
            <span>Promoted listing</span>
            <strong>{money.format(scan.promotedListingCost)}</strong>
          </div>
          <div>
            <span>Safety buffer</span>
            <strong>{money.format(scan.safetyBuffer)}</strong>
          </div>
          <div>
            <span>Target profit</span>
            <strong>{money.format(scan.targetProfit)}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Saved sold search</p>
            <h2>Sold-comps handoff</h2>
            <p className="panel__lede">
              Reopen the exact sold-search query that was saved with this analysis snapshot.
            </p>
          </div>
          <a
            href={buildSoldCompsHandoffPath(savedSoldSearchQuery)}
            target="_blank"
            rel="noopener noreferrer"
            className="button"
          >
            Open Sold Comps
          </a>
        </div>

        <div className="analysis-grid history-detail-grid">
          <div>
            <span>Saved search query</span>
            <strong>{savedSoldSearchQuery}</strong>
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Manual sold comps</p>
            <h2>Saved sold-comp notes</h2>
          </div>
          <div className="status-chip">{scan.manualSoldComps.length} saved</div>
        </div>

        <ManualSoldCompList manualSoldComps={scan.manualSoldComps} />
      </section>

      <section className="stack">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Saved listing set</p>
            <h2>Listings used for this analysis</h2>
          </div>
          <div className="status-chip">{scan.listings.length} listings</div>
        </div>

        {scan.listings.length === 0 ? (
          <section className="empty-state">
            <h3>No listings saved</h3>
            <p>This scan does not have persisted listing details.</p>
          </section>
        ) : (
          <div className="listing-grid">
            {scan.listings.map((listing) => (
              <ListingCard key={`${scan.id}-${listing.itemId}-${listing.title}`} listing={listing} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
