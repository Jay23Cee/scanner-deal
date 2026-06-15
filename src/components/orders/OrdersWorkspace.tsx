'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { SELLER_ORDER_FULFILLMENT_FILTER_OPTIONS } from '@/lib/seller-order-filters'
import {
  SellerConnectionState,
  SellerOrderSummary,
  SellerOrderSyncFilters
} from '@/lib/types'

function formatMoney(value: number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not synced yet'
  }

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

function getInitialBanner(initialStatus: string | null, initialError: string | null) {
  if (initialError) {
    return initialError
  }

  if (initialStatus === 'connected') {
    return 'Seller account connected. Syncing recent orders in the background.'
  }

  return null
}

export function OrdersWorkspace({
  initialConnection,
  initialOrders,
  initialFilters,
  initialStatus,
  initialError
}: {
  initialConnection: SellerConnectionState
  initialOrders: SellerOrderSummary[]
  initialFilters: SellerOrderSyncFilters
  initialStatus: string | null
  initialError: string | null
}) {
  const [connection, setConnection] = useState(initialConnection)
  const [orders, setOrders] = useState(initialOrders)
  const [filters, setFilters] = useState(initialFilters)
  const [errorMessage, setErrorMessage] = useState(initialError)
  const [statusMessage, setStatusMessage] = useState(getInitialBanner(initialStatus, initialError))
  const [isPending, startTransition] = useTransition()
  const hasAutoSynced = useRef(false)

  async function syncOrders(background = false) {
    if (!connection.isConfigured) {
      setErrorMessage(`Missing required environment variable(s): ${connection.missingConfiguration.join(', ')}.`)
      return
    }

    if (!connection.connected) {
      setErrorMessage('Connect an eBay seller account before syncing orders.')
      return
    }

    setErrorMessage(null)
    if (!background) {
      setStatusMessage('Refreshing orders from eBay...')
    }

    let response: Response
    try {
      response = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(filters)
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Order sync failed.')
      return
    }

    const payload = (await response.json().catch(() => ({}))) as {
      connection?: SellerConnectionState
      orders?: SellerOrderSummary[]
      error?: string
    }

    if (!response.ok) {
      if (payload.connection) {
        setConnection(payload.connection)
      }
      setErrorMessage(payload.error ?? 'Order sync failed.')
      return
    }

    startTransition(() => {
      setConnection(payload.connection ?? connection)
      setOrders(payload.orders ?? [])
      setStatusMessage(background ? 'Recent seller orders synced.' : 'Seller orders refreshed.')
    })
  }

  async function disconnectSeller() {
    setErrorMessage(null)
    setStatusMessage('Disconnecting seller account...')

    let response: Response
    try {
      response = await fetch('/api/ebay/sell/disconnect', {
        method: 'POST'
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to disconnect the seller account.')
      return
    }

    const payload = (await response.json().catch(() => ({}))) as {
      connection?: SellerConnectionState
      orders?: SellerOrderSummary[]
      error?: string
    }

    if (!response.ok) {
      setErrorMessage(payload.error ?? 'Failed to disconnect the seller account.')
      return
    }

    startTransition(() => {
      setConnection(payload.connection ?? initialConnection)
      setOrders(payload.orders ?? [])
      setStatusMessage('Seller account disconnected. Cached seller orders were cleared.')
    })
  }

  useEffect(() => {
    if (!connection.connected || connection.requiresReconnect || !connection.isConfigured || hasAutoSynced.current) {
      return
    }

    hasAutoSynced.current = true
    void syncOrders(true)
  }, [connection.connected, connection.isConfigured, connection.requiresReconnect])

  return (
    <div className="stack stack--xl">
      <section className="panel panel--hero">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Seller orders</p>
            <h2>Review your recent sold orders without leaving the app.</h2>
            <p className="panel__lede">
              This workflow uses eBay Fulfillment with seller consent. Orders are cached in the app database and refreshed on demand.
            </p>
          </div>
          <div className="status-chip">{orders.length} cached orders</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Connection</p>
            <h2>Seller account</h2>
            <p className="panel__lede">
              Environment: <strong>{connection.environment}</strong>
            </p>
          </div>
          <div className="order-toolbar">
            {connection.isConfigured ? (
              <a href="/api/ebay/sell/connect" className="button button--accent">
                {connection.connected ? 'Reconnect seller' : 'Connect seller'}
              </a>
            ) : null}
            {connection.connected || connection.requiresReconnect ? (
              <button type="button" className="button button--ghost" onClick={() => void disconnectSeller()} disabled={isPending}>
                Disconnect
              </button>
            ) : null}
          </div>
        </div>

        {!connection.isConfigured ? (
          <div className="error-banner">
            Missing required environment variable(s): {connection.missingConfiguration.join(', ')}.
          </div>
        ) : connection.connected ? (
          <div className="quick-metrics">
            <span>Seller: {connection.sellerLabel ?? connection.sellerId ?? 'Not available yet'}</span>
            <span>Last sync: {formatDate(connection.lastSyncAt)}</span>
            <span>Status: Connected</span>
          </div>
        ) : connection.requiresReconnect ? (
          <div className="error-banner">
            The saved seller connection needs to be re-authorized for the current environment before orders can sync.
          </div>
        ) : (
          <div className="quick-metrics">
            <span>No seller account connected yet.</span>
            <span>Use the connect button to approve Fulfillment read access.</span>
          </div>
        )}

        {statusMessage && !errorMessage ? <div className="diagnostics-card"><p>{statusMessage}</p></div> : null}
        {errorMessage ? <div className="error-banner">{errorMessage}</div> : null}
      </section>

      <section className="panel">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Filters</p>
            <h2>Recent order window</h2>
          </div>
          <button
            type="button"
            className="button button--accent"
            onClick={() => void syncOrders(false)}
            disabled={!connection.connected || !connection.isConfigured || isPending}
          >
            Refresh orders
          </button>
        </div>

        <div className="form-grid">
          <label>
            Start date
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
            />
          </label>
          <label>
            End date
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
            />
          </label>
          <label>
            Fulfillment status
            <select
              value={filters.fulfillmentStatus}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  fulfillmentStatus: event.target.value as SellerOrderSyncFilters['fulfillmentStatus']
                }))
              }
            >
              {SELLER_ORDER_FULFILLMENT_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {orders.length === 0 ? (
        <section className="empty-state">
          <h3>No cached orders for this filter window</h3>
          <p>
            {connection.connected
              ? 'Refresh recent orders from eBay to populate this board.'
              : 'Connect a seller account to start caching sold orders.'}
          </p>
        </section>
      ) : (
        <section className="stack">
          <div className="panel__split">
            <div>
              <p className="eyebrow">Cached sold orders</p>
              <h2>Recent order activity</h2>
            </div>
            <div className="status-chip">{orders.length} visible</div>
          </div>

          <div className="orders-grid">
            {orders.map((order) => (
              <article key={order.orderId} className="history-card panel order-card">
                <div className="history-card__meta">
                  <div>
                    <p className="eyebrow">Order</p>
                    <h3>{order.orderId}</h3>
                    <p>{formatDate(order.creationDate)}</p>
                  </div>
                  <span className="listing-badge listing-badge--suggested">{formatStatusLabel(order.orderFulfillmentStatus)}</span>
                </div>

                <div className="history-card__metrics">
                  <span>
                    <small>Total</small>
                    <strong>{formatMoney(order.totalAmount, order.currency)}</strong>
                  </span>
                  <span>
                    <small>Payment</small>
                    <strong>{formatStatusLabel(order.orderPaymentStatus)}</strong>
                  </span>
                  <span>
                    <small>Buyer</small>
                    <strong>{order.buyerLabel ?? 'Not available'}</strong>
                  </span>
                  <span>
                    <small>Line items</small>
                    <strong>{order.lineItemCount}</strong>
                  </span>
                </div>

                <p>Last modified {formatDate(order.lastModifiedDate)}</p>

                <div className="order-card__actions">
                  <Link href={`/orders/${order.orderId}`} className="button button--ghost">
                    Open order
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
