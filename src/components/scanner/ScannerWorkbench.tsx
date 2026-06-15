'use client'

import { useEffect, useRef, useState } from 'react'
import { ScannerAssumptionsPanel } from '@/components/scanner/ScannerAssumptionsPanel'
import { ScannerSearchPanel } from '@/components/scanner/ScannerSearchPanel'
import { ScannerSessionCard } from '@/components/scanner/ScannerSessionCard'
import {
  applySearchResponseToSession,
  buildSessionEbayLinks,
  buildPendingSession,
  createSessionId,
  createDefaultPictureSearchState,
  createDefaultSessionPanelState,
  PictureSearchState,
  SearchRequestResult,
  SearchSession,
  SearchState,
  SessionPanelState,
  WorkflowMode
} from '@/components/scanner/scannerShared'
import { useScannerSearchSubmit } from '@/components/scanner/useScannerSearchSubmit'
import { getImageSearchUnavailableMessage } from '@/lib/image-search/messages'
import { createDefaultSearchFilters } from '@/lib/search-filters'
import { defaultScannerSettings, loadScannerSettings } from '@/lib/settings'
import {
  DealAnalysisPayload,
  ImageSearchFeatureState,
  ImageSearchResponsePayload,
  ItemCondition,
  ListingResult,
  ManualSoldComp,
  SearchFilters,
  SearchMode,
  SearchResponsePayload
} from '@/lib/types'

const DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE =
  'Could not confidently identify this item. Try retaking the picture or use keyword search above.'

const DEFAULT_IMAGE_SEARCH_FEATURE_STATE: ImageSearchFeatureState = {
  status: 'available',
  missingConfiguration: []
}

function revokeObjectUrl(url: string | null) {
  if (!url || typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
    return
  }

  URL.revokeObjectURL(url)
}

type ScannerWorkbenchProps = {
  initialImageSearchFeatureState?: ImageSearchFeatureState
}

