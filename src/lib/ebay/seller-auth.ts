import { EbayApiError, getEbayBaseConfig, parseEbayErrorPayload } from '@/lib/ebay/auth'
import { SellerOrderFulfillmentFilter, SellerOrderSyncFilters } from '@/lib/types'

type FetchLike = typeof fetch

const SELL_FULFILLMENT_READONLY_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
const ORDER_PAGE_SIZE = 50

type RawOrderSearchResponse = {
  orders?: unknown[]
  next?: string
  total?: number
}

export interface SellerOAuthConfig {
  environment: 'production' | 'sandbox'
  tokenUrl: string
  sellFulfillmentBaseUrl: string
  consentUrl: string
  clientId: string
  clientSecret: string
  ruName: string
}

export interface SellerTokenResponse {
  accessToken: string
  accessTokenExpiresAt: Date
  refreshToken: string | null
  refreshTokenExpiresAt: Date | null
  scope: string
}

function buildBasicAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
}

export function getSellerOAuthConfig(): SellerOAuthConfig {
  const baseConfig = getEbayBaseConfig()
  const ruName = process.env.EBAY_RU_NAME?.trim()
  if (!ruName) {
    throw new EbayApiError('Missing required environment variable(s): EBAY_RU_NAME.', 500)
  }

  return {
    environment: baseConfig.environment,
    tokenUrl: baseConfig.tokenUrl,
    sellFulfillmentBaseUrl: baseConfig.sellFulfillmentBaseUrl,
    consentUrl: baseConfig.consentUrl,
    clientId: baseConfig.clientId,
    clientSecret: baseConfig.clientSecret,
    ruName
  }
}

export function buildSellerConsentUrl(input: { state: string; promptLogin?: boolean }) {
  const config = getSellerOAuthConfig()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.ruName,
    response_type: 'code',
    scope: SELL_FULFILLMENT_READONLY_SCOPE,
    state: input.state
  })

  if (input.promptLogin) {
    params.set('prompt', 'login')
  }

  return `${config.consentUrl}?${params.toString()}`
}

export function buildSellerAuthCodeRequest(code: string) {
  const config = getSellerOAuthConfig()

  return {
    url: config.tokenUrl,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: buildBasicAuthHeader(config.clientId, config.clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.ruName
      }),
      cache: 'no-store' as const
    }
  }
}

export function buildSellerRefreshTokenRequest(refreshToken: string) {
  const config = getSellerOAuthConfig()

  return {
    url: config.tokenUrl,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: buildBasicAuthHeader(config.clientId, config.clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: SELL_FULFILLMENT_READONLY_SCOPE
      }),
      cache: 'no-store' as const
    }
  }
}

function parseTokenPayload(payload: unknown, fallbackRefreshToken: string | null): SellerTokenResponse {
  if (!payload || typeof payload !== 'object') {
    throw new EbayApiError('eBay OAuth token response did not include access_token.', 502)
  }

  const tokenPayload = payload as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
    scope?: string
  }

  if (typeof tokenPayload.access_token !== 'string') {
    throw new EbayApiError('eBay OAuth token response did not include access_token.', 502)
  }

  const expiresIn = typeof tokenPayload.expires_in === 'number' ? tokenPayload.expires_in : 7200
  const refreshToken = typeof tokenPayload.refresh_token === 'string' ? tokenPayload.refresh_token : fallbackRefreshToken
  const refreshTokenExpiresIn =
    typeof tokenPayload.refresh_token_expires_in === 'number' ? tokenPayload.refresh_token_expires_in : null

  return {
    accessToken: tokenPayload.access_token,
    accessTokenExpiresAt: new Date(Date.now() + Math.max(60, expiresIn - 60) * 1000),
    refreshToken,
    refreshTokenExpiresAt:
      refreshToken && refreshTokenExpiresIn !== null
        ? new Date(Date.now() + Math.max(60, refreshTokenExpiresIn - 60) * 1000)
        : null,
    scope:
      typeof tokenPayload.scope === 'string' && tokenPayload.scope.trim().length > 0
        ? tokenPayload.scope.trim()
        : SELL_FULFILLMENT_READONLY_SCOPE
  }
}

async function executeTokenRequest(
  request: { url: string; init: RequestInit },
  fetchImpl: FetchLike,
  fallbackRefreshToken: string | null
) {
  let response: Response
  try {
    response = await fetchImpl(request.url, request.init)
  } catch (error) {
    throw new EbayApiError(
      `Failed to request an eBay user token: ${error instanceof Error ? error.message : 'unknown network error'}.`,
      502
    )
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail = parseEbayErrorPayload(payload) ?? `HTTP ${response.status}`
    throw new EbayApiError(`eBay user token request failed (${response.status}): ${detail}.`, response.status)
  }

  return parseTokenPayload(payload, fallbackRefreshToken)
}

