import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../src/lib/db/client'
import { resetTokenCache } from '../src/lib/ebay/auth'
import {
  DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE,
  IMAGE_SEARCH_RESULT_LIMIT
} from '../src/lib/image-search/provider'
import {
  IMAGE_SEARCH_MAX_FILE_SIZE_BYTES,
  POST as imageSearchPost
} from '../app/api/scanner/image-search/route'

describe('POST /api/scanner/image-search', () => {
  beforeEach(async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'example-PRD-client-id'
    process.env.EBAY_CLIENT_SECRET = 'example-PRD-client-secret'
    process.env.EBAY_MARKETPLACE_ID = 'EBAY_US'
    resetTokenCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await prisma.searchLog.deleteMany()
  })

  it('rejects a missing image upload', async () => {
    const formData = new FormData()
    formData.append('condition', 'used')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain('Upload an image file')
  })

  it('rejects non-image uploads', async () => {
    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob(['plain text'], { type: 'text/plain' }), 'note.txt')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toContain('Only image uploads are supported')
  })

  it('rejects oversized image uploads', async () => {
    const largeImageBytes = new Uint8Array(IMAGE_SEARCH_MAX_FILE_SIZE_BYTES + 1)
    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob([largeImageBytes], { type: 'image/png' }), 'oversized.png')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(413)
    expect(payload.error).toContain('too large')
  })

  it('returns a consistent configuration error when eBay credentials are missing', async () => {
    delete process.env.EBAY_CLIENT_ID

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob(['image-bytes'], { type: 'image/png' }), 'photo.png')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe('Missing required environment variable(s): EBAY_CLIENT_ID.')
    expect(payload.fallbackMessage).toBe(DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE)
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('rejects sandbox because eBay searchByImage is production-only', async () => {
    process.env.EBAY_ENV = 'sandbox'
    process.env.EBAY_SANDBOX_CLIENT_ID = 'example-SBX-client-id'
    process.env.EBAY_SANDBOX_CLIENT_SECRET = 'example-SBX-client-secret'

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob(['image-bytes'], { type: 'image/png' }), 'photo.png')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload.error).toBe(
      'Picture search requires EBAY_ENV=production because eBay searchByImage is not supported in sandbox.'
    )
    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('builds a ready image session from eBay image-search results', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/identity/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (url.includes('/item_summary/search_by_image')) {
        return new Response(
          JSON.stringify({
            itemSummaries: [
              {
                title: ' Texas Instruments TI 84 Plus CE Graphing Calculator Black!!! ',
                condition: 'Used',
                conditionId: '3000',
                itemWebUrl: 'https://www.ebay.com/itm/1',
                itemId: '1',
                price: { value: '79.99', currency: 'USD' },
                shippingOptions: [{ shippingCostType: 'FREE' }],
                buyingOptions: ['FIXED_PRICE'],
                image: { imageUrl: 'https://example.com/image.jpg' }
              }
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob(['image-bytes'], { type: 'image/png' }), 'photo.png')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.detectedTitle).toBe('Texas Instruments TI 84 Plus CE Graphing Calculator Black')
    expect(payload.session).toMatchObject({
      mode: 'keyword',
      query: 'Texas Instruments TI 84 Plus CE Graphing Calculator Black',
      environment: 'production',
      marketplaceId: 'EBAY_US',
      totalReturned: 1,
      fallbackApplied: false
    })
    expect(payload.session.rawListings[0]).toMatchObject({
      itemId: '1'
    })
    expect(await prisma.searchLog.count()).toBe(0)

    const imageSearchRequest = fetchMock.mock.calls.find((call) => {
      const url =
        typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url
      return url.includes('/item_summary/search_by_image')
    })
    const imageSearchUrl = new URL(
      typeof imageSearchRequest?.[0] === 'string'
        ? imageSearchRequest[0]
        : imageSearchRequest?.[0] instanceof URL
          ? imageSearchRequest[0].toString()
          : imageSearchRequest?.[0].url ?? 'https://example.com'
    )
    const requestBody = JSON.parse(String(imageSearchRequest?.[1]?.body))
    const requestHeaders = imageSearchRequest?.[1]?.headers as Record<string, string> | undefined

    expect(imageSearchUrl.searchParams.get('limit')).toBe(String(IMAGE_SEARCH_RESULT_LIMIT))
    expect(imageSearchUrl.searchParams.get('filter')).toBe('conditions:{USED}')
    expect(requestBody.image).toBe(Buffer.from('image-bytes').toString('base64'))
    expect(requestHeaders?.['X-EBAY-C-MARKETPLACE-ID']).toBe('EBAY_US')
  })

  it('returns a fallback payload when no usable image matches are found', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/identity/v1/oauth2/token')) {
        return new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (url.includes('/item_summary/search_by_image')) {
        return new Response(JSON.stringify({ itemSummaries: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const formData = new FormData()
    formData.append('condition', 'used')
    formData.append('image', new Blob(['image-bytes'], { type: 'image/webp' }), 'photo.webp')

    const response = await imageSearchPost(
      new Request('http://localhost/api/scanner/image-search', {
        method: 'POST',
        body: formData
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.detectedTitle).toBe('')
    expect(payload.session).toBeNull()
    expect(payload.fallbackMessage).toBe(DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
