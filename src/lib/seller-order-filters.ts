import { SellerOrderFulfillmentFilter } from '@/lib/types'

export const DEFAULT_SELLER_ORDER_FULFILLMENT_FILTER = 'any'

export const SELLER_ORDER_FULFILLMENT_FILTER_VALUES = [
  DEFAULT_SELLER_ORDER_FULFILLMENT_FILTER,
  'NOT_STARTED',
  'IN_PROGRESS',
  'FULFILLED'
] as const satisfies ReadonlyArray<SellerOrderFulfillmentFilter>

export const SELLER_ORDER_FULFILLMENT_FILTER_OPTIONS: ReadonlyArray<{
  value: SellerOrderFulfillmentFilter
  label: string
}> = [
  { value: 'any', label: 'Any status' },
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'FULFILLED', label: 'Fulfilled' }
]

export function isSellerOrderFulfillmentFilter(value: unknown): value is SellerOrderFulfillmentFilter {
  return SELLER_ORDER_FULFILLMENT_FILTER_VALUES.includes(
    value as (typeof SELLER_ORDER_FULFILLMENT_FILTER_VALUES)[number]
  )
}

export function parseSellerOrderFulfillmentFilter(
  value: string | string[] | undefined
): SellerOrderFulfillmentFilter | undefined {
  return typeof value === 'string' && isSellerOrderFulfillmentFilter(value) ? value : undefined
}
