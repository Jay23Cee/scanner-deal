'use client'

import { FormEvent, useEffect, useState } from 'react'
import { defaultScannerSettings, loadScannerSettings, saveScannerSettings } from '@/lib/settings'

export default function SettingsPage() {
  const [sellerShippingCost, setSellerShippingCost] = useState(defaultScannerSettings.sellerShippingCost)
  const [feeRate, setFeeRate] = useState(defaultScannerSettings.feeRate)
  const [packagingCost, setPackagingCost] = useState(defaultScannerSettings.packagingCost)
  const [promotedListingCost, setPromotedListingCost] = useState(defaultScannerSettings.promotedListingCost)
  const [safetyBuffer, setSafetyBuffer] = useState(defaultScannerSettings.safetyBuffer)
  const [targetProfit, setTargetProfit] = useState(defaultScannerSettings.targetProfit)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const settings = loadScannerSettings()
    setSellerShippingCost(settings.sellerShippingCost)
    setFeeRate(settings.feeRate)
    setPackagingCost(settings.packagingCost)
    setPromotedListingCost(settings.promotedListingCost)
    setSafetyBuffer(settings.safetyBuffer)
    setTargetProfit(settings.targetProfit)
  }, [])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    saveScannerSettings({
      sellerShippingCost,
      feeRate,
      packagingCost,
      promotedListingCost,
      safetyBuffer,
      targetProfit
    })
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <section className="panel settings-form">
      <p className="eyebrow">Local defaults</p>
      <h2>Scanner assumptions</h2>
      <p className="panel__lede">
        These values stay in your browser and prefill the scanner page.
      </p>

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Seller shipping cost
          <input type="number" min="0" step="0.01" value={sellerShippingCost} onChange={(event) => setSellerShippingCost(Number(event.target.value))} />
        </label>

        <label>
          Fee rate
          <input type="number" min="0" max="1" step="0.01" value={feeRate} onChange={(event) => setFeeRate(Number(event.target.value))} />
        </label>

        <label>
          Packaging cost
          <input type="number" min="0" step="0.01" value={packagingCost} onChange={(event) => setPackagingCost(Number(event.target.value))} />
        </label>

        <label>
          Promoted listing cost
          <input type="number" min="0" step="0.01" value={promotedListingCost} onChange={(event) => setPromotedListingCost(Number(event.target.value))} />
        </label>

        <label>
          Safety buffer
          <input type="number" min="0" step="0.01" value={safetyBuffer} onChange={(event) => setSafetyBuffer(Number(event.target.value))} />
        </label>

        <label>
          Target profit
          <input type="number" min="0" step="0.01" value={targetProfit} onChange={(event) => setTargetProfit(Number(event.target.value))} />
        </label>

        <div className="actions">
          <button type="submit" className="button button--accent">
            Save settings
          </button>
          {saved ? <span className="status-chip">Saved</span> : null}
        </div>
      </form>
    </section>
  )
}

