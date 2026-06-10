import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db/client'
import OrdersPage from '../app/orders/page'
import OrderDetailPage from '../app/orders/[orderId]/page'

function createRawOrder() {
  return {
    orderId: 'order-1',
    sellerId: 'seller-123',
    creationDate: '2026-06-02T12:00:00.000Z',
    lastModifiedDate: '2026-06-03T12:00:00.000Z',
    orderFulfillmentStatus: 'FULFILLED',
    orderPaymentStatus: 'PAID',
    pricingSummary: {
      total: { value: '125.50', currency: 'USD' }
    },
    buyer: {
      username: 'buyer-one'
    },
    lineItems: []
  }
}

describe('orders pages', () => {
  beforeEach(async () => {
    process.env.EBAY_ENV = 'production'
    process.env.EBAY_CLIENT_ID = 'PRD-client-id'
    process.env.EBAY_CLIENT_SECRET = 'PROD-client-secret'
    process.env.EBAY_RU_NAME = 'scanner-runame'
    process.env.APP_SECRET = 'test-app-secret'

    await prisma.sellerOrder.deleteMany()
    await prisma.sellerConnection.deleteMany()
  })

  it('renders the disconnected orders page state', async () => {
    const page = await OrdersPage({
      searchParams: Promise.resolve({})
    })

    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('No seller account connected yet')
    expect(markup).toContain('Connect seller')
  })

  it('renders cached seller orders on the orders page', async () => {
    const connection = await prisma.sellerConnection.create({
      data: {
        singletonKey: 'default',
        environment: 'production',
        encryptedAccessToken: 'encrypted-token',
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        encryptedRefreshToken: 'encrypted-refresh-token',
        refreshTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        scope: 'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
        sellerId: 'seller-123',
        sellerLabel: 'seller-123'
      }
    })

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

    const page = await OrdersPage({
      searchParams: Promise.resolve({})
    })

    const markup = renderToStaticMarkup(page)

    expect(markup).toContain('seller-123')
    expect(markup).toContain('order-1')
    expect(markup).toContain('Open order')
  })

  it('returns notFound for a missing cached order detail page', async () => {
    await expect(
      OrderDetailPage({
        params: Promise.resolve({ orderId: 'missing-order' })
      })
    ).rejects.toMatchObject({
      digest: expect.stringContaining('NEXT_HTTP_ERROR_FALLBACK;404')
    })
  })
})
