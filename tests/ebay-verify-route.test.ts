import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resetTokenCache } from '@/lib/ebay/auth'
import { GET as verifyGet } from '../app/api/ebay/verify/route'

describe('GET /api/ebay/verify', () => {
  beforeEach(() => {
    process.env.EBAY_MARKETPLACE_ID = 'EBAY_US'
    resetTokenCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('verifies production keyword, gtin, and picture search availability', async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'example-PRD-client-id'
    process.env.EBAY_CLIENT_SECRET = 'example-PRD-client-secret'

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await verifyGet()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      environment: 'production',
      marketplaceId: 'EBAY_US',
      tokenVerified: true,
      searchModes: {
        keyword: true,
        gtin: true,
        picture: true
      },
      pictureSearchReason: null
    })
    expect(payload.browseBaseUrl).toBe('https://api.ebay.com/buy/browse/v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('verifies sandbox keyword and gtin while reporting picture search as unavailable', async () => {
    process.env.EBAY_ENV = 'sandbox'
    process.env.EBAY_SANDBOX_CLIENT_ID = 'example-SBX-client-id'
    process.env.EBAY_SANDBOX_CLIENT_SECRET = 'example-SBX-client-secret'

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await verifyGet()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toMatchObject({
      ok: true,
      environment: 'sandbox',
      tokenVerified: true,
      searchModes: {
        keyword: true,
        gtin: true,
        picture: false
      }
    })
    expect(payload.pictureSearchReason).toContain('requires EBAY_ENV=production')
    expect(payload.browseBaseUrl).toBe('https://api.sandbox.ebay.com/buy/browse/v1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces configuration mismatch errors clearly', async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'JacksonC-ScannerD-SBX-app-id'
    process.env.EBAY_CLIENT_SECRET = 'SBX-client-secret'

    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await verifyGet()
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.ok).toBe(false)
    expect(payload.error).toContain('EBAY_ENV is set to production')
    expect(payload.error).toContain('Sandbox keys')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
