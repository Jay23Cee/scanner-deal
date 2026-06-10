import { ItemCondition, ListingResult, SearchMode } from '@/lib/types'
import { isConditionClose } from '@/lib/ebay/normalize'

interface CalculationInput {
  mode: SearchMode
  condition: ItemCondition
  storePrice: number
  sellerShippingCost: number
  feeRate: number
  packagingCost: number
  promotedListingCost: number
  safetyBuffer: number
  targetProfit: number
  listings: ListingResult[]
}

export interface DealMetrics {
  listingCount: number
  conditionCloseCount: number
  averageMatchScore: number
  estimatedLowPrice: number
  estimatedMedianPrice: number
  estimatedHighPrice: number
  suggestedListPrice: number
  feeEstimate: number
  estimatedProfit: number
  roi: number
  priceSpreadRatio: number
}

function quantile(values: number[], point: number) {
  if (values.length === 0) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const position = (sorted.length - 1) * point
  const base = Math.floor(position)
  const remainder = position - base

  if (sorted[base + 1] !== undefined) {
    return sorted[base] + remainder * (sorted[base + 1] - sorted[base])
  }

  return sorted[base]
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function calculateDealMetrics(input: CalculationInput): DealMetrics {
  if (input.listings.length === 0) {
    throw new Error('At least one listing is required to analyze a deal.')
  }

  const totals = input.listings.map((listing) => listing.totalPrice)
  const estimatedLowPrice = Number(quantile(totals, 0.25).toFixed(2))
  const estimatedMedianPrice = Number(quantile(totals, 0.5).toFixed(2))
  const estimatedHighPrice = Number(quantile(totals, 0.75).toFixed(2))
  const suggestedListPrice = Number(estimatedMedianPrice.toFixed(2))
  const feeEstimate = Number((suggestedListPrice * input.feeRate).toFixed(2))
  const estimatedProfit = Number(
    (
      suggestedListPrice -
      input.storePrice -
      feeEstimate -
      input.sellerShippingCost -
      input.packagingCost -
      input.promotedListingCost -
      input.safetyBuffer
    ).toFixed(2)
  )
  const roi = Number((input.storePrice > 0 ? estimatedProfit / input.storePrice : 0).toFixed(3))
  const priceSpreadRatio = Number(
    (estimatedMedianPrice > 0
      ? (estimatedHighPrice - estimatedLowPrice) / estimatedMedianPrice
      : 1
    ).toFixed(3)
  )

  const conditionCloseCount = input.listings.filter((listing) =>
    isConditionClose(listing.condition, input.condition)
  ).length

  return {
    listingCount: input.listings.length,
    conditionCloseCount,
    averageMatchScore: Number(average(input.listings.map((listing) => listing.matchScore)).toFixed(2)),
    estimatedLowPrice,
    estimatedMedianPrice,
    estimatedHighPrice,
    suggestedListPrice,
    feeEstimate,
    estimatedProfit,
    roi,
    priceSpreadRatio
  }
}

