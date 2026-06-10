'use client'

import type { ReactNode } from 'react'
import {
  ActiveListingsButton,
  SoldCompsButton
} from '@/components/scanner/EbaySearchButtons'
import { DecisionBadge } from '@/components/results/DecisionBadge'
import { ListingCard } from '@/components/results/ListingCard'
import { ListingSwipeDeck } from '@/components/results/ListingSwipeDeck'
import { ProfitPanel } from '@/components/results/ProfitPanel'
import {
  currency,
  formatConditionLabel,
  SearchSession,
  SessionPanelState,
  updatedAtFormatter,
  WorkflowMode
} from '@/components/scanner/scannerShared'
import {
  buildAppliedFilterSummary,
  BUYING_FORMAT_OPTIONS,
  LISTING_AGE_OPTIONS,
  LISTING_SORT_OPTIONS,
  MIN_MATCH_OPTIONS,
  parseOptionalNumber,
  RESULT_LIMIT_VALUES,
  RESULTS_CONDITION_OPTIONS
} from '@/lib/search-filters'
import { sortListings } from '@/lib/listings'
import { ListingResult, ListingSortMode, SearchFilters } from '@/lib/types'

type ScannerSessionCardProps = {
  session: SearchSession
  isActive: boolean
  workflowMode: WorkflowMode
  panelState: SessionPanelState
  onActivateSession: (sessionId: string) => void
  onTogglePanel: (panelKey: keyof SessionPanelState) => void
  onDraftFiltersChange: (sessionId: string, patch: Partial<SearchFilters>) => void
  onResetFilters: (sessionId: string) => void
  onApplyFilters: (sessionId: string) => void
  onToggleComparisonListing: (sessionId: string, listing: ListingResult) => void
  onStorePriceChange: (sessionId: string, value: number) => void
  onRawListingsActiveIndexChange: (sessionId: string, value: number) => void
  onSelectedListingsActiveIndexChange: (sessionId: string, value: number) => void
  onSoldSearchQueryChange: (sessionId: string, value: string) => void
  onRunAnalysis: (sessionId: string) => void
}

