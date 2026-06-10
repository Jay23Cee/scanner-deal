import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/client'
import { EbayApiError, getCurrentEbayEnvironment } from '@/lib/ebay/auth'
import { exchangeSellerCodeForTokens, fetchSellerOrders, refreshSellerAccessToken, SellerTokenResponse } from '@/lib/ebay/seller-auth'
import {
  DEFAULT_SELLER_ORDER_FULFILLMENT_FILTER,
  isSellerOrderFulfillmentFilter
} from '@/lib/seller-order-filters'
import { decryptString, encryptString } from '@/lib/security'
import {
  SellerConnectionState,
  SellerOrderDetail,
  SellerOrderLineItem,
  SellerOrderSummary,
  SellerOrderSyncFilters
} from '@/lib/types'

const SELLER_CONNECTION_SINGLETON_KEY = 'default'
const DEFAULT_SYNC_WINDOW_DAYS = 90

type StoredConnection = Awaited<ReturnType<typeof getStoredConnection>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function getAmountParts(value: unknown) {
  if (!isRecord(value)) {
    return { amount: null, currency: null as string | null }
  }

  return {
    amount: toFiniteNumber(value.value),
    currency: getString(value.currency)
  }
}

function toIsoString(value: Date | null) {
  return value ? value.toISOString() : null
}

type NormalizedStoredOrder = NonNullable<ReturnType<typeof normalizeStoredOrder>>

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDateOnly(value: string, boundary: 'start' | 'end') {
  return new Date(boundary === 'start' ? `${value}T00:00:00.000Z` : `${value}T23:59:59.999Z`)
}

function getDefaultDateRange(now = new Date()) {
  const endDate = new Date(now)
  const startDate = new Date(now)
  startDate.setUTCDate(startDate.getUTCDate() - (DEFAULT_SYNC_WINDOW_DAYS - 1))

  return {
    startDate: formatDateOnly(startDate),
    endDate: formatDateOnly(endDate)
  }
}

export function getDefaultSellerOrderSyncFilters(now = new Date()): SellerOrderSyncFilters {
  const defaults = getDefaultDateRange(now)
  return {
    ...defaults,
    fulfillmentStatus: DEFAULT_SELLER_ORDER_FULFILLMENT_FILTER
  }
}

export function normalizeSellerOrderSyncFilters(
  input: Partial<SellerOrderSyncFilters> | undefined,
  now = new Date()
): SellerOrderSyncFilters {
  const defaults = getDefaultSellerOrderSyncFilters(now)
  const startDate = getString(input?.startDate) ?? defaults.startDate
  const endDate = getString(input?.endDate) ?? defaults.endDate
  const fulfillmentStatus = input?.fulfillmentStatus ?? defaults.fulfillmentStatus

  const normalizedStatus = isSellerOrderFulfillmentFilter(fulfillmentStatus)
    ? fulfillmentStatus
    : defaults.fulfillmentStatus

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return defaults
  }

  if (startDate > endDate) {
    return {
      startDate: endDate,
      endDate: startDate,
      fulfillmentStatus: normalizedStatus
    }
  }

  return {
    startDate,
    endDate,
    fulfillmentStatus: normalizedStatus
  }
}

function getMissingSellerConfiguration() {
  return [
    !process.env.EBAY_CLIENT_ID?.trim() && 'EBAY_CLIENT_ID',
    !process.env.EBAY_CLIENT_SECRET?.trim() && 'EBAY_CLIENT_SECRET',
    !process.env.EBAY_RU_NAME?.trim() && 'EBAY_RU_NAME',
    !process.env.APP_SECRET?.trim() && 'APP_SECRET'
  ].filter(Boolean) as string[]
}

function assertSellerFeatureConfigured() {
  const missing = getMissingSellerConfiguration()
  if (missing.length > 0) {
    throw new EbayApiError(`Missing required environment variable(s): ${missing.join(', ')}.`, 500)
  }
}

async function getStoredConnection() {
  return prisma.sellerConnection.findUnique({
    where: {
      singletonKey: SELLER_CONNECTION_SINGLETON_KEY
    }
  })
}