export function exchangeSellerCodeForTokens(code: string, fetchImpl: FetchLike = fetch) {
  return executeTokenRequest(buildSellerAuthCodeRequest(code), fetchImpl, null)
}

export function refreshSellerAccessToken(refreshToken: string, fetchImpl: FetchLike = fetch) {
  return executeTokenRequest(buildSellerRefreshTokenRequest(refreshToken), fetchImpl, refreshToken)
}

function toFilterRange(dateOnly: string, boundary: 'start' | 'end') {
  return boundary === 'start' ? `${dateOnly}T00:00:00.000Z` : `${dateOnly}T23:59:59.999Z`
}

function mapFulfillmentStatusFilter(value: SellerOrderFulfillmentFilter) {
  if (value === 'NOT_STARTED') {
    return 'orderfulfillmentstatus:{NOT_STARTED|IN_PROGRESS}'
  }

  if (value === 'FULFILLED') {
    return 'orderfulfillmentstatus:{FULFILLED|IN_PROGRESS}'
  }

  return null
}

export function buildSellerOrderFilter(filters: SellerOrderSyncFilters) {
  const parts = [`creationdate:[${toFilterRange(filters.startDate, 'start')}..${toFilterRange(filters.endDate, 'end')}]`]
  const mappedStatus = mapFulfillmentStatusFilter(filters.fulfillmentStatus)
  if (mappedStatus) {
    parts.push(mappedStatus)
  }

  return parts.join(',')
}

export function buildGetOrdersRequest(input: {
  accessToken: string
  filters: SellerOrderSyncFilters
  limit?: number
  offset?: number
  nextUrl?: string
}) {
  const config = getSellerOAuthConfig()
  const url =
    input.nextUrl ??
    `${config.sellFulfillmentBaseUrl}/order?${new URLSearchParams({
      filter: buildSellerOrderFilter(input.filters),
      limit: String(input.limit ?? ORDER_PAGE_SIZE),
      offset: String(input.offset ?? 0)
    }).toString()}`

  return {
    url,
    init: {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.accessToken}`
      },
      cache: 'no-store' as const
    }
  }
}

async function fetchOrdersPage(
  request: ReturnType<typeof buildGetOrdersRequest>,
  fetchImpl: FetchLike
): Promise<RawOrderSearchResponse> {
  let response: Response
  try {
    response = await fetchImpl(request.url, request.init)
  } catch (error) {
    throw new EbayApiError(
      `Failed to call eBay Fulfillment getOrders: ${
        error instanceof Error ? error.message : 'unknown network error'
      }.`,
      502
    )
  }

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail = parseEbayErrorPayload(payload) ?? `HTTP ${response.status}`
    const hint =
      response.status === 401
        ? ' The stored seller token was rejected by eBay.'
        : response.status === 429
          ? ' eBay rate limited the request. Try again shortly.'
          : ''
    throw new EbayApiError(`eBay Fulfillment getOrders failed (${response.status}): ${detail}.${hint}`, response.status)
  }

  if (!payload || typeof payload !== 'object') {
    return {}
  }

  return payload as RawOrderSearchResponse
}

export async function fetchSellerOrders(
  accessToken: string,
  filters: SellerOrderSyncFilters,
  fetchImpl: FetchLike = fetch
) {
  const collected: unknown[] = []
  let nextUrl: string | null = null
  let offset = 0

  while (true) {
    const page = await fetchOrdersPage(
      buildGetOrdersRequest({
        accessToken,
        filters,
        limit: ORDER_PAGE_SIZE,
        offset,
        nextUrl: nextUrl ?? undefined
      }),
      fetchImpl
    )

    const orders = Array.isArray(page.orders) ? page.orders : []
    collected.push(...orders)

    if (typeof page.next === 'string' && page.next.trim().length > 0) {
      nextUrl = page.next
      offset += ORDER_PAGE_SIZE
      continue
    }

    if (typeof page.total === 'number' && collected.length < page.total && orders.length > 0) {
      offset += ORDER_PAGE_SIZE
      continue
    }

    if (orders.length === ORDER_PAGE_SIZE) {
      offset += ORDER_PAGE_SIZE
      continue
    }

    break
  }

  return collected
}

export { ORDER_PAGE_SIZE, SELL_FULFILLMENT_READONLY_SCOPE }
