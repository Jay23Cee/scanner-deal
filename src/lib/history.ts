import { prisma } from '@/lib/db/client'
import {
  SearchLogDetail,
  SearchLogStatus,
  SearchLogSummary,
  SearchRequestPayload,
  SearchResponsePayload
} from '@/lib/types'

type SearchLogRecord = {
  id: string
  createdAt: Date
  status: string
  mode: string
  query: string
  selectedCondition: string
  resultsCondition: string
  buyingOptions: string
  minPrice: number | null
  maxPrice: number | null
  freeShipping: boolean
  sort: string
  limit: number
  excludeWords: string
  minMatchScore: number | null
  listingAgeDays: number | null
  marketplaceId: string | null
  environment: string | null
  totalReturned: number | null
  excludedCount: number | null
  fallbackApplied: boolean
  fallbackReason: string | null
  errorMessage: string | null
}

function mapStatus(status: string): SearchLogStatus {
  return status === 'error' ? 'error' : 'success'
}

function mapSearchLogSummary(searchLog: Pick<
  SearchLogRecord,
  | 'id'
  | 'createdAt'
  | 'status'
  | 'mode'
  | 'query'
  | 'selectedCondition'
  | 'totalReturned'
  | 'excludedCount'
  | 'fallbackApplied'
  | 'errorMessage'
>): SearchLogSummary {
  return {
    id: searchLog.id,
    createdAt: searchLog.createdAt,
    status: mapStatus(searchLog.status),
    mode: searchLog.mode as SearchLogSummary['mode'],
    query: searchLog.query,
    selectedCondition: searchLog.selectedCondition as SearchLogSummary['selectedCondition'],
    totalReturned: searchLog.totalReturned,
    excludedCount: searchLog.excludedCount,
    fallbackApplied: searchLog.fallbackApplied,
    errorMessage: searchLog.errorMessage
  }
}

function mapSearchLogDetail(searchLog: SearchLogRecord): SearchLogDetail {
  return {
    ...mapSearchLogSummary(searchLog),
    resultsCondition: searchLog.resultsCondition as SearchLogDetail['resultsCondition'],
    buyingOptions: searchLog.buyingOptions as SearchLogDetail['buyingOptions'],
    minPrice: searchLog.minPrice,
    maxPrice: searchLog.maxPrice,
    freeShipping: searchLog.freeShipping,
    sort: searchLog.sort as SearchLogDetail['sort'],
    limit: searchLog.limit,
    excludeWords: searchLog.excludeWords,
    minMatchScore: searchLog.minMatchScore,
    listingAgeDays: searchLog.listingAgeDays,
    marketplaceId: searchLog.marketplaceId,
    environment: searchLog.environment as SearchLogDetail['environment'],
    fallbackReason: searchLog.fallbackReason
  }
}

export async function createSearchLog(input: {
  request: SearchRequestPayload
  status: SearchLogStatus
  response?: SearchResponsePayload
  errorMessage?: string
}) {
  const request = input.request
  const response = input.response

  return prisma.searchLog.create({
    data: {
      status: input.status,
      mode: request.mode,
      query: request.query.trim(),
      selectedCondition: request.condition,
      resultsCondition: request.resultsCondition,
      buyingOptions: request.buyingOptions,
      minPrice: request.minPrice,
      maxPrice: request.maxPrice,
      freeShipping: request.freeShipping,
      sort: request.sort,
      limit: request.limit,
      excludeWords: request.excludeWords,
      minMatchScore: request.minMatchScore,
      listingAgeDays: request.listingAgeDays,
      marketplaceId: response?.marketplaceId ?? null,
      environment: response?.environment ?? null,
      totalReturned: response?.totalReturned ?? null,
      excludedCount: response?.excludedCount ?? null,
      fallbackApplied: response?.fallbackApplied ?? false,
      fallbackReason: response?.fallbackReason ?? null,
      errorMessage: input.errorMessage ?? null
    }
  })
}

export async function getRecentSearchLogs(limit = 50): Promise<SearchLogSummary[]> {
  const searchLogs = await prisma.searchLog.findMany({
    orderBy: {
      createdAt: 'desc'
    },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      status: true,
      mode: true,
      query: true,
      selectedCondition: true,
      totalReturned: true,
      excludedCount: true,
      fallbackApplied: true,
      errorMessage: true
    }
  })

  return searchLogs.map(mapSearchLogSummary)
}

export async function getSearchLogById(searchId: string): Promise<SearchLogDetail | null> {
  const searchLog = await prisma.searchLog.findUnique({
    where: {
      id: searchId
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      mode: true,
      query: true,
      selectedCondition: true,
      resultsCondition: true,
      buyingOptions: true,
      minPrice: true,
      maxPrice: true,
      freeShipping: true,
      sort: true,
      limit: true,
      excludeWords: true,
      minMatchScore: true,
      listingAgeDays: true,
      marketplaceId: true,
      environment: true,
      totalReturned: true,
      excludedCount: true,
      fallbackApplied: true,
      fallbackReason: true,
      errorMessage: true
    }
  })

  if (!searchLog) {
    return null
  }

  return mapSearchLogDetail(searchLog)
}