export async function getSellerConnectionState(): Promise<SellerConnectionState> {
  const environment = getCurrentEbayEnvironment()
  const missingConfiguration = getMissingSellerConfiguration()
  const connection = await getStoredConnection()

  if (missingConfiguration.length > 0) {
    return {
      isConfigured: false,
      missingConfiguration,
      connected: false,
      requiresReconnect: false,
      environment,
      sellerId: null,
      sellerLabel: null,
      lastSyncAt: null
    }
  }

  if (!connection) {
    return {
      isConfigured: true,
      missingConfiguration: [],
      connected: false,
      requiresReconnect: false,
      environment,
      sellerId: null,
      sellerLabel: null,
      lastSyncAt: null
    }
  }

  const environmentMatches = connection.environment === environment
  const sellerLabel = connection.sellerLabel ?? connection.sellerId ?? null
  const requiresReconnect = !environmentMatches || connection.isTokenInvalid

  return {
    isConfigured: true,
    missingConfiguration: [],
    connected: environmentMatches && !connection.isTokenInvalid,
    requiresReconnect,
    environment,
    sellerId: connection.sellerId,
    sellerLabel,
    lastSyncAt: environmentMatches ? toIsoString(connection.lastSyncAt) : null
  }
}

async function requireActiveConnection() {
  assertSellerFeatureConfigured()
  const environment = getCurrentEbayEnvironment()
  const connection = await getStoredConnection()

  if (!connection) {
    throw new EbayApiError('No seller account is connected yet. Connect an eBay seller account first.', 409)
  }

  if (connection.environment !== environment) {
    throw new EbayApiError(
      `The stored seller connection belongs to ${connection.environment}. Reconnect for EBAY_ENV=${environment}.`,
      409
    )
  }

  if (connection.isTokenInvalid) {
    throw new EbayApiError('The stored seller token is no longer valid. Reconnect the seller account.', 409)
  }

  return connection
}

async function setConnectionInvalid(connectionId: string) {
  await prisma.sellerConnection.update({
    where: {
      id: connectionId
    },
    data: {
      isTokenInvalid: true
    }
  })
}

function getBuyerLabel(order: unknown) {
  if (!isRecord(order) || !isRecord(order.buyer)) {
    return null
  }

  return getString(order.buyer.username) ?? getString(order.buyer.userId)
}

function normalizeStoredOrder(order: unknown) {
  if (!isRecord(order)) {
    return null
  }

  const orderId = getString(order.orderId)
  const creationDateValue = getString(order.creationDate)
  const lastModifiedDateValue = getString(order.lastModifiedDate) ?? creationDateValue
  if (!orderId || !creationDateValue || !lastModifiedDateValue) {
    return null
  }

  const creationDate = new Date(creationDateValue)
  const lastModifiedDate = new Date(lastModifiedDateValue)
  if (Number.isNaN(creationDate.getTime()) || Number.isNaN(lastModifiedDate.getTime())) {
    return null
  }

  const pricingSummary = isRecord(order.pricingSummary) ? order.pricingSummary : null
  const pricingTotal = getAmountParts(pricingSummary?.total)
  const paymentSummary = isRecord(order.paymentSummary) ? order.paymentSummary : null
  const totalDueSeller = getAmountParts(paymentSummary?.totalDueSeller)
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems : []
  const currency = pricingTotal.currency ?? totalDueSeller.currency ?? 'USD'

  return {
    orderId,
    creationDate,
    lastModifiedDate,
    orderFulfillmentStatus: getString(order.orderFulfillmentStatus) ?? 'UNKNOWN',
    orderPaymentStatus: getString(order.orderPaymentStatus) ?? 'UNKNOWN',
    buyerUsername: getBuyerLabel(order),
    currency,
    totalAmount: pricingTotal.amount ?? totalDueSeller.amount ?? 0,
    lineItemCount: lineItems.length,
    salesRecordReference: getString(order.salesRecordReference),
    sellerId: getString(order.sellerId),
    rawOrder: order as Prisma.InputJsonValue
  }
}

