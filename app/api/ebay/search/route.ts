import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { EbayApiError } from '@/lib/ebay/auth'
import { searchBrowseListings } from '@/lib/ebay/search'
import { searchRequestSchema } from '@/lib/validation'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = searchRequestSchema.parse(await request.json())
    const payload = await searchBrowseListings(body)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? 'Invalid request body.' }, { status: 400 })
    }

    if (error instanceof EbayApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed.' }, { status: 500 })
  }
}

