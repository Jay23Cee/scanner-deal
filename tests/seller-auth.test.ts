import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildSellerAuthCodeRequest,
  buildSellerConsentUrl,
  buildSellerRefreshTokenRequest
} from '@/lib/ebay/seller-auth'
import { createSellerAuthState, readCookieValue, validateSellerAuthState } from '@/lib/ebay/seller-state'
import { decryptString, encryptString } from '@/lib/security'

describe('seller auth helpers', () => {
  beforeEach(() => {
    process.env.EBAY_ENV = 'sandbox'
    process.env.EBAY_SANDBOX_CLIENT_ID = 'JacksonC-ScannerD-SBX-app-id'
    process.env.EBAY_SANDBOX_CLIENT_SECRET = 'SBX-client-secret'
    process.env.EBAY_RU_NAME = 'scanner-runame'
    process.env.APP_SECRET = 'test-app-secret'
  })

  it('builds the eBay seller consent URL for the current environment', () => {
    const url = new URL(buildSellerConsentUrl({ state: 'state-123' }))

    expect(url.origin).toBe('https://auth.sandbox.ebay.com')
    expect(url.searchParams.get('client_id')).toBe('JacksonC-ScannerD-SBX-app-id')
    expect(url.searchParams.get('redirect_uri')).toBe('scanner-runame')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('scope')).toContain('sell.fulfillment.readonly')
  })

  it('builds the authorization-code token exchange request', () => {
    const request = buildSellerAuthCodeRequest('code-123')

    expect(request.url).toBe('https://api.sandbox.ebay.com/identity/v1/oauth2/token')
    expect(request.init.method).toBe('POST')
    expect(String(request.init.body)).toContain('grant_type=authorization_code')
    expect(String(request.init.body)).toContain('code=code-123')
    expect(String(request.init.body)).toContain('redirect_uri=scanner-runame')
  })

  it('builds the refresh-token request', () => {
    const request = buildSellerRefreshTokenRequest('refresh-123')

    expect(request.url).toBe('https://api.sandbox.ebay.com/identity/v1/oauth2/token')
    expect(String(request.init.body)).toContain('grant_type=refresh_token')
    expect(String(request.init.body)).toContain('refresh_token=refresh-123')
    expect(String(request.init.body)).toContain('sell.fulfillment.readonly')
  })

  it('validates auth state values and reads them from cookies', () => {
    const state = createSellerAuthState()

    expect(state.length).toBeGreaterThan(20)
    expect(readCookieValue(`foo=bar; ebay_sell_state=${encodeURIComponent(state)}`, 'ebay_sell_state')).toBe(state)
    expect(validateSellerAuthState(state, state)).toBe(true)
    expect(validateSellerAuthState(state, 'mismatch')).toBe(false)
  })

  it('encrypts and decrypts persisted tokens', () => {
    const encrypted = encryptString('access-token-123')

    expect(encrypted).not.toContain('access-token-123')
    expect(decryptString(encrypted)).toBe('access-token-123')
  })
})
