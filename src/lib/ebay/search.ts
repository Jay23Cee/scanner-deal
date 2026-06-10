import { EbayApiError, getAppAccessToken, getEbayServerConfig } from '@/lib/ebay/auth'
import {
  applyListingPostFilters,
  getSuggestedComparisonItemIds,
  mapBuyingOptionsToBrowseFilter,
  mapResultsConditionToBrowseFilter,
  normalizeBrowseItems
} from '@/lib/ebay/normalize'
import { SearchRequestPayload } from '@/lib/types'

type FetchLike = typeof fetch

type RawBrowseResponse = {
  itemSummaries?: unknown[]
  total?: number
}

const SEARCH_FIELDGROUPS = [
  'MATCHING_ITEMS',
  'EXTENDED',
  'CONDITION_REFINEMENTS',
  'BUYING_OPTION_REFINEMENTS',
  'CATEGORY_REFINEMENTS',
  'ASPECT_REFINEMENTS'
] as const

function buildPriceFilter(minPrice: number | null, maxPrice: number | null) {
  if (minPrice === null && maxPrice === null) {
    return []
  }

  const start = minPrice === null ? '' : String(minPrice)
  const end = maxPrice === null ? '' : String(maxPrice)
  return [`price:[${start}..${end}]`, 'priceCurrency:USD']
}

function buildBrowseFilterParts(input: SearchRequestPayload, includeConditionFilter = true) {
  const parts = [
    ...(includeConditionFilter
      ? [mapResultsConditionToBrowseFilter(input.resultsCondition)].filter(Boolean)
      : []),
    mapBuyingOptionsToBrowseFilter(input.buyingOptions),
    ...buildPriceFilter(input.minPrice, input.maxPrice),
    input.freeShipping ? 'maxDeliveryCost:0' : null
  ].filter((part): part is string => Boolean(part))

  return parts
}

function mapSortToBrowseSort(sort: SearchRequestPayload['sort']) {
  if (sort === 'lowest_total') {
    return 'price'
  }

  if (sort === 'highest_total') {
    return '-price'
  }

  if (sort === 'newest_listed') {
    return 'newlyListed'
  }

  if (sort === 'ending_soon') {
    return 'endingSoonest'
  }

  return null
}

export function buildBrowseSearchRequest(input: {
  token: string
  browseBaseUrl: string
  marketplaceId: string
  search: SearchRequestPayload
  includeConditionFilter?: boolean
}) {
  const params = new URLSearchParams({
    fieldgroups: SEARCH_FIELDGROUPS.join(','),
    limit: String(input.search.limit)
  })

  const query = input.search.query.trim()
  if (input.search.mode === 'keyword') {
    params.set('q', query)
  } else {
    params.set('gtin', query)
  }

  const filterParts = buildBrowseFilterParts(input.search, input.includeConditionFilter !== false)
  if (filterParts.length > 0) {
    params.set('filter', filterParts.join(','))
  }

  const sort = mapSortToBrowseSort(input.search.sort)
  if (sort) {
    params.set('sort', sort)
  }

  return {
    url: `${input.browseBaseUrl}/item_summary/search?${params.toString()}`,
    init: {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.token}`,
        'X-EBAY-C-MARKETPLACE-ID': input.marketplaceId
      },
      cache: 'no-store' as const
    }
  }
}

function parseEbayResponseError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  if ('errors' in payload && Array.isArray(payload.errors) && payload.errors.length > 0) {
    const messages = payload.errors
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null
        }

        if ('longMessage' in entry && typeof entry.longMessage === 'string') {
          return entry.longMessage
        }

        if ('message' in entry && typeof entry.message === 'string') {
          return entry.message
        }

        return null
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join(' | ')
    }
  }

  return null
}

async function fetchBrowsePage(
  input: SearchRequestPayload,
  fetchImpl: FetchLike,
  includeConditionFilter = true
) {
  const config = getEbayServerConfig()
  const token = await getAppAccessToken(fetchImpl)
  const { url, init } = buildBrowseSearchRequest({
    token,
    browseBaseUrl: config.browseBaseUrl,
    marketplaceId: config.marketplaceId,
    search: input,
    includeConditionFilter
  })

  let response: Response
  try {
    response = await fetchImpl(url, init)
  } catch (error) {
    throw new EbayApiError(
      `Failed to call eBay Browse search: ${
        error instanceof Error ? error.message : 'unknown network error'
      }.`,
      502
    )
  }

  let payload: RawBrowseResponse | Record<string, unknown> | null = null
  try {
    payload = (await response.json()) as RawBrowseResponse
  } catch {
    payload = null
  }

  if (!response.ok) {
    const detail = parseEbayResponseError(payload) ?? `HTTP ${response.status}`
    const hint =
      response.status === 400
        ? ' Check the Browse filter, sort, and marketplace values being sent.'
        : response.status === 401
          ? ' The OAuth token was rejected by eBay.'
          : response.status === 429
            ? ' eBay rate limited the request. Try again shortly.'
            : ''
    throw new EbayApiError(`eBay Browse search failed (${response.status}): ${detail}.${hint}`, response.status)
  }

  const itemSummaries = Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : []

  return {
    config,
    itemSummaries,
    total: typeof payload?.total === 'number' ? payload.total : itemSummaries.length
  }
}

export async function searchBrowseListings(
  input: SearchRequestPayload,
  fetchImpl: FetchLike = fetch
) {
  const initialResponse = await fetchBrowsePage(input, fetchImpl, true)
  const hadConditionFilter = mapResultsConditionToBrowseFilter(input.resultsCondition) !== null
  const shouldRetryWithoutCondition = hadConditionFilter && initialResponse.itemSummaries.length === 0

  const finalResponse = shouldRetryWithoutCondition
    ? await fetchBrowsePage(input, fetchImpl, false)
    : initialResponse

  const normalized = normalizeBrowseItems(finalResponse.itemSummaries as never[], input)
  const postFiltered = applyListingPostFilters(normalized.rawListings, {
    resultsCondition: input.resultsCondition,
    buyingOptions: input.buyingOptions,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    freeShipping: input.freeShipping,
    sort: input.sort,
    limit: input.limit,
    excludeWords: input.excludeWords,
    minMatchScore: input.minMatchScore,
    listingAgeDays: input.listingAgeDays
  })

  const suggestedComparisonItemIds = getSuggestedComparisonItemIds(postFiltered.rawListings, input.condition)
  const fallbackReason =
    shouldRetryWithoutCondition && finalResponse.itemSummaries.length > 0
      ? `No listings were returned for the initial eBay condition filter, so the app retried without that Browse condition filter and reapplied the chosen results condition locally.`
      : shouldRetryWithoutCondition
        ? 'The eBay Browse condition filter returned zero items and the broader retry also returned zero items.'
        : undefined

  return {
    mode: input.mode,
    query: input.query.trim(),
    marketplaceId: finalResponse.config.marketplaceId,
    environment: finalResponse.config.environment,
    totalReturned: postFiltered.rawListings.length,
    rawListings: postFiltered.rawListings,
    suggestedComparisonItemIds,
    excludedCount: normalized.excludedCount + postFiltered.excludedCount,
    fallbackApplied: shouldRetryWithoutCondition,
    fallbackReason
  }
}