function mapStoredOrderSummary(order: {
  orderId: string
  creationDate: Date
  lastModifiedDate: Date
  orderFulfillmentStatus: string
  orderPaymentStatus: string
  buyerUsername: string | null
  currency: string
  totalAmount: number
  lineItemCount: number
  salesRecordReference: string | null
}): SellerOrderSummary {
  return {
    orderId: order.orderId,
    creationDate: order.creationDate.toISOString(),
    lastModifiedDate: order.lastModifiedDate.toISOString(),
    orderFulfillmentStatus: order.orderFulfillmentStatus,
    orderPaymentStatus: order.orderPaymentStatus,
    buyerLabel: order.buyerUsername,
    currency: order.currency,
    totalAmount: order.totalAmount,
    lineItemCount: order.lineItemCount,
    salesRecordReference: order.salesRecordReference
  }
}

function mapLineItems(order: unknown): SellerOrderLineItem[] {
  if (!isRecord(order) || !Array.isArray(order.lineItems)) {
    return []
  }

  return order.lineItems
    .map((lineItem) => {
      if (!isRecord(lineItem)) {
        return null
      }

      const totalAmount = getAmountParts(lineItem.lineItemCost).amount ?? getAmountParts(lineItem.total).amount
      const deliveryCost = getAmountParts(lineItem.deliveryCost).amount
      const imageUrl =
        (isRecord(lineItem.image) && getString(lineItem.image.imageUrl)) ||
        (isRecord(lineItem.itemImage) && getString(lineItem.itemImage.imageUrl)) ||
        null

      return {
        lineItemId: getString(lineItem.lineItemId) ?? 'Unknown',
        title: getString(lineItem.title) ?? 'Untitled line item',
        sku: getString(lineItem.sku),
        quantity: toFiniteNumber(lineItem.quantity) ?? 0,
        imageUrl,
        totalAmount,
        deliveryCost
      }
    })
    .filter((lineItem): lineItem is SellerOrderLineItem => Boolean(lineItem))
}

function buildBuyerAddressSummary(order: unknown) {
  if (!isRecord(order) || !Array.isArray(order.fulfillmentStartInstructions) || order.fulfillmentStartInstructions.length === 0) {
    return null
  }

  const shippingInstruction = order.fulfillmentStartInstructions.find((entry) => isRecord(entry)) as
    | Record<string, unknown>
    | undefined
  if (!shippingInstruction || !isRecord(shippingInstruction.shippingStep) || !isRecord(shippingInstruction.shippingStep.shipTo)) {
    return null
  }

  const shipTo = shippingInstruction.shippingStep.shipTo
  const contactAddress = isRecord(shipTo.contactAddress) ? shipTo.contactAddress : null
  const parts = [
    getString(shipTo.fullName),
    getString(contactAddress?.addressLine1),
    getString(contactAddress?.addressLine2),
    [getString(contactAddress?.city), getString(contactAddress?.stateOrProvince)].filter(Boolean).join(', '),
    [getString(contactAddress?.postalCode), getString(contactAddress?.countryCode)].filter(Boolean).join(' ')
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' | ') : null
}

function mapStoredOrderDetail(order: {
  orderId: string
  creationDate: Date
  lastModifiedDate: Date
  orderFulfillmentStatus: string
  orderPaymentStatus: string
  buyerUsername: string | null
  currency: string
  totalAmount: number
  lineItemCount: number
  salesRecordReference: string | null
  rawOrder: unknown
}): SellerOrderDetail {
  const pricingSummary = isRecord(order.rawOrder) && isRecord(order.rawOrder.pricingSummary) ? order.rawOrder.pricingSummary : null
  const paymentSummary = isRecord(order.rawOrder) && isRecord(order.rawOrder.paymentSummary) ? order.rawOrder.paymentSummary : null

  return {
    ...mapStoredOrderSummary(order),
    paymentAmount: getAmountParts(paymentSummary?.totalDueSeller).amount,
    taxAmount: getAmountParts(pricingSummary?.tax).amount,
    deliveryCost: getAmountParts(pricingSummary?.deliveryCost).amount,
    buyerAddressSummary: buildBuyerAddressSummary(order.rawOrder),
    rawOrder: order.rawOrder,
    lineItems: mapLineItems(order.rawOrder)
  }
}

