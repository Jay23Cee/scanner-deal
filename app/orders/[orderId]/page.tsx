import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSellerOrderById } from '@/lib/orders'

function formatMoney(value: number | null, currencyCode: string) {
  if (value === null) {
    return 'Not available'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

function formatStatusLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ orderId: string }>
}) {
  const { orderId } = await params
  const order = await getSellerOrderById(orderId)

  if (!order) {
    notFound()
  }

  return (
    <div className="stack stack--xl">
      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Cached order detail</p>
            <h2>{order.orderId}</h2>
            <p className="panel__lede">
              Created {formatDate(order.creationDate)}. Last modified {formatDate(order.lastModifiedDate)}.
            </p>
          </div>
          <Link href="/orders" className="button button--ghost">
            Back to orders
          </Link>
        </div>

        <div className="quick-metrics">
          <span>Fulfillment: {formatStatusLabel(order.orderFulfillmentStatus)}</span>
          <span>Payment: {formatStatusLabel(order.orderPaymentStatus)}</span>
          <span>Buyer: {order.buyerLabel ?? 'Not available'}</span>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Totals</p>
        <h2>Order summary</h2>

        <div className="analysis-grid history-detail-grid">
          <div>
            <span>Total</span>
            <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
          </div>
          <div>
            <span>Paid to seller</span>
            <strong>{formatMoney(order.paymentAmount, order.currency)}</strong>
          </div>
          <div>
            <span>Tax</span>
            <strong>{formatMoney(order.taxAmount, order.currency)}</strong>
          </div>
          <div>
            <span>Delivery cost</span>
            <strong>{formatMoney(order.deliveryCost, order.currency)}</strong>
          </div>
          <div>
            <span>Line items</span>
            <strong>{order.lineItemCount}</strong>
          </div>
          <div>
            <span>Sales record</span>
            <strong>{order.salesRecordReference ?? 'Not available'}</strong>
          </div>
          <div>
            <span>Ship to</span>
            <strong>{order.buyerAddressSummary ?? 'Not available'}</strong>
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Line items</p>
            <h2>Items in this order</h2>
          </div>
          <div className="status-chip">{order.lineItems.length} items</div>
        </div>

        {order.lineItems.length === 0 ? (
          <section className="empty-state">
            <h3>No cached line items</h3>
            <p>The stored order payload did not include line item details.</p>
          </section>
        ) : (
          <div className="orders-grid">
            {order.lineItems.map((lineItem) => (
              <article key={lineItem.lineItemId} className="listing-card order-line-card">
                <div className="listing-card__toggle">
                  <div className="listing-card__media">
                    {lineItem.imageUrl ? (
                      <img src={lineItem.imageUrl} alt={lineItem.title} className="listing-card__image" />
                    ) : (
                      <div className="listing-card__image listing-card__image--placeholder">No image</div>
                    )}
                  </div>
                  <div className="listing-card__content">
                    <h3>{lineItem.title}</h3>
                    <dl className="listing-card__summary">
                      <div>
                        <dt>Line item ID</dt>
                        <dd>{lineItem.lineItemId}</dd>
                      </div>
                      <div>
                        <dt>Quantity</dt>
                        <dd>{lineItem.quantity}</dd>
                      </div>
                      <div>
                        <dt>SKU</dt>
                        <dd>{lineItem.sku ?? 'Not available'}</dd>
                      </div>
                      <div>
                        <dt>Total</dt>
                        <dd>{formatMoney(lineItem.totalAmount, order.currency)}</dd>
                      </div>
                      <div>
                        <dt>Delivery</dt>
                        <dd>{formatMoney(lineItem.deliveryCost, order.currency)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <details className="listing-card__debug">
          <summary>Raw cached order payload</summary>
          <pre className="code-block">{JSON.stringify(order.rawOrder, null, 2)}</pre>
        </details>
      </section>
    </div>
  )
}
