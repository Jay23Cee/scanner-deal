import { EbayApiError, getAppAccessToken, getEbayServerConfig, parseEbayErrorPayload } from '@/lib/ebay/auth'
import {
  applyListingPostFilters,
  getSuggestedComparisonItemIds,
  mapResultsConditionToBrowseFilter,
  normalizeBrowseItems
} from '@/lib/ebay/normalize'
import { cleanEbayQuery } from '@/lib/ebayLinks'
import { createDefaultSearchFilters } from '@/lib/search-filters'
import { ImageSearchResponsePayload, ItemCondition, SearchResponsePayload } from '@/lib/types'

type FetchLike = typeof fetch

type RawBrowseResponse = {
  itemSummaries?: unknown[]
}

type RawBrowseItem = {
  title?: string
}

const IMAGE_SEARCH_FIELDGROUPS = [
  'MATCHING_ITEMS',
  'EXTENDED',
  'CONDITION_REFINEMENTS',
  'BUYING_OPTION_REFINEMENTS',
  'CATEGORY_REFINEMENTS',
  'ASPECT_REFINEMENTS'
] as const

export const DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE =
  'Could not confidently identify this item. Try retaking the picture or use keyword search above.'

export const IMAGE_SEARCH_RESULT_LIMIT = 25

function mapItemConditionToResultsCondition(condition: ItemCondition) {
  if (condition === 'new') {
    return 'new'
  }

  if (condition === 'open_box') {
    return 'open_box'
  }

  return 'used'
}

function buildImageSearchRequest(input: {
  imageBase64: string
  browseBaseUrl: string
  marketplaceId: string
  token: string
  condition: ItemCondition
  includeConditionFilter: boolean
}) {
  const params = new URLSearchParams({
    fieldgroups: IMAGE_SEARCH_FIELDGROUPS.join(','),
    limit: String(IMAGE_SEARCH_RESULT_LIMIT)
  })

  const conditionFilter = mapResultsConditionToBrowseFilter(
    mapItemConditionToResultsCondition(input.condition)
  )

  if (input.includeConditionFilter && conditionFilter) {
    params.set('filter', conditionFilter)
  }

  return {
    url: `${input.browseBaseUrl}/item_summary/search_by_image?${params.toString()}`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${input.token}`,
        'Content-Type': 'application/json',
        'X-EBAY-C-MARKETPLACE-ID': input.marketplaceId
      },
      body: JSON.stringify({
        image: input.imageBase64
      }),
      cache: 'no-store' as const
    }
  }
}

function getImageSearchFallbackReason(
  shouldRetryWithoutCondition: boolean,
  finalItemCount: number
) {
  if (!shouldRetryWithoutCondition) {
    return undefined
  }

  if (finalItemCount > 0) {
    return 'No listings were returned for the initial eBay image condition filter, so the app retried without that Browse condition filter and reapplied the chosen target condition locally.'
  }

  return 'The eBay image condition filter returned zero items and the broader retry also returned zero items.'
}

function getFirstDetectedTitle(items: RawBrowseItem[]) {
  for (const item of items) {
    const title = cleanEbayQuery(item.title ?? '')
    if (title) {
      return title
    }
  }

  return ''
}

async function fetchImageSearchPage(
  input: {
    imageBase64: string
    condition: ItemCondition
  },
  fetchImpl: FetchLike,
  includeConditionFilter: boolean
) {
  const config = getEbayServerConfig()

  if (config.environment !== 'production') {
    throw new EbayApiError(
      'Picture search requires EBAY_ENV=production because eBay searchByImage is not supported in sandbox.',
      409
    )
  }

  const token = await getAppAccessToken(fetchImpl)
  const { url, init } = buildImageSearchRequest({
    imageBase64: input.imageBase64,
    browseBaseUrl: config.browseBaseUrl,
    marketplaceId: config.marketplaceId,
    token,
    condition: input.condition,
    includeConditionFilter
  })

  let response: Response
  try {
    response = await fetchImpl(url, init)
  } catch (error) {
    throw new EbayApiError(
      `Failed to call eBay image search: ${
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
    const detail = parseEbayErrorPayload(payload) ?? `HTTP ${response.status}`
    const hint =
      response.status === 400
        ? ' Check the Browse image-search request being sent.'
        : response.status === 401
          ? ' The OAuth token was rejected by eBay.'
          : response.status === 429
            ? ' eBay rate limited the request. Try again shortly.'
            : ''
    throw new EbayApiError(
      `eBay image search failed (${response.status}): ${detail}.${hint}`,
      response.status
    )
  }

  return {
    config,
    itemSummaries: Array.isArray(payload?.itemSummaries) ? payload.itemSummaries : []
  }
}

function buildImageSearchSessionPayload(input: {
  itemSummaries: unknown[]
  condition: ItemCondition
  marketplaceId: string
  environment: SearchResponsePayload['environment']
  shouldRetryWithoutCondition: boolean
}): ImageSearchResponsePayload {
  const detectedTitle = getFirstDetectedTitle(input.itemSummaries as RawBrowseItem[])

  if (!detectedTitle) {
    return {
      detectedTitle: '',
      session: null,
      fallbackMessage: DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE
    }
  }

  const normalized = normalizeBrowseItems(input.itemSummaries as never[], {
    mode: 'keyword',
    query: detectedTitle,
    condition: input.condition
  })
  const postFiltered = applyListingPostFilters(normalized.rawListings, {
    ...createDefaultSearchFilters(),
    resultsCondition: mapItemConditionToResultsCondition(input.condition)
  })
  const rawListings = postFiltered.rawListings
  const resolvedTitle = cleanEbayQuery(rawListings[0]?.title ?? detectedTitle) || detectedTitle

  if (rawListings.length === 0) {
    return {
      detectedTitle: resolvedTitle,
      session: null,
      fallbackMessage: DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE
    }
  }

  return {
    detectedTitle: resolvedTitle,
    session: {
      mode: 'keyword',
      query: resolvedTitle,
      marketplaceId: input.marketplaceId,
      environment: input.environment,
      totalReturned: rawListings.length,
      rawListings,
      suggestedComparisonItemIds: getSuggestedComparisonItemIds(rawListings, input.condition),
      excludedCount: normalized.excludedCount + postFiltered.excludedCount,
      fallbackApplied: input.shouldRetryWithoutCondition,
      fallbackReason: getImageSearchFallbackReason(
        input.shouldRetryWithoutCondition,
        rawListings.length
      )
    }
  }
}

export async function searchImageSession(
  input: {
    imageBase64: string
    condition: ItemCondition
  },
  fetchImpl: FetchLike = fetch
): Promise<ImageSearchResponsePayload> {
  const initialResponse = await fetchImageSearchPage(input, fetchImpl, true)
  const shouldRetryWithoutCondition = initialResponse.itemSummaries.length === 0
  const finalResponse = shouldRetryWithoutCondition
    ? await fetchImageSearchPage(input, fetchImpl, false)
    : initialResponse

  return buildImageSearchSessionPayload({
    itemSummaries: finalResponse.itemSummaries,
    condition: input.condition,
    marketplaceId: finalResponse.config.marketplaceId,
    environment: finalResponse.config.environment,
    shouldRetryWithoutCondition
  })
}
