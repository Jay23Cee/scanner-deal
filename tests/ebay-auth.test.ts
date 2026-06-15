import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildOAuthRequest,
  getAppAccessToken,
  getEbayServerConfig,
  resetTokenCache
} from '@/lib/ebay/auth'

describe('eBay auth', () => {
  beforeEach(() => {
    delete process.env.EBAY_ENV
    process.env.EBAY_CLIENT_ID = 'client-id'
    process.env.EBAY_CLIENT_SECRET = 'client-secret'
    delete process.env.EBAY_SANDBOX_CLIENT_ID
    delete process.env.EBAY_SANDBOX_CLIENT_SECRET
    process.env.EBAY_MARKETPLACE_ID = 'EBAY_US'
    resetTokenCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('defaults EBAY_ENV to production and uses the production OAuth URL', () => {
    const config = getEbayServerConfig()
    const request = buildOAuthRequest(config)

    expect(config.environment).toBe('production')
    expect(config.tokenUrl).toBe('https://api.ebay.com/identity/v1/oauth2/token')
    expect(config.browseBaseUrl).toBe('https://api.ebay.com/buy/browse/v1')
    expect(request.url).toBe('https://api.ebay.com/identity/v1/oauth2/token')
  })

  it('uses the sandbox OAuth URL when EBAY_ENV=sandbox', async () => {
    process.env.EBAY_ENV = 'sandbox'
    process.env.EBAY_SANDBOX_CLIENT_ID = 'JacksonC-ScannerD-SBX-app-id'
    process.env.EBAY_SANDBOX_CLIENT_SECRET = 'SBX-client-secret'

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'token-123', expires_in: 7200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const token = await getAppAccessToken(fetchMock as typeof fetch)

    expect(token).toBe('token-123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.sandbox.ebay.com/identity/v1/oauth2/token')
    expect((init as RequestInit).method).toBe('POST')
    expect((init as RequestInit).headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    })
    expect(String((init as RequestInit).body)).toContain('grant_type=client_credentials')
    expect(String((init as RequestInit).body)).toContain('scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope')
  })

  it('fails fast when sandbox credentials are configured for production', async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'JacksonC-ScannerD-SBX-app-id'
    process.env.EBAY_CLIENT_SECRET = 'SBX-client-secret'
    const fetchMock = vi.fn()

    await expect(getAppAccessToken(fetchMock as typeof fetch)).rejects.toThrow(
      'EBAY_ENV is set to production, but the configured eBay credentials look like Sandbox keys.'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails fast when production-looking credentials are configured for sandbox', async () => {
    process.env.EBAY_ENV = 'sandbox'
    process.env.EBAY_SANDBOX_CLIENT_ID = 'PRD-client-id'
    process.env.EBAY_SANDBOX_CLIENT_SECRET = 'PROD-client-secret'
    const fetchMock = vi.fn()

    await expect(getAppAccessToken(fetchMock as typeof fetch)).rejects.toThrow(
      'EBAY_ENV is set to sandbox, but the configured eBay credentials look like Production keys.'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces missing sandbox environment variables clearly', async () => {
    process.env.EBAY_ENV = 'sandbox'
    delete process.env.EBAY_SANDBOX_CLIENT_ID
    delete process.env.EBAY_SANDBOX_CLIENT_SECRET

    await expect(getAppAccessToken(vi.fn() as typeof fetch)).rejects.toThrow(
      'Missing required environment variable(s): EBAY_SANDBOX_CLIENT_ID, EBAY_SANDBOX_CLIENT_SECRET.'
    )
  })

  it('surfaces missing environment variables clearly', async () => {
    delete process.env.EBAY_CLIENT_ID

    await expect(getAppAccessToken(vi.fn() as typeof fetch)).rejects.toThrow(
      'Missing required environment variable(s): EBAY_CLIENT_ID.'
    )
  })
})
