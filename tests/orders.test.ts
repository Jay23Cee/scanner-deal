import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db/client'
import { getCachedSellerOrders, getSellerConnectionState, getSellerOrderById } from '@/lib/orders'
import { encryptString } from '@/lib/security'
import { GET as callbackGet } from '../app/api/ebay/sell/callback/route'
import { GET as connectGet } from '../app/api/ebay/sell/connect/route'
import { POST as disconnectPost } from '../app/api/ebay/sell/disconnect/route'
import { POST as syncPost } from '../app/api/orders/sync/route'

function createRawOrder(overrides: Record<string, unknown> = {}) {
  return {
    orderId: 'order-1',
    sellerId: 'seller-123',
    creationDate: '2026-06-02T12:00:00.000Z',
    lastModifiedDate: '2026-06-03T12:00:00.000Z',
    orderFulfillmentStatus: 'FULFILLED',
    orderPaymentStatus: 'PAID',
    salesRecordReference: 'sales-123',
    pricingSummary: {
      total: { value: '125.50', currency: 'USD' },
      deliveryCost: { value: '10.00', currency: 'USD' },
      tax: { value: '5.00', currency: 'USD' }
    },
    paymentSummary: {
      totalDueSeller: { value: '110.50', currency: 'USD' }
    },
    buyer: {
      username: 'buyer-one'
    },
    lineItems: [
      {
        lineItemId: 'line-1',
        title: 'Nintendo Switch Console',
        quantity: 1,
        sku: 'SW-001',
        image: { imageUrl: 'https://example.com/switch.jpg' },
        lineItemCost: { value: '110.50', currency: 'USD' },
        deliveryCost: { value: '10.00', currency: 'USD' }
      }
    ],
    fulfillmentStartInstructions: [
      {
        shippingStep: {
          shipTo: {
            fullName: 'Buyer One',
            contactAddress: {
              addressLine1: '1 Main St',
              city: 'Los Angeles',
              stateOrProvince: 'CA',
              postalCode: '90001',
              countryCode: 'US'
            }
          }
        }
      }
    ],
    ...overrides
  }
}

async function seedConnection(input?: {
  environment?: 'production' | 'sandbox'
  accessTokenExpiresAt?: Date
  isTokenInvalid?: boolean
}) {
  return prisma.sellerConnection.create({
    data: {
      singletonKey: 'default',
      environment: input?.environment ?? 'production',
      encryptedAccessToken: encryptString('access-token-123'),
      accessTokenExpiresAt: input?.accessTokenExpiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      encryptedRefreshToken: encryptString('refresh-token-123'),
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
      isTokenInvalid: input?.isTokenInvalid ?? false
    }
  })
}