export function ScannerWorkbench({
  initialImageSearchFeatureState = DEFAULT_IMAGE_SEARCH_FEATURE_STATE
}: ScannerWorkbenchProps) {
  const queryInputRef = useRef<HTMLInputElement | null>(null)
  const imagePreviewUrlsRef = useRef<string[]>([])
  const [searchState, setSearchState] = useState<SearchState>({
    mode: 'keyword',
    query: '',
    condition: 'used'
  })
  const [sellerShippingCost, setSellerShippingCost] = useState(defaultScannerSettings.sellerShippingCost)
  const [feeRate, setFeeRate] = useState(defaultScannerSettings.feeRate)
  const [packagingCost, setPackagingCost] = useState(defaultScannerSettings.packagingCost)
  const [promotedListingCost, setPromotedListingCost] = useState(defaultScannerSettings.promotedListingCost)
  const [safetyBuffer, setSafetyBuffer] = useState(defaultScannerSettings.safetyBuffer)
  const [targetProfit, setTargetProfit] = useState(defaultScannerSettings.targetProfit)
  const [sessions, setSessions] = useState<SearchSession[]>([])
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('quick_check')
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [panelState, setPanelState] = useState<SessionPanelState>(
    createDefaultSessionPanelState('quick_check')
  )
  const [imageSearch, setImageSearch] = useState<PictureSearchState>(createDefaultPictureSearchState())
  const [addingSearch, setAddingSearch] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [searchFeedback, setSearchFeedback] = useState<string | null>(null)
  const imageSearchUnavailableMessage = getImageSearchUnavailableMessage(initialImageSearchFeatureState)

  useEffect(() => {
    const stored = loadScannerSettings()
    setSellerShippingCost(stored.sellerShippingCost)
    setFeeRate(stored.feeRate)
    setPackagingCost(stored.packagingCost)
    setPromotedListingCost(stored.promotedListingCost)
    setSafetyBuffer(stored.safetyBuffer)
    setTargetProfit(stored.targetProfit)
  }, [])

  useEffect(() => {
    if (sessions.length === 0) {
      if (activeSessionId !== null) {
        setActiveSessionId(null)
      }
      return
    }

    if (!activeSessionId || !sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(sessions[0]?.id ?? null)
    }
  }, [activeSessionId, sessions])

  useEffect(() => {
    const currentPreviewUrls = imageSearch.items
      .map((item) => item.previewUrl)
      .filter((previewUrl): previewUrl is string => Boolean(previewUrl))

    for (const previewUrl of imagePreviewUrlsRef.current) {
      if (!currentPreviewUrls.includes(previewUrl)) {
        revokeObjectUrl(previewUrl)
      }
    }

    imagePreviewUrlsRef.current = currentPreviewUrls
  }, [imageSearch.items])

  useEffect(() => {
    return () => {
      for (const previewUrl of imagePreviewUrlsRef.current) {
        revokeObjectUrl(previewUrl)
      }

      imagePreviewUrlsRef.current = []
    }
  }, [])

  function updateSearchFormState(nextState: Partial<SearchState>) {
    setGlobalError(null)
    setSearchFeedback(null)
    setSearchState((current) => ({
      ...current,
      ...nextState
    }))
  }

  function updateSession(sessionId: string, updater: (session: SearchSession) => SearchSession) {
    setSessions((current) =>
      current.map((session) => (session.id === sessionId ? updater(session) : session))
    )
  }

  function createImagePreviewUrl(file: File) {
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null
    }

    return URL.createObjectURL(file)
  }

  function buildPictureSearchItem(file: File) {
    return {
      id: createSessionId(),
      previewUrl: createImagePreviewUrl(file),
      previewName: file.name,
      status: 'queued' as const,
      detectedTitle: '',
      fallbackMessage: null,
      error: null,
      sessionId: null
    }
  }

  function setWorkflowModeState(nextMode: WorkflowMode) {
    setWorkflowMode(nextMode)
    setPanelState(createDefaultSessionPanelState(nextMode))
  }

  function activateSession(sessionId: string) {
    if (activeSessionId === sessionId) {
      return
    }

    setActiveSessionId(sessionId)
    setPanelState(createDefaultSessionPanelState(workflowMode))
  }

  function togglePanel(panelKey: keyof SessionPanelState) {
    setPanelState((current) => ({
      ...current,
      [panelKey]: !current[panelKey]
    }))
  }

  async function requestSearch(
    sessionId: string,
    input: { mode: SearchMode; query: string; condition: ItemCondition } & SearchFilters
  ): Promise<SearchRequestResult> {
    try {
      const response = await fetch('/api/ebay/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      const payload = (await response.json()) as SearchResponsePayload & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Search failed.')
      }

      updateSession(sessionId, (session) => applySearchResponseToSession(session, payload))

      return { ok: true }
    } catch (nextError) {
      const errorMessage = nextError instanceof Error ? nextError.message : 'Search failed.'

      updateSession(sessionId, (session) => ({
        ...session,
        selectedComparisonListings: [],
        rawListingsActiveIndex: 0,
        selectedListingsActiveIndex: 0,
        searchStatus: 'error',
        error: errorMessage,
        updatedAt: new Date().toISOString()
      }))

      return {
        ok: false,
        error: errorMessage
      }
    }
  }

  async function addSessionAndRunSearch(nextSession: SearchSession) {
    setAddingSearch(true)
    setGlobalError(null)
    setSearchFeedback('Searching eBay...')
    setWorkflowModeState('quick_check')
    setActiveSessionId(nextSession.id)
    setSessions((current) => [nextSession, ...current])

    try {
      const result = await requestSearch(nextSession.id, {
        mode: nextSession.mode,
        query: nextSession.query,
        condition: nextSession.condition,
        ...nextSession.appliedFilters
      })

      if (result.ok) {
        setSearchFeedback('Search added to board.')
        return true
      }

      setSearchFeedback(null)
      setGlobalError(result.error ?? 'Search failed.')
      return false
    } finally {
      setAddingSearch(false)
    }
  }

  async function runSearch(rawQuery: string) {
    if (addingSearch) {
      return
    }

    const normalizedQuery = rawQuery.trim()

    if (!normalizedQuery) {
      setGlobalError('Enter a keyword or GTIN before searching.')
      setSearchFeedback(null)
      return
    }

    const nextSearchState = {
      ...searchState,
      query: normalizedQuery
    }

    setSearchState(nextSearchState)

    const nextSession = buildPendingSession(nextSearchState)
    await addSessionAndRunSearch(nextSession)
  }

  const { formRef, searchButtonRef } = useScannerSearchSubmit({
    queryInputRef,
    onSubmitSearch: runSearch
  })

  function updateImageSearchItem(
    itemId: string,
    updater: (item: PictureSearchState['items'][number]) => PictureSearchState['items'][number]
  ) {
    setImageSearch((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? updater(item) : item))
    }))
  }

  function updateImageSearchActiveIndex(index: number) {
    setImageSearch((current) => ({
      ...current,
      activeIndex: index
    }))
  }

  function getImageSessionSoldQuery(sessionId: string) {
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return null
    }

    return session.soldSearchQuery.trim() || session.query.trim() || null
  }

  async function runImageSearch(files: File[]) {
    if (files.length === 0) {
      return
    }

    if (initialImageSearchFeatureState.status !== 'available') {
      setImageSearch(createDefaultPictureSearchState())
      return
    }

    setGlobalError(null)
    setSearchFeedback(null)
    const nextItems = files.map((file) => buildPictureSearchItem(file))
    const targetCondition = searchState.condition
    const shouldFocusFirstSuccess = activeSessionId === null
    const batchSessionIds: string[] = []
    let matchedCount = 0
    let focusedSuccessfulMatch = false

    setImageSearch({
      status: 'processing',
      items: nextItems,
      activeIndex: 0
    })

    for (const [itemIndex, file] of files.entries()) {
      const nextItem = nextItems[itemIndex]
      if (!nextItem) {
        continue
      }

      updateImageSearchItem(nextItem.id, (current) => ({
        ...current,
        status: 'uploading',
        detectedTitle: '',
        fallbackMessage: null,
        error: null,
        sessionId: null
      }))

      try {
        const formData = new FormData()
        formData.append('image', file)
        formData.append('condition', targetCondition)

        const response = await fetch('/api/scanner/image-search', {
          method: 'POST',
          body: formData
        })
        const payload = (await response.json()) as ImageSearchResponsePayload & { error?: string }

        if (!response.ok) {
          updateImageSearchItem(nextItem.id, (current) => ({
            ...current,
            status: 'error',
            detectedTitle: '',
            fallbackMessage: payload.fallbackMessage?.trim() || DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE,
            error: payload.error ?? 'Image search failed.',
            sessionId: null
          }))
          continue
        }

        const detectedTitle = payload.detectedTitle.trim()
        const fallbackMessage = payload.fallbackMessage?.trim() || DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE

        if (!payload.session) {
          updateImageSearchItem(nextItem.id, (current) => ({
            ...current,
            status: 'no_match',
            detectedTitle,
            fallbackMessage,
            error: null,
            sessionId: null
          }))
          continue
        }

        const nextSession = applySearchResponseToSession(
          buildPendingSession(
            {
              mode: 'keyword',
              query: payload.session.query,
              condition: targetCondition
            },
            {
              source: 'image'
            }
          ),
          payload.session
        )
        const previousBatchSessionId = batchSessionIds[batchSessionIds.length - 1] ?? null
        batchSessionIds.push(nextSession.id)
        matchedCount += 1

        setSessions((current) => {
          const nextSessions = [...current]
          const anchorIndex = previousBatchSessionId
            ? nextSessions.findIndex((session) => session.id === previousBatchSessionId)
            : -1
          const insertIndex = anchorIndex >= 0 ? anchorIndex + 1 : 0
          nextSessions.splice(insertIndex, 0, nextSession)
          return nextSessions
        })

        if (shouldFocusFirstSuccess && !focusedSuccessfulMatch) {
          setWorkflowModeState('quick_check')
          setActiveSessionId(nextSession.id)
          focusedSuccessfulMatch = true
        }

        updateImageSearchItem(nextItem.id, (current) => ({
          ...current,
          status: 'ready',
          detectedTitle,
          fallbackMessage: null,
          error: null,
          sessionId: nextSession.id
        }))
      } catch (nextError) {
        updateImageSearchItem(nextItem.id, (current) => ({
          ...current,
          status: 'error',
          detectedTitle: '',
          fallbackMessage: DEFAULT_IMAGE_SEARCH_FALLBACK_MESSAGE,
          error: nextError instanceof Error ? nextError.message : 'Image search failed.',
          sessionId: null
        }))
      }
    }

    setImageSearch((current) => ({
      ...current,
      status: 'complete'
    }))

    if (matchedCount > 0) {
      setSearchFeedback(
        matchedCount === 1
          ? 'Picture search added to board.'
          : `${matchedCount} picture searches added to board.`
      )
    }
  }

  async function rerunSessionSearch(sessionId: string, nextFilters: SearchFilters) {
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return
    }

    activateSession(sessionId)
    setPanelState(createDefaultSessionPanelState(workflowMode))

    updateSession(sessionId, (current) => ({
      ...current,
      appliedFilters: { ...nextFilters },
      draftFilters: { ...nextFilters },
      selectedComparisonListings: [],
      rawListingsActiveIndex: 0,
      selectedListingsActiveIndex: 0,
      analysis: null,
      error: null,
      searchStatus: 'searching',
      updatedAt: new Date().toISOString()
    }))

    await requestSearch(sessionId, {
      mode: session.mode,
      query: session.query,
      condition: session.condition,
      ...nextFilters
    })
  }

  function toggleComparisonListing(sessionId: string, listing: ListingResult) {
    updateSession(sessionId, (current) => {
      const isSelected = current.selectedComparisonListings.some((entry) => entry.itemId === listing.itemId)
      return {
        ...current,
        selectedComparisonListings: isSelected
          ? current.selectedComparisonListings.filter((entry) => entry.itemId !== listing.itemId)
          : [...current.selectedComparisonListings, listing],
        selectedListingsActiveIndex: 0,
        analysis: null,
        error: null,
        updatedAt: new Date().toISOString()
      }
    })
  }

  async function runAnalysis(sessionId: string) {
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return
    }

    if (session.selectedComparisonListings.length === 0) {
      updateSession(sessionId, (current) => ({
        ...current,
        error: 'Select at least one listing to compare before analyzing.'
      }))
      return
    }

    activateSession(sessionId)

    updateSession(sessionId, (current) => ({
      ...current,
      analyzing: true,
      error: null
    }))

    try {
      const response = await fetch('/api/deal/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: session.mode,
          query: session.query,
          condition: session.condition,
          ...session.appliedFilters,
          soldSearchQuery: session.soldSearchQuery.trim() || session.query.trim(),
          storePrice: session.storePrice,
          sellerShippingCost,
          feeRate,
          packagingCost,
          promotedListingCost,
          safetyBuffer,
          targetProfit,
          excludedCount: session.excludedCount,
          comparisonListings: session.selectedComparisonListings,
          manualSoldComps: session.manualSoldComps.map(({ id: _id, ...row }) => row)
        })
      })
      const payload = (await response.json()) as DealAnalysisPayload & { error?: string }
      if (!response.ok) {
        throw new Error(payload.error ?? 'Analysis failed.')
      }

      updateSession(sessionId, (current) => ({
        ...current,
        analysis: payload,
        analyzing: false,
        updatedAt: new Date().toISOString()
      }))
    } catch (nextError) {
      updateSession(sessionId, (current) => ({
        ...current,
        analyzing: false,
        error: nextError instanceof Error ? nextError.message : 'Analysis failed.'
      }))
    }
  }

  function patchSessionDraftFilters(sessionId: string, patch: Partial<SearchFilters>) {
    updateSession(sessionId, (current) => ({
      ...current,
      draftFilters: {
        ...current.draftFilters,
        ...patch
      }
    }))
  }

  function resetSessionFilters(sessionId: string) {
    void rerunSessionSearch(sessionId, createDefaultSearchFilters())
  }

  function applySessionFilters(sessionId: string) {
    const session = sessions.find((entry) => entry.id === sessionId)
    if (!session) {
      return
    }

    void rerunSessionSearch(sessionId, { ...session.draftFilters })
  }

  function updateSessionStorePrice(sessionId: string, value: number) {
    updateSession(sessionId, (current) => ({
      ...current,
      storePrice: value,
      analysis: null
    }))
  }

  function updateSessionRawListingsActiveIndex(sessionId: string, value: number) {
    updateSession(sessionId, (current) => ({
      ...current,
      rawListingsActiveIndex: value
    }))
  }

  function updateSessionSelectedListingsActiveIndex(sessionId: string, value: number) {
    updateSession(sessionId, (current) => ({
      ...current,
      selectedListingsActiveIndex: value
    }))
  }

  function updateSessionSoldSearchQuery(sessionId: string, value: string) {
    updateSession(sessionId, (current) => ({
      ...current,
      soldSearchQuery: value,
      ...buildSessionEbayLinks(value),
      soldSearchQueryEdited: true,
      updatedAt: new Date().toISOString()
    }))
  }

  function updateSessionManualSoldComp(
    sessionId: string,
    compIndex: number,
    patch: Partial<ManualSoldComp>
  ) {
    updateSession(sessionId, (current) => ({
      ...current,
      manualSoldComps: current.manualSoldComps.map((comp, index) =>
        index === compIndex
          ? {
              ...comp,
              ...patch
            }
          : comp
      ),
      analysis: null,
      error: null,
      updatedAt: new Date().toISOString()
    }))
  }

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? null
  const orderedSessions =
    workflowMode !== 'board_view' && activeSession
      ? [activeSession, ...sessions.filter((session) => session.id !== activeSession.id)]
      : sessions

  return (
    <div className="stack stack--xl">
      <ScannerSearchPanel
        formRef={formRef}
        searchButtonRef={searchButtonRef}
        queryInputRef={queryInputRef}
        searchState={searchState}
        addingSearch={addingSearch}
        sessionCount={sessions.length}
        workflowMode={workflowMode}
        globalError={globalError}
        searchFeedback={searchFeedback}
        imageSearch={imageSearch}
        imageSearchFeatureState={initialImageSearchFeatureState}
        imageSearchUnavailableMessage={imageSearchUnavailableMessage}
        onSearchStateChange={updateSearchFormState}
        onWorkflowModeChange={setWorkflowModeState}
        onImageFilesSelected={(files) => void runImageSearch(files)}
        onImageSearchActiveIndexChange={updateImageSearchActiveIndex}
        onFocusImageSession={activateSession}
        getImageSessionSoldQuery={getImageSessionSoldQuery}
      />

      <section className="stack">
        <div className="panel__split">
          <div>
            <p className="eyebrow">Session workspace</p>
            <h2>
              {workflowMode === 'quick_check'
                ? 'Stay on one item while the rest of the session stays compact.'
                : workflowMode === 'full_analysis'
                  ? 'Open the deeper research tools only when the item earns the extra work.'
                  : 'Review each saved session card without reopening the whole worksheet.'}
            </h2>
          </div>
          <div className="status-chip">
            {sessions.length} searches / {workflowMode === 'quick_check' ? 'Quick Check' : workflowMode === 'full_analysis' ? 'Full Analysis' : 'Board View'}
          </div>
        </div>

        {sessions.length === 0 ? (
          <section className="empty-state">
            <h3>No searches yet</h3>
            <p>Run a keyword or GTIN search to start the Quick Check flow.</p>
          </section>
        ) : (
          <div className={workflowMode === 'board_view' ? 'session-stack session-stack--board' : 'session-stack'}>
            {orderedSessions.map((session) => (
              <ScannerSessionCard
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                workflowMode={workflowMode}
                panelState={panelState}
                onActivateSession={activateSession}
                onTogglePanel={togglePanel}
                onDraftFiltersChange={patchSessionDraftFilters}
                onResetFilters={resetSessionFilters}
                onApplyFilters={applySessionFilters}
                onToggleComparisonListing={toggleComparisonListing}
                onStorePriceChange={updateSessionStorePrice}
                onRawListingsActiveIndexChange={updateSessionRawListingsActiveIndex}
                onSelectedListingsActiveIndexChange={updateSessionSelectedListingsActiveIndex}
                onSoldSearchQueryChange={updateSessionSoldSearchQuery}
                onManualSoldCompChange={updateSessionManualSoldComp}
                onRunAnalysis={(sessionId) => void runAnalysis(sessionId)}
              />
            ))}
          </div>
        )}
      </section>

      <ScannerAssumptionsPanel
        sellerShippingCost={sellerShippingCost}
        feeRate={feeRate}
        packagingCost={packagingCost}
        promotedListingCost={promotedListingCost}
        safetyBuffer={safetyBuffer}
        targetProfit={targetProfit}
        onSellerShippingCostChange={setSellerShippingCost}
        onFeeRateChange={setFeeRate}
        onPackagingCostChange={setPackagingCost}
        onPromotedListingCostChange={setPromotedListingCost}
        onSafetyBufferChange={setSafetyBuffer}
        onTargetProfitChange={setTargetProfit}
      />
    </div>
  )
}
