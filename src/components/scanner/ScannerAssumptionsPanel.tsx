'use client'

import { useState } from 'react'
import { currency } from '@/components/scanner/scannerShared'

type ScannerAssumptionsPanelProps = {
  sellerShippingCost: number
  feeRate: number
  packagingCost: number
  promotedListingCost: number
  safetyBuffer: number
  targetProfit: number
  onSellerShippingCostChange: (value: number) => void
  onFeeRateChange: (value: number) => void
  onPackagingCostChange: (value: number) => void
  onPromotedListingCostChange: (value: number) => void
  onSafetyBufferChange: (value: number) => void
  onTargetProfitChange: (value: number) => void
}

export function ScannerAssumptionsPanel({
  sellerShippingCost,
  feeRate,
  packagingCost,
  promotedListingCost,
  safetyBuffer,
  targetProfit,
  onSellerShippingCostChange,
  onFeeRateChange,
  onPackagingCostChange,
  onPromotedListingCostChange,
  onSafetyBufferChange,
  onTargetProfitChange
}: ScannerAssumptionsPanelProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="panel assumptions-panel">
      <button
        type="button"
        className="assumptions-panel__toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <div>
          <p className="eyebrow">Shared defaults</p>
          <h2>Compact assumptions summary</h2>
          <p className="panel__lede">
            Keep your pricing inputs available without taking over the scanner flow.
          </p>
        </div>

        <div className="assumptions-panel__summary">
          <span>Target: {currency.format(targetProfit)}</span>
          <span>Fees: {(feeRate * 100).toFixed(0)}%</span>
          <span>Ship: {currency.format(sellerShippingCost)}</span>
          <span>Buffer: {currency.format(safetyBuffer)}</span>
        </div>
      </button>

      {expanded ? (
        <div className="stack assumptions-panel__body">
          <div className="form-grid">
            <label>
              Seller shipping cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellerShippingCost}
                onChange={(event) => onSellerShippingCostChange(Number(event.target.value))}
              />
            </label>

            <label>
              Fee rate
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={feeRate}
                onChange={(event) => onFeeRateChange(Number(event.target.value))}
              />
            </label>

            <label>
              Packaging cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={packagingCost}
                onChange={(event) => onPackagingCostChange(Number(event.target.value))}
              />
            </label>

            <label>
              Promoted listing cost
              <input
                type="number"
                min="0"
                step="0.01"
                value={promotedListingCost}
                onChange={(event) => onPromotedListingCostChange(Number(event.target.value))}
              />
            </label>

            <label>
              Safety buffer
              <input
                type="number"
                min="0"
                step="0.01"
                value={safetyBuffer}
                onChange={(event) => onSafetyBufferChange(Number(event.target.value))}
              />
            </label>

            <label>
              Target profit
              <input
                type="number"
                min="0"
                step="0.01"
                value={targetProfit}
                onChange={(event) => onTargetProfitChange(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="quick-metrics">
            <span>Packaging: {currency.format(packagingCost)}</span>
            <span>Promoted: {currency.format(promotedListingCost)}</span>
            <span>Loaded from local browser defaults</span>
          </div>
        </div>
      ) : null}
    </section>
  )
}