async function replaceConnection(token: SellerTokenResponse) {
  const environment = getCurrentEbayEnvironment()
  const encryptedAccessToken = encryptString(token.accessToken)
  const refreshToken = token.refreshToken
  if (!refreshToken) {
    throw new EbayApiError('eBay user token response did not include refresh_token.', 502)
  }

  const encryptedRefreshToken = encryptString(refreshToken)

  await prisma.$transaction(async (tx) => {
    const existing = await tx.sellerConnection.findUnique({
      where: {
        singletonKey: SELLER_CONNECTION_SINGLETON_KEY
      }
    })

    if (existing) {
      await tx.sellerOrder.deleteMany({
        where: {
          connectionId: existing.id
        }
      })

      await tx.sellerConnection.delete({
        where: {
          id: existing.id
        }
      })
    }

    await tx.sellerConnection.create({
      data: {
        singletonKey: SELLER_CONNECTION_SINGLETON_KEY,
        environment,
        encryptedAccessToken,
        accessTokenExpiresAt: token.accessTokenExpiresAt,
        encryptedRefreshToken,
        refreshTokenExpiresAt: token.refreshTokenExpiresAt,
        scope: token.scope,
        isTokenInvalid: false
      }
    })
  })
}

export async function connectSellerAccountFromCode(code: string, fetchImpl: typeof fetch = fetch) {
  assertSellerFeatureConfigured()
  const tokenResponse = await exchangeSellerCodeForTokens(code, fetchImpl)
  await replaceConnection(tokenResponse)
}

export async function disconnectSellerAccount() {
  const existing = await getStoredConnection()
  if (!existing) {
    return
  }

  await prisma.sellerConnection.delete({
    where: {
      id: existing.id
    }
  })
}

async function refreshStoredAccessToken(connection: NonNullable<StoredConnection>, fetchImpl: typeof fetch) {
  const refreshToken = decryptString(connection.encryptedRefreshToken)
  const refreshedToken = await refreshSellerAccessToken(refreshToken, fetchImpl)

  const updateData: Prisma.SellerConnectionUpdateInput = {
    encryptedAccessToken: encryptString(refreshedToken.accessToken),
    accessTokenExpiresAt: refreshedToken.accessTokenExpiresAt,
    scope: refreshedToken.scope,
    isTokenInvalid: false
  }

  if (refreshedToken.refreshToken) {
    updateData.encryptedRefreshToken = encryptString(refreshedToken.refreshToken)
  }

  if (refreshedToken.refreshTokenExpiresAt) {
    updateData.refreshTokenExpiresAt = refreshedToken.refreshTokenExpiresAt
  }

  await prisma.sellerConnection.update({
    where: {
      id: connection.id
    },
    data: updateData
  })

  return refreshedToken.accessToken
}

async function getSellerAccessToken(fetchImpl: typeof fetch, forceRefresh = false) {
  const connection = await requireActiveConnection()
  const expiresSoon = connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000

  if (!forceRefresh && !expiresSoon) {
    try {
      return {
        accessToken: decryptString(connection.encryptedAccessToken),
        connection
      }
    } catch (error) {
      await setConnectionInvalid(connection.id)
      throw new EbayApiError(
        `The stored seller token could not be decrypted: ${error instanceof Error ? error.message : 'unknown error'}. Reconnect the seller account.`,
        500
      )
    }
  }

  try {
    const accessToken = await refreshStoredAccessToken(connection, fetchImpl)
    return {
      accessToken,
      connection
    }
  } catch (error) {
    await setConnectionInvalid(connection.id)
    if (error instanceof EbayApiError) {
      throw new EbayApiError(`${error.message} Reconnect the seller account.`, error.status)
    }

    throw new EbayApiError('Failed to refresh the stored seller token. Reconnect the seller account.', 500)
  }
}

