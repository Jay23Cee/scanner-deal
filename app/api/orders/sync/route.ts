import { NextResponse } from 'next/server'
import { EbayApiError } from '@/lib/ebay/auth'
import { syncSellerOrders } from '@/lib/orders'
import { sellerOrderSyncFiltersSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = sellerOrderSyncFiltersSchema.parse(await request.json().catch(() => ({})))
    const payload = await syncSellerOrders(body)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof EbayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Invalid order sync filters.' }, { status: 400 })
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Order sync failed.' },
      { status: 500 }
    )
  }
}
