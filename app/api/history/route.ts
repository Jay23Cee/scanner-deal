import { NextResponse } from 'next/server'
import { getRecentSearchLogs } from '@/lib/history'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const searches = await getRecentSearchLogs()
    return NextResponse.json({ searches })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'History failed.' }, { status: 500 })
  }
}