describe('seller orders', () => {
  beforeEach(async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'PRD-client-id'
    process.env.EBAY_CLIENT_SECRET = 'PROD-client-secret'
    process.env.EBAY_RU_NAME = 'scanner-runame'
    process.env.APP_SECRET = 'test-app-secret'

    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    await prisma.sellerOrder.deleteMany()
    await prisma.sellerConnection.deleteMany()
    await prisma.listingSnapshot.deleteMany()
    await prisma.scanRecord.deleteMany()
  })

  it('filters cached seller orders by date and fulfillment status', async () => {
    const connection = await seedConnection()
    await prisma.sellerOrder.createMany({
      data: [
        {
          connectionId: connection.id,
          environment: 'production',
          orderId: 'order-1',
          creationDate: new Date('2026-06-02T12:00:00.000Z'),
          lastModifiedDate: new Date('2026-06-03T12:00:00.000Z'),
          orderFulfillmentStatus: 'FULFILLED',
          orderPaymentStatus: 'PAID',
          buyerUsername: 'buyer-one',
          currency: 'USD',
          totalAmount: 125.5,
          lineItemCount: 1,
          salesRecordReference: 'sales-1',
          rawOrder: createRawOrder()
        },
        {
          connectionId: connection.id,
          environment: 'production',
          orderId: 'order-2',
          creationDate: new Date('2026-05-20T12:00:00.000Z'),
          lastModifiedDate: new Date('2026-05-21T12:00:00.000Z'),
          orderFulfillmentStatus: 'IN_PROGRESS',
          orderPaymentStatus: 'PAID',
          buyerUsername: 'buyer-two',
          currency: 'USD',
          totalAmount: 75,
          lineItemCount: 1,
          salesRecordReference: 'sales-2',
          rawOrder: createRawOrder({
            orderId: 'order-2',
            creationDate: '2026-05-20T12:00:00.000Z',
            lastModifiedDate: '2026-05-21T12:00:00.000Z',
            orderFulfillmentStatus: 'IN_PROGRESS'
          })
        }
      ]
    })

    const orders = await getCachedSellerOrders({
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      fulfillmentStatus: 'FULFILLED'
    })

    expect(orders).toHaveLength(1)
    expect(orders[0]?.orderId).toBe('order-1')
  })

  it('reads cached seller order detail and line items', async () => {
    const connection = await seedConnection()
    await prisma.sellerOrder.create({
      data: {
        connectionId: connection.id,
        environment: 'production',
        orderId: 'order-1',
        creationDate: new Date('2026-06-02T12:00:00.000Z'),
        lastModifiedDate: new Date('2026-06-03T12:00:00.000Z'),
        orderFulfillmentStatus: 'FULFILLED',
        orderPaymentStatus: 'PAID',
        buyerUsername: 'buyer-one',
        currency: 'USD',
        totalAmount: 125.5,
        lineItemCount: 1,
        salesRecordReference: 'sales-1',
        rawOrder: createRawOrder()
      }
    })

    const order = await getSellerOrderById('order-1')

    expect(order?.buyerAddressSummary).toContain('Los Angeles')
    expect(order?.lineItems).toHaveLength(1)
    expect(order?.lineItems[0]?.title).toBe('Nintendo Switch Console')
    expect(order?.paymentAmount).toBe(110.5)
  })

  it('marks a connection as requiring reconnect when the environment changes', async () => {
    await seedConnection({ environment: 'sandbox' })
    process.env.EBAY_ENV = 'production'

    const connectionState = await getSellerConnectionState()

    expect(connectionState.connected).toBe(false)
    expect(connectionState.requiresReconnect).toBe(true)
  })

  it('builds the seller connect redirect and stores the auth state cookie', async () => {
    const response = await connectGet()

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('https://auth.ebay.com/oauth2/authorize')
    expect(response.headers.get('set-cookie')).toContain('ebay_sell_state=')
  })

  it('completes the callback flow and stores encrypted seller tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'user-access-token',
          expires_in: 7200,
          refresh_token: 'user-refresh-token',
          refresh_token_expires_in: 86400,
          scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )

    vi.stubGlobal('fetch', fetchMock)

    const response = await callbackGet(
      new Request('http://localhost/api/ebay/sell/callback?code=code-123&state=state-123', {
        headers: {
          cookie: 'ebay_sell_state=state-123'
        }
      })
    )

    const storedConnection = await prisma.sellerConnection.findFirstOrThrow()

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/orders?status=connected')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(storedConnection.encryptedAccessToken).not.toContain('user-access-token')
  })

  it('rejects the callback when the auth state does not match', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await callbackGet(
      new Request('http://localhost/api/ebay/sell/callback?code=code-123&state=wrong-state', {
        headers: {
          cookie: 'ebay_sell_state=state-123'
        }
      })
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('state+check+failed')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes expired seller tokens before syncing orders', async () => {
    await seedConnection({ accessTokenExpiresAt: new Date(Date.now() - 5 * 60 * 1000) })

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: 'refreshed-access-token',
            expires_in: 7200,
            refresh_token: 'refreshed-refresh-token',
            refresh_token_expires_in: 86400,
            scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ orders: [createRawOrder()] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )

    vi.stubGlobal('fetch', fetchMock)

    const response = await syncPost(
      new Request('http://localhost/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          fulfillmentStatus: 'FULFILLED'
        })
      })
    )

    const payload = await response.json()
    const storedConnection = await prisma.sellerConnection.findFirstOrThrow()

    expect(response.status).toBe(200)
    expect(payload.orders).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(storedConnection.lastSyncAt).toBeTruthy()
    expect(storedConnection.sellerId).toBe('seller-123')
  })

  it('paginates and upserts seller orders during sync', async () => {
    await seedConnection()

    const firstFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [createRawOrder({ orderFulfillmentStatus: 'IN_PROGRESS' })],
            next: 'https://api.ebay.com/sell/fulfillment/v1/order?offset=50'
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orders: [
              createRawOrder({
                orderId: 'order-2',
                creationDate: '2026-06-04T12:00:00.000Z',
                lastModifiedDate: '2026-06-05T12:00:00.000Z',
                orderFulfillmentStatus: 'FULFILLED'
              })
            ]
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )

    vi.stubGlobal('fetch', firstFetch)

    const firstResponse = await syncPost(
      new Request('http://localhost/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          fulfillmentStatus: 'any'
        })
      })
    )

    expect(firstResponse.status).toBe(200)
    expect(await prisma.sellerOrder.count()).toBe(2)

    const secondFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          orders: [createRawOrder({ orderFulfillmentStatus: 'FULFILLED' })]
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )

    vi.stubGlobal('fetch', secondFetch)

    const secondResponse = await syncPost(
      new Request('http://localhost/api/orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: '2026-06-01',
          endDate: '2026-06-30',
          fulfillmentStatus: 'any'
        })
      })
    )

    const updatedOrder = await prisma.sellerOrder.findUniqueOrThrow({
      where: {
        orderId: 'order-1'
      }
    })

    expect(secondResponse.status).toBe(200)
    expect(updatedOrder.orderFulfillmentStatus).toBe('FULFILLED')
  })

  it('disconnects the seller account and clears cached orders', async () => {
    const connection = await seedConnection()
    await prisma.sellerOrder.create({
      data: {
        connectionId: connection.id,
        environment: 'production',
        orderId: 'order-1',
        creationDate: new Date('2026-06-02T12:00:00.000Z'),
        lastModifiedDate: new Date('2026-06-03T12:00:00.000Z'),
        orderFulfillmentStatus: 'FULFILLED',
        orderPaymentStatus: 'PAID',
        buyerUsername: 'buyer-one',
        currency: 'USD',
        totalAmount: 125.5,
        lineItemCount: 1,
        salesRecordReference: 'sales-1',
        rawOrder: createRawOrder()
      }
    })

    const response = await disconnectPost()

    expect(response.status).toBe(200)
    expect(await prisma.sellerConnection.count()).toBe(0)
    expect(await prisma.sellerOrder.count()).toBe(0)
  })
})
