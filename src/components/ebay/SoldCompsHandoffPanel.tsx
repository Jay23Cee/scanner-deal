'use client'

import { useState } from 'react'

export type SoldCompsHandoffPlatform = 'android_chrome' | 'mobile_manual' | 'desktop'

type SoldCompsHandoffPanelProps = {
  query: string
  ebayUrl: string
  platform: SoldCompsHandoffPlatform
  chromeIntentUrl: string | null
}

type CopyStatus = 'idle' | 'success' | 'error'

export function SoldCompsHandoffPanel({
  query,
  ebayUrl,
  platform,
  chromeIntentUrl
}: SoldCompsHandoffPanelProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  async function handleCopy() {
    if (!navigator.clipboard?.writeText) {
      setCopyStatus('error')
      return
    }

    try {
      await navigator.clipboard.writeText(ebayUrl)
      setCopyStatus('success')
    } catch {
      setCopyStatus('error')
    }
  }

  const isAndroidChrome = platform === 'android_chrome'
  const isMobileManual = platform === 'mobile_manual'
  const isDesktop = platform === 'desktop'
  const copyButtonClassName = isMobileManual ? 'button' : 'button button--ghost'

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <p className="eyebrow">Browser-first handoff</p>
        <h2>Open sold comps in the browser</h2>
        <p className="panel__lede">
          {isAndroidChrome
            ? 'Android app links can jump straight into the eBay app. Open this search through Chrome first, or copy the full URL below if you need a manual browser path.'
            : isMobileManual
              ? 'Mobile devices can still route direct eBay links into the eBay app. Copy this URL and paste it into your browser first, then use the fallback link only if you want to try a direct handoff.'
              : 'Continue to eBay from here, or copy the sold-search URL if you want to move it into another browser tab manually.'}
        </p>

        <div className="analysis-grid history-detail-grid">
          <div>
            <span>Sold search query</span>
            <strong>{query}</strong>
          </div>
        </div>

        <div className="actions" style={{ marginTop: '1rem' }}>
          {isAndroidChrome && chromeIntentUrl ? (
            <a href={chromeIntentUrl} className="button">
              Open in Chrome
            </a>
          ) : null}

          {isDesktop ? (
            <a href={ebayUrl} className="button">
              Continue to eBay
            </a>
          ) : null}

          <button type="button" className={copyButtonClassName} onClick={() => void handleCopy()}>
            Copy eBay URL
          </button>

          {!isDesktop ? (
            <a href={ebayUrl} className="button button--ghost">
              Try direct eBay link
            </a>
          ) : null}
        </div>

        {copyStatus === 'success' ? (
          <p className="status-banner" role="status" aria-live="polite">
            {isDesktop
              ? 'Link copied. Paste it into another browser tab if you want to reopen the sold search manually.'
              : 'Link copied. Paste it into your browser if the direct eBay handoff still opens the app.'}
          </p>
        ) : null}

        {copyStatus === 'error' ? (
          <p className="status-banner" role="status" aria-live="polite">
            Copy failed. Use the field below to copy the full eBay URL manually into your browser.
          </p>
        ) : null}

        <div className="form-grid">
          <label className="form-grid__wide">
            Full eBay URL
            <textarea
              readOnly
              rows={3}
              value={ebayUrl}
              onFocus={(event) => event.currentTarget.select()}
              onClick={(event) => event.currentTarget.select()}
            />
          </label>
        </div>
      </section>
    </div>
  )
}
