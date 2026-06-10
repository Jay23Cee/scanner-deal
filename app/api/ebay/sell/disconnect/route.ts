import { NextResponse } from 'next/server'
import { disconnectSellerAccount, getSellerConnectionState } from '@/lib/orders'

export const runtime = 'nodejs'

export async function POST() {
  try {
    await disconnectSellerAccount()

    return NextResponse.json({
      connection: await getSellerConnectionState(),
      orders: []
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect the seller account.' },
      { status: 500 }
    )
  }
}
