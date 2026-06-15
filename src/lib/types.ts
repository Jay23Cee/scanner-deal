export type SearchMode = 'keyword' | 'gtin'
export type ItemCondition = 'new' | 'open_box' | 'used'
export type Decision = 'BUY' | 'MAYBE' | 'PASS'
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH'
export type EbayEnvironment = 'production' | 'sandbox'
export type SellerOrderFulfillmentFilter = 'any' | 'NOT_STARTED' | 'IN_PROGRESS' | 'FULFILLED'
export type ListingSortMode =
  | 'best_match'
  | 'lowest_total'
  | 'highest_total'
  | 'newest_listed'
  | 'ending_soon'
export type ResultsConditionFilter = 'any' | 'new' | 'used' | 'open_box' | 'for_parts'
export type BuyingFormatFilter = 'any' | 'buy_it_now' | 'auction' | 'best_offer'
export type SearchLogStatus = 'success' | 'error'

export interface ItemLocationSummary {
  city: string | null
  stateOrProvince: string | null
  country: string | null
  postalCode: string | null
}

export interface SearchFilters {
  resultsCondition: ResultsConditionFilter
  buyingOptions: BuyingFormatFilter
  minPrice: number | null
  maxPrice: number | null
  freeShipping: boolean
  sort: ListingSortMode
  limit: number
  excludeWords: string
  minMatchScore: number | null
  listingAgeDays: number | null
}

export interface SearchRequestPayload {
  mode: SearchMode
  query: string
  condition: ItemCondition
  resultsCondition: ResultsConditionFilter
  buyingOptions: BuyingFormatFilter
  minPrice: number | null
  maxPrice: number | null
  freeShipping: boolean
  sort: ListingSortMode
  limit: number
  excludeWords: string
  minMatchScore: number | null
  listingAgeDays: number | null
}

export interface ListingResult {
  title: string
  price: number
  currency: string
  shippingCost: number
  shippingKnown: boolean
  totalPrice: number
  condition: string
  conditionId: string | null
  itemUrl: string
  itemId: string
  sellerUsername: string | null
  sellerFeedbackPercentage: number | null
  itemLocation: ItemLocationSummary | null
  matchScore: number
  primaryImageUrl: string | null
  thumbnailUrl: string | null
  additionalImageUrls: string[]
  itemCreationDate: string | null
  itemOriginDate: string | null
  itemEndDate: string | null
  buyingOptions: string[]
}

export interface ManualSoldComp {
  title: string
  soldPrice: number | null
  shippingCost: number | null
  condition: string
  soldDate: string | null
  notes: string
}

export interface ImageSearchResponsePayload {
  detectedTitle: string
  session: SearchResponsePayload | null
  fallbackMessage?: string
}

export type ImageSearchFeatureStatus =
  | 'available'
  | 'missing_configuration'
  | 'unsupported_environment'

export interface ImageSearchFeatureState {
  status: ImageSearchFeatureStatus
  missingConfiguration: string[]
}

export interface SearchResponsePayload {
  mode: SearchMode
  query: string
  marketplaceId: string
  environment: EbayEnvironment
  totalReturned: number
  rawListings: ListingResult[]
  suggestedComparisonItemIds: string[]
  excludedCount: number
  fallbackApplied: boolean
  fallbackReason?: string
}

export interface SearchLogSummary {
  id: string
  createdAt: Date
  status: SearchLogStatus
  mode: SearchMode
  query: string
  selectedCondition: ItemCondition
  totalReturned: number | null
  excludedCount: number | null
  fallbackApplied: boolean
  errorMessage: string | null
}

export interface SearchLogDetail extends SearchLogSummary {
  resultsCondition: ResultsConditionFilter
  buyingOptions: BuyingFormatFilter
  minPrice: number | null
  maxPrice: number | null
  freeShipping: boolean
  sort: ListingSortMode
  limit: number
  excludeWords: string
  minMatchScore: number | null
  listingAgeDays: number | null
  marketplaceId: string | null
  environment: EbayEnvironment | null
  fallbackReason: string | null
}

export interface DealAnalysisPayload {
  scanId: string
  decision: Decision
  estimatedLowPrice: number
  estimatedMedianPrice: number
  estimatedHighPrice: number
  suggestedListPrice: number
  estimatedProfit: number
  roi: number
  confidence: Confidence
  reason: string
  listingCount: number
}

export interface ScannerDefaults {
  sellerShippingCost: number
  feeRate: number
  packagingCost: number
  promotedListingCost: number
  safetyBuffer: number
  targetProfit: number
}

export interface ScanSummary {
  id: string
  createdAt: Date
  query: string
  mode: SearchMode
  selectedCondition: ItemCondition
  storePrice: number
  estimatedProfit: number
  roi: number
  confidence: Confidence
  decision: Decision
  reason: string
  listingCount: number
  estimatedLowPrice: number
  estimatedMedianPrice: number
  estimatedHighPrice: number
}

export interface ScanDetail extends ScanSummary {
  soldSearchQuery: string | null
  sellerShippingCost: number
  feeRate: number
  packagingCost: number
  promotedListingCost: number
  safetyBuffer: number
  targetProfit: number
  suggestedListPrice: number
  excludedCount: number
  listings: ListingResult[]
  manualSoldComps: ManualSoldComp[]
}

export interface SellerConnectionState {
  isConfigured: boolean
  missingConfiguration: string[]
  connected: boolean
  requiresReconnect: boolean
  environment: EbayEnvironment
  sellerId: string | null
  sellerLabel: string | null
  lastSyncAt: string | null
}

export interface SellerOrderSyncFilters {
  startDate: string
  endDate: string
  fulfillmentStatus: SellerOrderFulfillmentFilter
}

export interface SellerOrderSummary {
  orderId: string
  creationDate: string
  lastModifiedDate: string
  orderFulfillmentStatus: string
  orderPaymentStatus: string
  buyerLabel: string | null
  currency: string
  totalAmount: number
  lineItemCount: number
  salesRecordReference: string | null
}

export interface SellerOrderLineItem {
  lineItemId: string
  title: string
  sku: string | null
  quantity: number
  imageUrl: string | null
  totalAmount: number | null
  deliveryCost: number | null
}

export interface SellerOrderDetail extends SellerOrderSummary {
  paymentAmount: number | null
  taxAmount: number | null
  deliveryCost: number | null
  buyerAddressSummary: string | null
  rawOrder: unknown
  lineItems: SellerOrderLineItem[]
}
