import { NextResponse } from 'next/server'
import { EbayApiError, getAppAccessToken, getEbayServerConfig } from '@/lib/ebay/auth'

export const runtime = 'nodejs'

const SANDBOX_PICTURE_SEARCH_REASON =
  'Picture search requires EBAY_ENV=production because eBay searchByImage is not supported in sandbox.'

export async function GET() {
  try {
    const config = getEbayServerConfig()
    await getAppAccessToken()

    return NextResponse.json({
      ok: true,
      environment: config.environment,
      marketplaceId: config.marketplaceId,
      browseBaseUrl: config.browseBaseUrl,
      tokenVerified: true,
      searchModes: {
        keyword: true,
        gtin: true,
        picture: config.environment === 'production'
      },
      pictureSearchReason:
        config.environment === 'production' ? null : SANDBOX_PICTURE_SEARCH_REASON
    })
  } catch (error) {
    if (error instanceof EbayApiError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'eBay verification failed.'
      },
      { status: 500 }
    )
  }
}