async function persistFetchedOrders(
  connection: NonNullable<StoredConnection>,
  rawOrders: unknown[],
  syncedAt: Date
) {
  const environment = getCurrentEbayEnvironment()
  const normalizedOrders = rawOrders.map(normalizeStoredOrder).filter(Boolean)
  const safeOrders = normalizedOrders as NormalizedStoredOrder[]
  const sellerId = safeOrders.find((order) => order.sellerId)?.sellerId ?? connection.sellerId ?? null

  await prisma.$transaction(async (tx) => {
    if (safeOrders.length > 0) {
      for (const order of safeOrders) {
        await tx.sellerOrder.upsert({
          where: {
            orderId: order.orderId
          },
          update: {
            environment,
            creationDate: order.creationDate,
            lastModifiedDate: order.lastModifiedDate,
            orderFulfillmentStatus: order.orderFulfillmentStatus,
            orderPaymentStatus: order.orderPaymentStatus,
            buyerUsername: order.buyerUsername,
            currency: order.currency,
            totalAmount: order.totalAmount,
            lineItemCount: order.lineItemCount,
            salesRecordReference: order.salesRecordReference,
            rawOrder: order.rawOrder
          },
          create: {
            connectionId: connection.id,
            environment,
            orderId: order.orderId,
            creationDate: order.creationDate,
            lastModifiedDate: order.lastModifiedDate,
            orderFulfillmentStatus: order.orderFulfillmentStatus,
            orderPaymentStatus: order.orderPaymentStatus,
            buyerUsername: order.buyerUsername,
            currency: order.currency,
            totalAmount: order.totalAmount,
            lineItemCount: order.lineItemCount,
            salesRecordReference: order.salesRecordReference,
            rawOrder: order.rawOrder
          }
        })
      }
    }

    await tx.sellerConnection.update({
      where: {
        id: connection.id
      },
      data: {
        sellerId,
        sellerLabel: sellerId,
        lastSyncAt: syncedAt,
        isTokenInvalid: false
      }
    })
  })
}

function buildOrdersWhere(
  connectionId: string,
  filters: SellerOrderSyncFilters
): Prisma.SellerOrderWhereInput {
  return {
    connectionId,
    creationDate: {
      gte: parseDateOnly(filters.startDate, 'start'),
      lte: parseDateOnly(filters.endDate, 'end')
    },
    ...(filters.fulfillmentStatus !== 'any'
      ? {
          orderFulfillmentStatus: filters.fulfillmentStatus
        }
      : {})
  }
}

export async function getCachedSellerOrders(filters: SellerOrderSyncFilters): Promise<SellerOrderSummary[]> {
  const environment = getCurrentEbayEnvironment()
  const connection = await getStoredConnection()

  if (!connection || connection.environment !== environment) {
    return []
  }

  const orders = await prisma.sellerOrder.findMany({
    where: buildOrdersWhere(connection.id, filters),
    orderBy: {
      creationDate: 'desc'
    },
    select: {
      orderId: true,
      creationDate: true,
      lastModifiedDate: true,
      orderFulfillmentStatus: true,
      orderPaymentStatus: true,
      buyerUsername: true,
      currency: true,
      totalAmount: true,
      lineItemCount: true,
      salesRecordReference: true
    }
  })

  return orders.map(mapStoredOrderSummary)
}

export async function getSellerOrderById(orderId: string): Promise<SellerOrderDetail | null> {
  const environment = getCurrentEbayEnvironment()
  const order = await prisma.sellerOrder.findUnique({
    where: {
      orderId
    },
    select: {
      orderId: true,
      creationDate: true,
      lastModifiedDate: true,
      orderFulfillmentStatus: true,
      orderPaymentStatus: true,
      buyerUsername: true,
      currency: true,
      totalAmount: true,
      lineItemCount: true,
      salesRecordReference: true,
      rawOrder: true,
      connection: {
        select: {
          environment: true
        }
      }
    }
  })

  if (!order || order.connection.environment !== environment) {
    return null
  }

  return mapStoredOrderDetail(order)
}

export async function syncSellerOrders(
  input: Partial<SellerOrderSyncFilters> | undefined,
  fetchImpl: typeof fetch = fetch
) {
  assertSellerFeatureConfigured()
  const filters = normalizeSellerOrderSyncFilters(input)
  const { accessToken, connection } = await getSellerAccessToken(fetchImpl)
  const syncedAt = new Date()

  let rawOrders: unknown[]
  try {
    rawOrders = await fetchSellerOrders(accessToken, filters, fetchImpl)
  } catch (error) {
    if (error instanceof EbayApiError && error.status === 401) {
      const refreshed = await getSellerAccessToken(fetchImpl, true)
      rawOrders = await fetchSellerOrders(refreshed.accessToken, filters, fetchImpl)
    } else {
      if (error instanceof EbayApiError && (error.status === 400 || error.status === 401)) {
        await setConnectionInvalid(connection.id)
      }

      throw error
    }
  }

  await persistFetchedOrders(connection, rawOrders, syncedAt)

  return {
    filters,
    connection: await getSellerConnectionState(),
    orders: await getCachedSellerOrders(filters)
  }
}
