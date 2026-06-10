import { OrdersWorkspace } from '@/components/orders/OrdersWorkspace'
import { getCachedSellerOrders, getDefaultSellerOrderSyncFilters, getSellerConnectionState, normalizeSellerOrderSyncFilters } from '@/lib/orders'
import { parseSellerOrderFulfillmentFilter } from '@/lib/seller-order-filters'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const initialFilters = normalizeSellerOrderSyncFilters(
    {
      startDate: typeof params.startDate === 'string' ? params.startDate : undefined,
      endDate: typeof params.endDate === 'string' ? params.endDate : undefined,
      fulfillmentStatus: parseSellerOrderFulfillmentFilter(params.fulfillmentStatus)
    },
    new Date()
  )

  const connection = await getSellerConnectionState()
  const orders = await getCachedSellerOrders(connection.connected || connection.requiresReconnect ? initialFilters : getDefaultSellerOrderSyncFilters())

  return (
    <OrdersWorkspace
      initialConnection={connection}
      initialOrders={orders}
      initialFilters={initialFilters}
      initialStatus={typeof params.status === 'string' ? params.status : null}
      initialError={typeof params.error === 'string' ? params.error : null}
    />
  )
}
