import type { Metadata } from 'next'
import { headers } from 'next/headers'
import {
  SoldCompsHandoffPanel,
  type SoldCompsHandoffPlatform
} from '@/components/ebay/SoldCompsHandoffPanel'
import {
  buildAndroidChromeIntentUrl,
  buildEbaySoldCompsUrl,
  buildSoldCompsHandoffPath,
  cleanEbayQuery,
  type SoldCompsHandoffMode
} from '@/lib/ebayLinks'

export const metadata: Metadata = {
  title: 'Sold Comps Handoff',
  description: 'Browser-first handoff for sold/completed eBay search results.',
  robots: {
    index: false,
    follow: false
  }
}

function parseMode(value: string | string[] | undefined): SoldCompsHandoffMode {
  return value === 'manual' ? 'manual' : 'auto'
}

function detectSoldCompsPlatform(
  userAgent: string,
  mode: SoldCompsHandoffMode
): SoldCompsHandoffPlatform {
  const normalizedUserAgent = userAgent.toLowerCase()
  const isAndroid = normalizedUserAgent.includes('android')
  const isAppleMobile = /iphone|ipad|ipod/i.test(userAgent)
  const isMobile = isAndroid || isAppleMobile || normalizedUserAgent.includes('mobile')

  if (mode === 'manual' && isMobile) {
    return 'mobile_manual'
  }

  const isAndroidChrome =
    isAndroid &&
    normalizedUserAgent.includes('chrome/') &&
    !normalizedUserAgent.includes('edga/') &&
    !normalizedUserAgent.includes('samsungbrowser/') &&
    !normalizedUserAgent.includes('firefox/') &&
    !normalizedUserAgent.includes('opr/')

  if (isAndroidChrome) {
    return 'android_chrome'
  }

  if (isMobile) {
    return 'mobile_manual'
  }

  return 'desktop'
}

function buildRequestOrigin(
  hostValue: string | null,
  forwardedProtoValue: string | null
): string | null {
  const host = hostValue?.split(',')[0]?.trim() || null

  if (!host) {
    return null
  }

  const protocol = forwardedProtoValue?.split(',')[0]?.trim() || 'http'
  return `${protocol}://${host}`
}

export default async function SoldCompsHandoffPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const requestHeaders = await headers()
  const rawQuery = Array.isArray(params.query) ? params.query[0] ?? '' : params.query ?? ''
  const mode = parseMode(params.mode)
  const cleanQuery = cleanEbayQuery(rawQuery)

  if (cleanQuery.length === 0) {
    return (
      <div className="stack stack--xl">
        <section className="empty-state">
          <p className="eyebrow">Browser-first handoff</p>
          <h2>Sold comps handoff unavailable</h2>
          <p>There is no sold-search query available to open right now. Start again from the scanner.</p>
          <div className="actions">
            <a href="/scanner" className="button button--ghost">
              Back to Scanner
            </a>
          </div>
        </section>
      </div>
    )
  }

  const ebayUrl = buildEbaySoldCompsUrl(cleanQuery)
  const platform = detectSoldCompsPlatform(requestHeaders.get('user-agent') ?? '', mode)
  const manualFallbackPath = buildSoldCompsHandoffPath(cleanQuery, 'manual')
  const requestOrigin = buildRequestOrigin(
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'),
    requestHeaders.get('x-forwarded-proto')
  )
  const manualFallbackUrl = requestOrigin ? `${requestOrigin}${manualFallbackPath}` : manualFallbackPath
  const chromeIntentUrl =
    platform === 'android_chrome'
      ? buildAndroidChromeIntentUrl(ebayUrl, manualFallbackUrl)
      : null

  return (
    <SoldCompsHandoffPanel
      query={cleanQuery}
      ebayUrl={ebayUrl}
      platform={platform}
      chromeIntentUrl={chromeIntentUrl}
    />
  )
}
