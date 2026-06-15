const BROWSE_SCOPE = 'https://api.ebay.com/oauth/api_scope'

function buildEbayEnvironmentConfig(input: {
  apiBaseUrl: string
  authBaseUrl: string
  clientIdEnvVar: string
  clientSecretEnvVar: string
}) {
  return {
    apiBaseUrl: input.apiBaseUrl,
    tokenUrl: `${input.apiBaseUrl}/identity/v1/oauth2/token`,
    browseBaseUrl: `${input.apiBaseUrl}/buy/browse/v1`,
    sellFulfillmentBaseUrl: `${input.apiBaseUrl}/sell/fulfillment/v1`,
    consentUrl: `${input.authBaseUrl}/oauth2/authorize`,
    clientIdEnvVar: input.clientIdEnvVar,
    clientSecretEnvVar: input.clientSecretEnvVar
  }
}

const EBAY_ENVIRONMENTS = {
  production: buildEbayEnvironmentConfig({
    apiBaseUrl: 'https://api.ebay.com',
    authBaseUrl: 'https://auth.ebay.com',
    clientIdEnvVar: 'EBAY_CLIENT_ID',
    clientSecretEnvVar: 'EBAY_CLIENT_SECRET'
  }),
  sandbox: buildEbayEnvironmentConfig({
    apiBaseUrl: 'https://api.sandbox.ebay.com',
    authBaseUrl: 'https://auth.sandbox.ebay.com',
    clientIdEnvVar: 'EBAY_SANDBOX_CLIENT_ID',
    clientSecretEnvVar: 'EBAY_SANDBOX_CLIENT_SECRET'
  })
} as const
const SANDBOX_KEY_PATTERN = /(^|[-_])SBX(?=$|[-_])/i
const PRODUCTION_KEY_PATTERNS = [/(^|[-_])PRD(?=$|[-_])/i, /(^|[-_])PROD(?=$|[-_])/i] as const

type FetchLike = typeof fetch
export type EbayEnvironment = keyof typeof EBAY_ENVIRONMENTS

let cachedToken: { key: string; value: string; expiresAt: number } | null = null

export class EbayApiError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'EbayApiError'
    this.status = status
  }
}

export interface EbayServerConfig {
  environment: EbayEnvironment
  apiBaseUrl: string
  tokenUrl: string
  browseBaseUrl: string
  sellFulfillmentBaseUrl: string
  consentUrl: string
  clientId: string
  clientSecret: string
  marketplaceId: string
}

export function getCurrentEbayEnvironment(rawValue: string | undefined = process.env.EBAY_ENV): EbayEnvironment {
  const normalized = rawValue?.trim().toLowerCase()
  if (!normalized) {
    return 'production'
  }

  if (normalized === 'production' || normalized === 'sandbox') {
    return normalized
  }

  throw new EbayApiError(
    `Unsupported EBAY_ENV value "${rawValue}". Use "production" or "sandbox".`,
    500
  )
}

function formatEnvironmentLabel(environment: EbayEnvironment) {
  return environment === 'production' ? 'Production' : 'Sandbox'
}

function detectCredentialEnvironment(value: string): EbayEnvironment | null {
  if (SANDBOX_KEY_PATTERN.test(value)) {
    return 'sandbox'
  }

  if (PRODUCTION_KEY_PATTERNS.some((pattern) => pattern.test(value))) {
    return 'production'
  }

  return null
}

function validateCredentialEnvironment(input: {
  environment: EbayEnvironment
  clientIdVarName: string
  clientSecretVarName: string
  clientId: string
  clientSecret: string
}) {
  const clientIdEnvironment = detectCredentialEnvironment(input.clientId)
  const clientSecretEnvironment = detectCredentialEnvironment(input.clientSecret)

  if (
    clientIdEnvironment &&
    clientSecretEnvironment &&
    clientIdEnvironment !== clientSecretEnvironment
  ) {
    throw new EbayApiError(
      `${input.clientIdVarName} and ${input.clientSecretVarName} appear to come from different eBay environments. Use App ID and Cert ID from the same Application Keys environment.`,
      500
    )
  }

  const detectedEnvironment = clientIdEnvironment ?? clientSecretEnvironment
  if (!detectedEnvironment || detectedEnvironment === input.environment) {
    return
  }

  const detectedLabel = formatEnvironmentLabel(detectedEnvironment)
  const expectedLabel = formatEnvironmentLabel(input.environment)
  throw new EbayApiError(
    `EBAY_ENV is set to ${input.environment}, but the configured eBay credentials look like ${detectedLabel} keys. Use ${expectedLabel} App ID and Cert ID with EBAY_ENV=${input.environment}, or switch EBAY_ENV to ${detectedEnvironment}.`,
    500
  )
}

