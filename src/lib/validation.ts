import { z } from 'zod'
import {
  BUYING_FORMAT_VALUES,
  DEFAULT_SEARCH_FILTERS,
  LISTING_AGE_DAY_VALUES,
  LISTING_SORT_MODES,
  MIN_MATCH_SCORE_VALUES,
  RESULTS_CONDITION_VALUES,
  RESULT_LIMIT_VALUES
} from '@/lib/search-filters'
import { SELLER_ORDER_FULFILLMENT_FILTER_VALUES } from '@/lib/seller-order-filters'

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const isoDateTimeSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Invalid datetime value.'
})

export const searchModeSchema = z.enum(['keyword', 'gtin'])
export const itemConditionSchema = z.enum(['new', 'open_box', 'used'])
export const resultsConditionFilterSchema = z.enum(RESULTS_CONDITION_VALUES)
export const buyingFormatFilterSchema = z.enum(BUYING_FORMAT_VALUES)
export const sellerOrderFulfillmentFilterSchema = z.enum(SELLER_ORDER_FULFILLMENT_FILTER_VALUES)
export const listingSortModeSchema = z.enum(LISTING_SORT_MODES)

function isAllowedResultLimit(value: number) {
  return RESULT_LIMIT_VALUES.includes(value as (typeof RESULT_LIMIT_VALUES)[number])
}

function isAllowedMinMatchScore(value: number) {
  return MIN_MATCH_SCORE_VALUES.includes(value as (typeof MIN_MATCH_SCORE_VALUES)[number])
}

function isAllowedListingAgeDays(value: number) {
  return LISTING_AGE_DAY_VALUES.includes(value as (typeof LISTING_AGE_DAY_VALUES)[number])
}

export const listingResultSchema = z.object({
  title: z.string(),
  price: z.number(),
  currency: z.string(),
  shippingCost: z.number(),
  shippingKnown: z.boolean(),
  totalPrice: z.number(),
  condition: z.string(),
  conditionId: z.string().nullable(),
  itemUrl: z.string().url(),
  itemId: z.string(),
  sellerUsername: z.string().nullable(),
  sellerFeedbackPercentage: z.number().nullable(),
  itemLocation: z
    .object({
      city: z.string().nullable(),
      stateOrProvince: z.string().nullable(),
      country: z.string().nullable(),
      postalCode: z.string().nullable()
    })
    .nullable(),
  matchScore: z.number(),
  primaryImageUrl: z.string().url().nullable(),
  thumbnailUrl: z.string().url().nullable(),
  additionalImageUrls: z.array(z.string().url()).default([]),
  itemCreationDate: isoDateTimeSchema.nullable(),
  itemOriginDate: isoDateTimeSchema.nullable(),
  itemEndDate: isoDateTimeSchema.nullable(),
  buyingOptions: z.array(z.string()).default([])
})

export const manualSoldCompSchema = z.object({
  title: z.string(),
  soldPrice: z.number().min(0).nullable(),
  shippingCost: z.number().min(0).nullable(),
  condition: z.string(),
  soldDate: dateOnlySchema.nullable(),
  notes: z.string()
})

export const searchRequestSchema = z.object({
  mode: searchModeSchema,
  query: z.string().trim().min(1).max(100),
  condition: itemConditionSchema,
  resultsCondition: resultsConditionFilterSchema.default(DEFAULT_SEARCH_FILTERS.resultsCondition),
  buyingOptions: buyingFormatFilterSchema.default(DEFAULT_SEARCH_FILTERS.buyingOptions),
  minPrice: z.number().min(0).nullable().default(null),
  maxPrice: z.number().min(0).nullable().default(null),
  freeShipping: z.boolean().default(DEFAULT_SEARCH_FILTERS.freeShipping),
  sort: listingSortModeSchema.default(DEFAULT_SEARCH_FILTERS.sort),
  limit: z.number().int().refine(isAllowedResultLimit).default(DEFAULT_SEARCH_FILTERS.limit),
  excludeWords: z.string().trim().max(200).default(''),
  minMatchScore: z.number().refine(isAllowedMinMatchScore).nullable().default(DEFAULT_SEARCH_FILTERS.minMatchScore),
  listingAgeDays: z.number().int().refine(isAllowedListingAgeDays).nullable().default(DEFAULT_SEARCH_FILTERS.listingAgeDays)
})

export const analyzeRequestSchema = searchRequestSchema.extend({
  storePrice: z.number().min(0),
  sellerShippingCost: z.number().min(0),
  feeRate: z.number().min(0).max(1),
  packagingCost: z.number().min(0),
  promotedListingCost: z.number().min(0),
  safetyBuffer: z.number().min(0),
  targetProfit: z.number().min(0),
  excludedCount: z.number().int().min(0).optional(),
  comparisonListings: z.array(listingResultSchema).default([]),
  manualSoldComps: z.array(manualSoldCompSchema).default([])
})

export const sellerOrderSyncFiltersSchema = z.object({
  startDate: dateOnlySchema.optional(),
  endDate: dateOnlySchema.optional(),
  fulfillmentStatus: sellerOrderFulfillmentFilterSchema.optional()
})
