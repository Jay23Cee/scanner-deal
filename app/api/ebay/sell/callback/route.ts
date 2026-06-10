import { NextResponse } from 'next/server'
import { SELLER_STATE_COOKIE, readCookieValue, validateSellerAuthState } from '@/lib/ebay/seller-state'
import { connectSellerAccountFromCode } from '@/lib/orders'

export const runtime = 'nodejs'

function buildOrdersRedirect(baseUrl: string, params: { status?: string; error?: string }) {
  const url = new URL('/orders', baseUrl)
  if (params.status) {
    url.searchParams.set('status', params.status)
  }

  if (params.error) {
    url.searchParams.set('error', params.error)
  }
  return url
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const stateFromCookie = readCookieValue(request.headers.get('cookie'), SELLER_STATE_COOKIE)
  const stateFromQuery = url.searchParams.get('state')

  const redirect = (params: { status?: string; error?: string }) => {
    const response = NextResponse.redirect(buildOrdersRedirect(request.url, params))
    response.cookies.set({
      name: SELLER_STATE_COOKIE,
      value: '',
      httpOnly: true,
      maxAge: 0,
      path: '/api/ebay/sell',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })
    return response
  }

  if (!validateSellerAuthState(stateFromCookie, stateFromQuery)) {
    return redirect({ error: 'The seller authorization state check failed. Start the connection flow again.' })
  }

  const callbackError = url.searchParams.get('error_description') ?? url.searchParams.get('error')
  if (callbackError) {
    return redirect({ error: callbackError })
  }

  const code = url.searchParams.get('code')
  if (!code) {
    return redirect({ error: 'The eBay callback did not include an authorization code.' })
  }

  try {
    await connectSellerAccountFromCode(code)
    return redirect({ status: 'connected' })
  } catch (error) {
    return redirect({
      error: error instanceof Error ? error.message : 'The seller authorization callback failed.'
    })
  }
}
