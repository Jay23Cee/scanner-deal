import { NextResponse } from 'next/server'
import { buildSellerConsentUrl } from '@/lib/ebay/seller-auth'
import { createSellerAuthState, SELLER_STATE_COOKIE } from '@/lib/ebay/seller-state'
import { getSellerConnectionState } from '@/lib/orders'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const connectionState = await getSellerConnectionState()
    if (!connectionState.isConfigured) {
      return NextResponse.json(
        {
          error: `Missing required environment variable(s): ${connectionState.missingConfiguration.join(', ')}.`
        },
        { status: 500 }
      )
    }

    const state = createSellerAuthState()
    const response = NextResponse.redirect(buildSellerConsentUrl({ state }))
    response.cookies.set({
      name: SELLER_STATE_COOKIE,
      value: state,
      httpOnly: true,
      maxAge: 600,
      path: '/api/ebay/sell',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start the seller consent flow.' },
      { status: 500 }
    )
  }
}
