'use client'

import { RefObject } from 'react'
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner'
import { ScannerImageSearchPanel } from '@/components/scanner/ScannerImageSearchPanel'
import {
  PictureSearchState,
  SearchState,
  WorkflowMode
} from '@/components/scanner/scannerShared'
import { ImageSearchFeatureState, ItemCondition, SearchMode } from '@/lib/types'

type ScannerSearchPanelProps = {
  formRef: RefObject<HTMLFormElement | null>
  searchButtonRef: RefObject<HTMLButtonElement | null>
  queryInputRef: RefObject<HTMLInputElement | null>
  searchState: SearchState
  addingSearch: boolean
  sessionCount: number
  workflowMode: WorkflowMode
  globalError: string | null
  searchFeedback: string | null
  imageSearch: PictureSearchState
  imageSearchFeatureState: ImageSearchFeatureState
  imageSearchUnavailableMessage: string | null
  onImageFileSelected: (file: File | null) => void
  onSearchStateChange: (nextState: Partial<SearchState>) => void
  onWorkflowModeChange: (nextMode: WorkflowMode) => void
}

function updateSearchMode(
  onSearchStateChange: ScannerSearchPanelProps['onSearchStateChange'],
  value: string
) {
  onSearchStateChange({
    mode: value as SearchMode
  })
}

function updateSearchQuery(
  onSearchStateChange: ScannerSearchPanelProps['onSearchStateChange'],
  value: string
) {
  onSearchStateChange({
    query: value
  })
}

function updateSearchCondition(
  onSearchStateChange: ScannerSearchPanelProps['onSearchStateChange'],
  value: string
) {
  onSearchStateChange({
    condition: value as ItemCondition
  })
}

export function ScannerSearchPanel({
  formRef,
  searchButtonRef,
  queryInputRef,
  searchState,
  addingSearch,
  sessionCount,
  workflowMode,
  globalError,
  searchFeedback,
  imageSearch,
  imageSearchFeatureState,
  imageSearchUnavailableMessage,
  onImageFileSelected,
  onSearchStateChange,
  onWorkflowModeChange
}: ScannerSearchPanelProps) {
  return (
    <section className="panel panel--hero">
      <div className="panel__split">
        <div>
          <p className="eyebrow">Search workspace</p>
          <h2>Check one item fast, then escalate only when the item needs it.</h2>
          <p className="panel__lede">
            Scanner mode uses active Browse listings here, then opens eBay sold/completed results in a separate tab for manual comp review.
          </p>
        </div>
        <div className="scanner-search__controls">
          <div className="workflow-toggle" role="group" aria-label="Workflow mode">
            <button
              type="button"
              className={workflowMode === 'quick_check' ? 'workflow-toggle__button is-active' : 'workflow-toggle__button'}
              aria-pressed={workflowMode === 'quick_check'}
              onClick={() => onWorkflowModeChange('quick_check')}
            >
              Quick Check
            </button>
            <button
              type="button"
              className={workflowMode === 'full_analysis' ? 'workflow-toggle__button is-active' : 'workflow-toggle__button'}
              aria-pressed={workflowMode === 'full_analysis'}
              onClick={() => onWorkflowModeChange('full_analysis')}
            >
              Full Analysis
            </button>
            <button
              type="button"
              className={workflowMode === 'board_view' ? 'workflow-toggle__button is-active' : 'workflow-toggle__button'}
              aria-pressed={workflowMode === 'board_view'}
              onClick={() => onWorkflowModeChange('board_view')}
            >
              Board View
            </button>
          </div>
          <div className="status-chip">{sessionCount} searches in session</div>
        </div>
      </div>

      <form ref={formRef} className="form-grid" role="search" aria-label="Scanner search">
        <label>
          Search mode
          <select value={searchState.mode} onChange={(event) => updateSearchMode(onSearchStateChange, event.target.value)}>
            <option value="keyword">Keyword</option>
            <option value="gtin">GTIN / barcode</option>
          </select>
        </label>

        <label className="form-grid__wide">
          {searchState.mode === 'gtin' ? 'GTIN / barcode' : 'Keyword'}
          <input
            ref={queryInputRef}
            type="text"
            value={searchState.query}
            onChange={(event) => updateSearchQuery(onSearchStateChange, event.target.value)}
            onInput={(event) => updateSearchQuery(onSearchStateChange, event.currentTarget.value)}
            inputMode={searchState.mode === 'gtin' ? 'numeric' : 'search'}
            enterKeyHint={searchState.mode === 'gtin' ? 'go' : 'search'}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={searchState.mode === 'gtin' ? '012345678905' : 'iphone 15 pro max'}
          />
        </label>

        <label>
          Target condition
          <select
            value={searchState.condition}
            onChange={(event) => updateSearchCondition(onSearchStateChange, event.target.value)}
          >
            <option value="new">New</option>
            <option value="open_box">Open box</option>
            <option value="used">Used</option>
          </select>
        </label>

        <div className="actions form-grid__submit">
          <button ref={searchButtonRef} type="button" className="button" disabled={addingSearch}>
            {addingSearch ? 'Searching...' : 'Check Item'}
          </button>
        </div>

        <input type="submit" hidden tabIndex={-1} value="Submit search" />
      </form>

      <ScannerImageSearchPanel
        imageSearch={imageSearch}
        imageSearchFeatureState={imageSearchFeatureState}
        imageSearchUnavailableMessage={imageSearchUnavailableMessage}
        onImageFileSelected={onImageFileSelected}
      />

      <BarcodeScanner
        onDetected={(code) => {
          onSearchStateChange({
            mode: 'gtin',
            query: code
          })
        }}
      />

      {globalError ? (
        <p className="error-banner" role="alert">
          {globalError}
        </p>
      ) : null}
      {!globalError && searchFeedback ? (
        <p className="status-banner" role="status" aria-live="polite">
          {searchFeedback}
        </p>
      ) : null}
    </section>
  )
}