export function getEbayServerConfig(): EbayServerConfig {
  const baseConfig = getEbayBaseConfig()
  const marketplaceId = process.env.EBAY_MARKETPLACE_ID?.trim()
  if (!marketplaceId) {
    throw new EbayApiError('Missing required environment variable(s): EBAY_MARKETPLACE_ID.', 500)
  }

  return {
    ...baseConfig,
    marketplaceId
  }
}

export interface EbayBaseConfig {
  environment: EbayEnvironment
  apiBaseUrl: string
  tokenUrl: string
  browseBaseUrl: string
  sellFulfillmentBaseUrl: string
  consentUrl: string
  clientId: string
  clientSecret: string
}

export function getEbayCredentialEnvVarNames(
  rawValue: string | undefined = process.env.EBAY_ENV
) {
  const environment = getCurrentEbayEnvironment(rawValue)
  const config = EBAY_ENVIRONMENTS[environment]

  return {
    clientIdVarName: config.clientIdEnvVar,
    clientSecretVarName: config.clientSecretEnvVar
  }
}

function getEbayCredentialValues(environment: EbayEnvironment) {
  const config = EBAY_ENVIRONMENTS[environment]

  return {
    clientIdVarName: config.clientIdEnvVar,
    clientSecretVarName: config.clientSecretEnvVar,
    clientId: process.env[config.clientIdEnvVar]?.trim() || null,
    clientSecret: process.env[config.clientSecretEnvVar]?.trim() || null
  }
}

export function getEbayBaseConfig(): EbayBaseConfig {
  const environment = getCurrentEbayEnvironment(process.env.EBAY_ENV)
  const credentials = getEbayCredentialValues(environment)

  const missing = [
    !credentials.clientId && credentials.clientIdVarName,
    !credentials.clientSecret && credentials.clientSecretVarName
  ].filter(Boolean)

  if (missing.length > 0) {
    throw new EbayApiError(
      `Missing required environment variable(s): ${missing.join(', ')}.`,
      500
    )
  }

  validateCredentialEnvironment({
    environment,
    clientIdVarName: credentials.clientIdVarName,
    clientSecretVarName: credentials.clientSecretVarName,
    clientId: credentials.clientId!,
    clientSecret: credentials.clientSecret!
  })

  const endpoints = EBAY_ENVIRONMENTS[environment]
  return {
    environment,
    apiBaseUrl: endpoints.apiBaseUrl,
    tokenUrl: endpoints.tokenUrl,
    browseBaseUrl: endpoints.browseBaseUrl,
    sellFulfillmentBaseUrl: endpoints.sellFulfillmentBaseUrl,
    consentUrl: endpoints.consentUrl,
    clientId: credentials.clientId!,
    clientSecret: credentials.clientSecret!
  }
}

export function buildOAuthRequest(config: EbayServerConfig) {
  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  return {
    url: config.tokenUrl,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: BROWSE_SCOPE
      }),
      cache: 'no-store' as const
    }
  }
}

export function parseEbayErrorPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const messages = record.errors
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        if ('longMessage' in entry && typeof entry.longMessage === 'string') {
          return entry.longMessage
        }

        if ('message' in entry && typeof entry.message === 'string') {
          return entry.message
        }

        return null
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join(' | ')
    }
  }

  for (const key of ['error_description', 'message', 'error'] as const) {
    if (typeof record[key] === 'string') {
      return record[key]
    }
  }

  return null
}

export async function getAppAccessToken(fetchImpl: FetchLike = fetch): Promise<string> {
  const config = getEbayServerConfig()
  const cacheKey = `${config.environment}:${config.clientId}`
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value
  }

  const { url, init } = buildOAuthRequest(config)

  let response: Response
  try {
    response = await fetchImpl(url, init)
  } catch (error) {
    throw new EbayApiError(
      `Failed to request an eBay OAuth token: ${
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
    const expectedEnvironmentLabel = formatEnvironmentLabel(config.environment).toLowerCase()
    const hint =
      response.status === 400 || response.status === 401
        ? ` Make sure your ${expectedEnvironmentLabel} App ID and Cert ID match EBAY_ENV=${config.environment}.`
        : ''
    const detail = parseEbayErrorPayload(payload) ?? `HTTP ${response.status}`
    throw new EbayApiError(
      `eBay OAuth token request failed (${response.status}): ${detail}.${hint}`,
      response.status
    )
  }

  if (!payload || typeof payload !== 'object') {
    throw new EbayApiError('eBay OAuth token response did not include access_token.', 502)
  }

  const tokenPayload = payload as { access_token?: string; expires_in?: number }
  if (typeof tokenPayload.access_token !== 'string') {
    throw new EbayApiError('eBay OAuth token response did not include access_token.', 502)
  }

  const expiresIn = typeof tokenPayload.expires_in === 'number' ? tokenPayload.expires_in : 7200
  cachedToken = {
    key: cacheKey,
    value: tokenPayload.access_token,
    expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000
  }

  return tokenPayload.access_token
}

export function resetTokenCache() {
  cachedToken = null
}