type SessionSectionProps = {
  eyebrow: string
  title: string
  status: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

function formatSearchStatus(status: SearchSession['searchStatus']) {
  if (status === 'searching') {
    return 'Searching'
  }

  if (status === 'ready') {
    return 'Ready'
  }

  if (status === 'error') {
    return 'Needs attention'
  }

  return 'Pending'
}

function formatEnvironmentLabel(environment: SearchSession['environment']) {
  if (environment === 'production') {
    return 'Production'
  }

  if (environment === 'sandbox') {
    return 'Sandbox'
  }

  return 'Pending'
}

function formatSessionSourceLabel(session: SearchSession) {
  if (session.source === 'image') {
    return 'Picture'
  }

  return session.mode === 'gtin' ? 'GTIN' : 'Keyword'
}

function formatStorePriceStatus(storePrice: number) {
  if (storePrice > 0) {
    return `${currency.format(storePrice)} entered`
  }

  return 'Needs store price'
}

function formatRecommendationStatus(session: SearchSession) {
  if (session.analysis) {
    return session.analysis.decision
  }

  if (session.searchStatus === 'searching') {
    return 'Waiting for results'
  }

  if (session.searchStatus === 'error') {
    return 'Needs attention'
  }

  if (session.storePrice > 0 && session.selectedComparisonListings.length > 0) {
    return 'Ready to analyze'
  }

  return 'Pending analysis'
}

function SessionSection({
  eyebrow,
  title,
  status,
  open,
  onToggle,
  children
}: SessionSectionProps) {
  return (
    <section className="panel panel--subtle scanner-section">
      <button type="button" className="scanner-section__toggle" aria-expanded={open} onClick={onToggle}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        <div className="scanner-section__meta">
          <span className="status-chip">{status}</span>
          <span>{open ? 'Hide' : 'Open'}</span>
        </div>
      </button>

      {open ? <div className="scanner-section__body">{children}</div> : null}
    </section>
  )
}

export function ScannerSessionCard({
  session,
  isActive,
  workflowMode,
  panelState,
  onActivateSession,
  onTogglePanel,
  onDraftFiltersChange,
  onResetFilters,
  onApplyFilters,
  onToggleComparisonListing,
  onStorePriceChange,
  onRawListingsActiveIndexChange,
  onSelectedListingsActiveIndexChange,
  onSoldSearchQueryChange,
  onRunAnalysis
}: ScannerSessionCardProps) {
  const sortedRawListings = sortListings(session.rawListings, session.appliedFilters.sort)
  const sortedSelectedListings = sortListings(
    session.selectedComparisonListings,
    session.appliedFilters.sort
  )
  const appliedFilterSummary = buildAppliedFilterSummary(session.appliedFilters)
  const sessionStatus = formatSearchStatus(session.searchStatus)
  const environmentLabel = formatEnvironmentLabel(session.environment)
  const soldItemsQuery = session.soldSearchQuery.trim() || session.query.trim()

  return (
    <article className={isActive ? 'session-card panel session-card--active' : 'session-card panel'}>
      <button
        type="button"
        className="session-card__toggle"
        aria-pressed={isActive}
        onClick={() => onActivateSession(session.id)}
      >
        <div>
          <p className="eyebrow">
            {formatSessionSourceLabel(session)} / {formatConditionLabel(session.condition)}
          </p>
          <h3>{session.query}</h3>
          <p className="panel__lede">
            {isActive
              ? session.source === 'image'
                ? workflowMode === 'quick_check'
                  ? 'Active picture-match session.'
                  : workflowMode === 'full_analysis'
                    ? 'Focused picture-match session in Full Analysis.'
                    : 'Focused picture-match card in Board View.'
                : workflowMode === 'quick_check'
                  ? 'Active Quick Check session.'
                  : workflowMode === 'full_analysis'
                    ? 'Focused item in Full Analysis.'
                    : 'Focused card in Board View.'
              : session.source === 'image'
                ? 'Summary only until you focus this picture match.'
                : 'Summary only until you focus this search.'}
          </p>
        </div>

        <div className="session-card__meta">
          <span className="status-chip">{isActive ? 'Active' : 'Summary'}</span>
          <span>{environmentLabel}</span>
          <span>{session.rawListings.length} results</span>
          <span>{session.selectedComparisonListings.length} selected</span>
          <span>{updatedAtFormatter.format(new Date(session.updatedAt))}</span>
        </div>
      </button>

      {isActive ? (
        <div className="stack">
          <section className="panel panel--subtle scanner-handoff">
            <div className="panel__split">
              <div>
                <p className="eyebrow">
                  {session.source === 'image' ? 'Detected search words' : 'Search words'}
                </p>
                <h3>Refine the eBay handoff</h3>
                <p className="panel__lede">
                  Edit the search words before opening sold comps or active listings in eBay.
                </p>
              </div>
              <div className="status-chip">{session.source === 'image' ? 'From picture' : 'From search'}</div>
            </div>

            <div className="form-grid">
              <label className="form-grid__wide">
                {session.source === 'image' ? 'Detected search words' : 'Search words'}
                <input
                  type="text"
                  value={session.soldSearchQuery}
                  onChange={(event) => onSoldSearchQueryChange(session.id, event.target.value)}
                  placeholder={session.query}
                />
              </label>

              <div className="actions form-grid__wide">
                <SoldCompsButton query={soldItemsQuery} />
                <ActiveListingsButton query={soldItemsQuery} />
              </div>
            </div>
          </section>
          <section className={session.analysis ? 'panel panel--accent result-summary' : 'panel panel--hero result-summary'}>
            <div className="analysis-header">
              <div>
                <p className="eyebrow">Result summary</p>
                <h3>{session.analysis ? 'Latest deal snapshot' : 'Current check status'}</h3>
                <p className="panel__lede">
                  {environmentLabel} Browse results stay in focus here, with the deeper research tools available only when needed.
                </p>
              </div>
              <div className="result-summary__actions">
                {session.analysis ? <DecisionBadge decision={session.analysis.decision} /> : null}
                <span className="status-chip">{sessionStatus}</span>
              </div>
            </div>

            <div className="analysis-grid result-summary__grid">
              <div>
                <span>Query</span>
                <strong>{session.query}</strong>
              </div>
              <div>
                <span>Search mode</span>
                <strong>
                  {session.source === 'image'
                    ? 'Picture search'
                    : session.mode === 'gtin'
                      ? 'GTIN / barcode'
                      : 'Keyword'}
                </strong>
              </div>
              <div>
                <span>Target condition</span>
                <strong>{formatConditionLabel(session.condition)}</strong>
              </div>
              <div>
                <span>Active listings</span>
                <strong>{session.rawListings.length}</strong>
              </div>
              <div>
                <span>Selected listings</span>
                <strong>{session.selectedComparisonListings.length}</strong>
              </div>
              <div>
                <span>Store price status</span>
                <strong>{formatStorePriceStatus(session.storePrice)}</strong>
              </div>
              <div>
                <span>Recommendation status</span>
                <strong>{formatRecommendationStatus(session)}</strong>
              </div>
              {session.analysis ? (
                <>
                  <div>
                    <span>Estimated profit</span>
                    <strong>{currency.format(session.analysis.estimatedProfit)}</strong>
                  </div>
                  <div>
                    <span>ROI</span>
                    <strong>{(session.analysis.roi * 100).toFixed(1)}%</strong>
                  </div>
                  <div>
                    <span>Confidence</span>
                    <strong>{session.analysis.confidence}</strong>
                  </div>
                  <div>
                    <span>Suggested list</span>
                    <strong>{currency.format(session.analysis.suggestedListPrice)}</strong>
                  </div>
                  <div>
                    <span>Usable listings</span>
                    <strong>{session.analysis.listingCount}</strong>
                  </div>
                  <div>
                    <span>Environment</span>
                    <strong>{environmentLabel}</strong>
                  </div>
                  <div>
                    <span>Excluded</span>
                    <strong>{session.excludedCount}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Environment</span>
                    <strong>{environmentLabel}</strong>
                  </div>
                  <div>
                    <span>Excluded</span>
                    <strong>{session.excludedCount}</strong>
                  </div>
                </>
              )}
            </div>

            {session.fallbackApplied && session.fallbackReason ? (
              <p className="analysis-reason">{session.fallbackReason}</p>
            ) : session.analysis ? (
              <p className="analysis-reason">{session.analysis.reason}</p>
            ) : (
              <p className="analysis-reason">
                Choose comparison listings, then open Analysis Inputs when you are ready to score the item.
              </p>
            )}

            {session.environment === 'sandbox' ? (
              <p className="analysis-reason">
                Sandbox data is limited, so sparse Browse results are expected even when the request succeeds.
              </p>
            ) : null}
            {session.error ? <p className="error-banner">{session.error}</p> : null}
          </section>

          <SessionSection
            eyebrow="Returned by eBay"
            title="eBay listing results"
            status={`${session.totalReturned} shown`}
            open={panelState.results}
            onToggle={() => onTogglePanel('results')}
          >
            <div className="results-toolbar">
              <span className="status-chip">
                {session.searchStatus === 'searching' ? 'Searching eBay...' : `${session.rawListings.length} loaded`}
              </span>
              <button
                type="button"
                className="button button--ghost results-filters__toggle"
                aria-expanded={panelState.filters}
                onClick={() => onTogglePanel('filters')}
              >
                {panelState.filters
                  ? 'Hide filters'
                  : `Filters${appliedFilterSummary.length > 0 ? ` (${appliedFilterSummary.length})` : ''}`}
              </button>
            </div>

            <div className="results-filters__summary" aria-live="polite">
              {appliedFilterSummary.length === 0 ? (
                <span className="results-filter-chip results-filter-chip--muted">No extra filters</span>
              ) : (
                appliedFilterSummary.map((chip) => (
                  <span key={`${session.id}-${chip}`} className="results-filter-chip">
                    {chip}
                  </span>
                ))
              )}
            </div>

            {panelState.filters ? (
              <div className="results-filters">
                <div className="form-grid">
                  <label>
                    Sort
                    <select
                      value={session.draftFilters.sort}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          sort: event.target.value as ListingSortMode
                        })
                      }
                    >
                      {LISTING_SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Condition
                    <select
                      value={session.draftFilters.resultsCondition}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          resultsCondition: event.target.value as SearchFilters['resultsCondition']
                        })
                      }
                    >
                      {RESULTS_CONDITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Buying format
                    <select
                      value={session.draftFilters.buyingOptions}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          buyingOptions: event.target.value as SearchFilters['buyingOptions']
                        })
                      }
                    >
                      {BUYING_FORMAT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Min price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={session.draftFilters.minPrice ?? ''}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          minPrice: parseOptionalNumber(event.target.value)
                        })
                      }
                    />
                  </label>

                  <label>
                    Max price
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={session.draftFilters.maxPrice ?? ''}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          maxPrice: parseOptionalNumber(event.target.value)
                        })
                      }
                    />
                  </label>

                  <label>
                    Listing age
                    <select
                      value={session.draftFilters.listingAgeDays === null ? '' : String(session.draftFilters.listingAgeDays)}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          listingAgeDays: event.target.value === '' ? null : Number(event.target.value)
                        })
                      }
                    >
                      {LISTING_AGE_OPTIONS.map((option) => (
                        <option key={option.value === null ? 'any' : option.value} value={option.value ?? ''}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Minimum match score
                    <select
                      value={session.draftFilters.minMatchScore === null ? '' : String(session.draftFilters.minMatchScore)}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          minMatchScore: event.target.value === '' ? null : Number(event.target.value)
                        })
                      }
                    >
                      {MIN_MATCH_OPTIONS.map((option) => (
                        <option key={option.value === null ? 'any' : option.value} value={option.value ?? ''}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Results limit
                    <select
                      value={String(session.draftFilters.limit)}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          limit: Number(event.target.value)
                        })
                      }
                    >
                      {RESULT_LIMIT_VALUES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-grid__wide">
                    Exclude words
                    <input
                      type="text"
                      value={session.draftFilters.excludeWords}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          excludeWords: event.target.value
                        })
                      }
                      placeholder="case, cover, locked"
                    />
                  </label>
                </div>

                <div className="results-filters__footer">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={session.draftFilters.freeShipping}
                      onChange={(event) =>
                        onDraftFiltersChange(session.id, {
                          freeShipping: event.target.checked
                        })
                      }
                    />
                    <span>Free shipping only</span>
                  </label>

                  <div className="actions">
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => onResetFilters(session.id)}
                      disabled={session.searchStatus === 'searching'}
                    >
                      Reset filters
                    </button>
                    <button
                      type="button"
                      className="button"
                      onClick={() => onApplyFilters(session.id)}
                      disabled={session.searchStatus === 'searching'}
                    >
                      {session.searchStatus === 'searching' ? 'Applying...' : 'Apply filters'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {sortedRawListings.length === 0 && session.searchStatus !== 'searching' ? (
              <section className="empty-state">
                <h3>No eBay listings to show</h3>
                <p>Adjust the results filters or try a broader query.</p>
              </section>
            ) : (
              <ListingSwipeDeck
                deckId={`${session.id}-results`}
                sectionLabel="eBay listing results"
                itemLabel="result"
                items={sortedRawListings}
                activeIndex={session.rawListingsActiveIndex}
                onActiveIndexChange={(value) => onRawListingsActiveIndexChange(session.id, value)}
                renderItem={(listing) => {
                  const isSelected = session.selectedComparisonListings.some(
                    (entry) => entry.itemId === listing.itemId
                  )

                  return (
                    <ListingCard
                      listing={listing}
                      isSuggested={session.suggestedComparisonItemIds.includes(listing.itemId)}
                      isSelected={isSelected}
                      onToggleSelection={() => onToggleComparisonListing(session.id, listing)}
                    />
                  )
                }}
              />
            )}
          </SessionSection>

          <SessionSection
            eyebrow="Manual comparison set"
            title="Selected for comparison"
            status={`${session.selectedComparisonListings.length} selected`}
            open={panelState.selectedComps}
            onToggle={() => onTogglePanel('selectedComps')}
          >
            {sortedSelectedListings.length === 0 ? (
              <section className="empty-state">
                <h3>No comparison listings selected</h3>
                <p>Add listings from the eBay results above before running analysis.</p>
              </section>
            ) : (
              <ListingSwipeDeck
                deckId={`${session.id}-selected`}
                sectionLabel="Selected comparison listings"
                itemLabel="comparison listing"
                items={sortedSelectedListings}
                activeIndex={session.selectedListingsActiveIndex}
                onActiveIndexChange={(value) =>
                  onSelectedListingsActiveIndexChange(session.id, value)
                }
                renderItem={(listing) => (
                  <ListingCard
                    listing={listing}
                    isSuggested={session.suggestedComparisonItemIds.includes(listing.itemId)}
                    isSelected
                    onToggleSelection={() => onToggleComparisonListing(session.id, listing)}
                  />
                )}
              />
            )}
          </SessionSection>
          <SessionSection
            eyebrow="Analyze this search"
            title="Analysis inputs"
            status={session.analysis ? 'Scored' : 'Ready when comps are selected'}
            open={panelState.analysis}
            onToggle={() => onTogglePanel('analysis')}
          >
            <div className="stack">
              <div className="form-grid">
                <label>
                  Store price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={session.storePrice}
                    onChange={(event) => onStorePriceChange(session.id, Number(event.target.value))}
                  />
                </label>

                <div className="actions">
                  <button
                    type="button"
                    className="button button--accent"
                    onClick={() => onRunAnalysis(session.id)}
                    disabled={session.analyzing || session.selectedComparisonListings.length === 0}
                  >
                    {session.analyzing ? 'Analyzing...' : 'Analyze deal'}
                  </button>
                </div>
              </div>

              <div className="quick-metrics">
                <span>Store price: {currency.format(session.storePrice || 0)}</span>
                <span>Selected comps: {session.selectedComparisonListings.length}</span>
                <span>Excluded: {session.excludedCount}</span>
              </div>

              {session.analysis ? <ProfitPanel analysis={session.analysis} /> : null}
            </div>
          </SessionSection>
        </div>
      ) : null}
    </article>
  )
}
