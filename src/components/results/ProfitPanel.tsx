import { DealAnalysisPayload } from '@/lib/types'
import { DecisionBadge } from '@/components/results/DecisionBadge'

function currency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value)
}

export function ProfitPanel({ analysis }: { analysis: DealAnalysisPayload }) {
  return (
    <section className="panel panel--accent">
      <div className="analysis-header">
        <div>
          <p className="eyebrow">Deal verdict</p>
          <h2>Profit snapshot</h2>
        </div>
        <DecisionBadge decision={analysis.decision} />
      </div>

      <div className="analysis-grid">
        <div>
          <span>Estimated low</span>
          <strong>{currency(analysis.estimatedLowPrice)}</strong>
        </div>
        <div>
          <span>Median</span>
          <strong>{currency(analysis.estimatedMedianPrice)}</strong>
        </div>
        <div>
          <span>Estimated high</span>
          <strong>{currency(analysis.estimatedHighPrice)}</strong>
        </div>
        <div>
          <span>Suggested list</span>
          <strong>{currency(analysis.suggestedListPrice)}</strong>
        </div>
        <div>
          <span>Estimated profit</span>
          <strong>{currency(analysis.estimatedProfit)}</strong>
        </div>
        <div>
          <span>ROI</span>
          <strong>{(analysis.roi * 100).toFixed(1)}%</strong>
        </div>
        <div>
          <span>Confidence</span>
          <strong>{analysis.confidence}</strong>
        </div>
        <div>
          <span>Usable listings</span>
          <strong>{analysis.listingCount}</strong>
        </div>
      </div>

      <p className="analysis-reason">{analysis.reason}</p>
    </section>
  )
}

