import { NextResponse } from 'next/server'
import { getRecentScans } from '@/lib/history'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const scans = await getRecentScans()
    return NextResponse.json({ scans })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'History failed.' }, { status: 500 })
  }
}
