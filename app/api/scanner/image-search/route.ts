import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { EbayApiError } from '@/lib/ebay/auth'
import {
  DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE,
  searchImageSession
} from '@/lib/image-search/provider'
import { itemConditionSchema } from '@/lib/validation'

export const runtime = 'nodejs'
export const IMAGE_SEARCH_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024

function getImageFile(formData: FormData) {
  const image = formData.get('image')

  return image instanceof File ? image : null
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const image = getImageFile(formData)

    if (!image) {
      return NextResponse.json({ error: 'Upload an image file to search.' }, { status: 400 })
    }

    const condition = itemConditionSchema.parse(formData.get('condition'))

    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are supported.' }, { status: 400 })
    }

    if (image.size === 0) {
      return NextResponse.json({ error: 'The uploaded image is empty.' }, { status: 400 })
    }

    if (image.size > IMAGE_SEARCH_MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'The uploaded image is too large. Use a file smaller than 5 MB.' },
        { status: 413 }
      )
    }

    const arrayBuffer = await image.arrayBuffer()
    const payload = await searchImageSession({
      imageBase64: Buffer.from(arrayBuffer).toString('base64'),
      condition
    })

    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Invalid image search request.' },
        { status: 400 }
      )
    }

    if (error instanceof EbayApiError) {
      return NextResponse.json(
        {
          error: error.message,
          fallbackMessage: DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE
        },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Image search failed.',
        fallbackMessage: DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE
      },
      { status: 500 }
    )
  }
}
