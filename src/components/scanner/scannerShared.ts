import {
  DealAnalysisPayload,
  ItemCondition,
  ListingResult,
  ManualSoldComp,
  SearchFilters,
  SearchMode,
  SearchResponsePayload
} from '@/lib/types'
import { createDefaultManualSoldComps } from '@/lib/manual-sold-comps'
import { deriveEbaySoldSearchQuery } from '@/lib/ebay/sold'
import { buildEbayActiveSearchUrl, buildEbaySoldCompsUrl } from '@/lib/ebayLinks'
import { createDefaultSearchFilters } from '@/lib/search-filters'

export type SearchState = {
  mode: SearchMode
  query: string
  condition: ItemCondition
}

export type WorkflowMode = 'quick_check' | 'full_analysis' | 'board_view'
export type SearchSessionSource = 'keyword' | 'gtin' | 'image'
export type PictureSearchStatus = 'idle' | 'uploading' | 'ready' | 'error'

export type SearchRequestResult = {
  ok: boolean
  error?: string
}

export type SessionSearchStatus = 'idle' | 'searching' | 'ready' | 'error'

export type SessionManualSoldComp = ManualSoldComp & {
  id: string
}

export type SessionPanelState = {
  results: boolean
  filters: boolean
  selectedComps: boolean
  analysis: boolean
}

export type PictureSearchState = {
  status: PictureSearchStatus
  previewUrl: string | null
  previewName: string | null
  detectedTitle: string
  fallbackMessage: string | null
  error: string | null
}

export type SearchSession = {
  id: string
  source: SearchSessionSource
  mode: SearchMode
  query: string
  condition: ItemCondition
  marketplaceId: string | null
  environment: SearchResponsePayload['environment'] | null
  totalReturned: number
  rawListings: ListingResult[]
  suggestedComparisonItemIds: string[]
  selectedComparisonListings: ListingResult[]
  rawListingsActiveIndex: number
  selectedListingsActiveIndex: number
  soldSearchQuery: string
  soldCompsUrl: string
  activeSearchUrl: string
  soldSearchQueryEdited: boolean
  manualSoldComps: SessionManualSoldComp[]
  excludedCount: number
  fallbackApplied: boolean
  fallbackReason?: string
  draftFilters: SearchFilters
  appliedFilters: SearchFilters
  storePrice: number
  analysis: DealAnalysisPayload | null
  error: string | null
  searchStatus: SessionSearchStatus
  analyzing: boolean
  updatedAt: string
}

export const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

export const updatedAtFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

export function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.round(Math.random() * 100000)}`
}

export function createDefaultSessionPanelState(
  workflowMode: WorkflowMode = 'quick_check'
): SessionPanelState {
  if (workflowMode === 'full_analysis') {
    return {
      results: true,
      filters: false,
      selectedComps: true,
      analysis: true
    }
  }

  return {
    results: true,
    filters: false,
    selectedComps: false,
    analysis: false
  }
}

export function buildSessionEbayLinks(query: string) {
  return {
    soldCompsUrl: buildEbaySoldCompsUrl(query),
    activeSearchUrl: buildEbayActiveSearchUrl(query)
  }
}

export function createDefaultPictureSearchState(): PictureSearchState {
  return {
    status: 'idle',
    previewUrl: null,
    previewName: null,
    detectedTitle: '',
    fallbackMessage: null,
    error: null
  }
}

export function applySearchResponseToSession(
  session: SearchSession,
  payload: SearchResponsePayload
): SearchSession {
  const soldSearchQuery = session.soldSearchQueryEdited
    ? session.soldSearchQuery
    : deriveEbaySoldSearchQuery({
        mode: session.mode,
        query: session.query,
        rawListings: payload.rawListings
      })

  return {
    ...session,
    soldSearchQuery,
    ...buildSessionEbayLinks(soldSearchQuery),
    marketplaceId: payload.marketplaceId,
    environment: payload.environment,
    totalReturned: payload.totalReturned,
    rawListings: payload.rawListings,
    suggestedComparisonItemIds: payload.suggestedComparisonItemIds,
    selectedComparisonListings: [],
    rawListingsActiveIndex: 0,
    selectedListingsActiveIndex: 0,
    excludedCount: payload.excludedCount,
    fallbackApplied: payload.fallbackApplied,
    fallbackReason: payload.fallbackReason,
    error: null,
    searchStatus: 'ready',
    updatedAt: new Date().toISOString()
  }
}

function deriveSearchSessionSource(
  searchState: SearchState,
  sourceOverride?: SearchSessionSource
): SearchSessionSource {
  if (sourceOverride) {
    return sourceOverride
  }

  return searchState.mode === 'gtin' ? 'gtin' : 'keyword'
}

export function buildPendingSession(
  searchState: SearchState,
  options?: {
    source?: SearchSessionSource
  }
): SearchSession {
  const defaultFilters = createDefaultSearchFilters()
  const soldSearchQuery = searchState.query.trim()

  return {
    id: createSessionId(),
    source: deriveSearchSessionSource(searchState, options?.source),
    mode: searchState.mode,
    query: searchState.query.trim(),
    condition: searchState.condition,
    marketplaceId: null,
    environment: null,
    totalReturned: 0,
    rawListings: [],
    suggestedComparisonItemIds: [],
    selectedComparisonListings: [],
    rawListingsActiveIndex: 0,
    selectedListingsActiveIndex: 0,
    soldSearchQuery,
    ...buildSessionEbayLinks(soldSearchQuery),
    soldSearchQueryEdited: false,
    manualSoldComps: buildSessionManualSoldComps(),
    excludedCount: 0,
    fallbackApplied: false,
    fallbackReason: undefined,
    draftFilters: defaultFilters,
    appliedFilters: defaultFilters,
    storePrice: 0,
    analysis: null,
    error: null,
    searchStatus: 'searching',
    analyzing: false,
    updatedAt: new Date().toISOString()
  }
}

export function buildSessionManualSoldComp(
  comp: Partial<ManualSoldComp> = {}
): SessionManualSoldComp {
  return {
    id: createSessionId(),
    title: comp.title ?? '',
    soldPrice: comp.soldPrice ?? null,
    shippingCost: comp.shippingCost ?? null,
    condition: comp.condition ?? '',
    soldDate: comp.soldDate ?? null,
    notes: comp.notes ?? ''
  }
}

export function buildSessionManualSoldComps(count?: number) {
  return createDefaultManualSoldComps(count).map((comp) => buildSessionManualSoldComp(comp))
}

export function formatConditionLabel(condition: ItemCondition) {
  if (condition === 'open_box') {
    return 'Open box'
  }

  return condition.charAt(0).toUpperCase() + condition.slice(1)
}
