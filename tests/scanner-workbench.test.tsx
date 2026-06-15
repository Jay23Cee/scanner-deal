// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ScannerWorkbench } from '@/components/scanner/ScannerWorkbench'
import { buildEbayActiveSearchUrl, buildSoldCompsHandoffPath } from '@/lib/ebayLinks'
import {
  DealAnalysisPayload,
  ImageSearchResponsePayload,
  ListingResult,
  SearchResponsePayload
} from '@/lib/types'

vi.mock('@/components/scanner/BarcodeScanner', () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner" />
}))

function buildSearchResponse(
  overrides: Partial<SearchResponsePayload> = {}
): SearchResponsePayload {
  return {
    mode: 'keyword',
    query: 'iphone 15 pro max',
    marketplaceId: 'EBAY_US',
    environment: 'production',
    totalReturned: 0,
    rawListings: [],
    suggestedComparisonItemIds: [],
    excludedCount: 0,
    fallbackApplied: false,
    ...overrides
  }
}

function buildAnalysisResponse(
  overrides: Partial<DealAnalysisPayload> = {}
): DealAnalysisPayload {
  return {
    scanId: 'scan-1',
    decision: 'BUY',
    estimatedLowPrice: 120,
    estimatedMedianPrice: 140,
    estimatedHighPrice: 165,
    suggestedListPrice: 149.99,
    estimatedProfit: 42.5,
    roi: 0.36,
    confidence: 'HIGH',
    reason: 'Strong spread between cost and expected resale price.',
    listingCount: 2,
    ...overrides
  }
}

function buildImageSearchResponse(
  overrides: Partial<ImageSearchResponsePayload> = {}
): ImageSearchResponsePayload {
  const detectedTitle =
    overrides.detectedTitle ?? 'Texas Instruments TI 84 Plus CE Graphing Calculator Black'

  return {
    detectedTitle,
    session:
      overrides.session === undefined
        ? buildSearchResponse({
            query: detectedTitle,
            totalReturned: 1,
            rawListings: [buildListing('image-1', detectedTitle)],
            suggestedComparisonItemIds: ['image-1']
          })
        : overrides.session,
    ...overrides
  }
}

function buildListing(
  itemId: string,
  title = `Apple iPhone ${itemId}`
): ListingResult {
  return {
    title,
    price: 799,
    currency: 'USD',
    shippingCost: 10,
    shippingKnown: true,
    totalPrice: 809,
    condition: 'Used',
    conditionId: '3000',
    itemUrl: `https://example.com/${itemId}`,
    itemId,
    sellerUsername: `seller-${itemId}`,
    sellerFeedbackPercentage: 99.8,
    itemLocation: {
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      country: 'US',
      postalCode: '90001'
    },
    matchScore: 0.92,
    primaryImageUrl: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    additionalImageUrls: [],
    itemCreationDate: '2026-06-01T00:00:00.000Z',
    itemOriginDate: '2026-06-02T00:00:00.000Z',
    itemEndDate: '2026-06-15T00:00:00.000Z',
    buyingOptions: ['FIXED_PRICE']
  }
}

function createDeferredResponse() {
  let resolve!: (value: Response) => void

  return {
    promise: new Promise<Response>((nextResolve) => {
      resolve = nextResolve
    }),
    resolve
  }
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const descriptor =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ??
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')

  descriptor?.set?.call(input, value)
}

function getSearchForm() {
  return screen.getByRole('search', { name: 'Scanner search' }) as HTMLFormElement
}

function getVisibleSearchButton() {
  return screen.getByRole('button', { name: 'Check Item' })
}

function getTakePhotoButton() {
  return screen.getByRole('button', { name: 'Take Photo' })
}

function getChoosePhotoButton() {
  return screen.getByRole('button', { name: 'Choose Photo' })
}

function getTakePhotoInput() {
  return screen.getByLabelText('Take Photo', { selector: 'input' }) as HTMLInputElement
}

function getChoosePhotoInput() {
  return screen.getByLabelText('Choose Photo', { selector: 'input' }) as HTMLInputElement
}

function getPictureSearchDeck() {
  return screen.getByRole('region', { name: 'Picture search results swipe deck' })
}

function getActiveSessionCard() {
  return document.querySelector('article.session-card--active') as HTMLElement | null
}

function getSessionCard(query: string) {
  return screen.getByRole('button', { name: new RegExp(query, 'i') }).closest('article.session-card') as HTMLElement
}

describe('ScannerWorkbench mobile submit behavior', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
    let previewCounter = 0
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => `blob:preview-image-${++previewCounter}`),
        revokeObjectURL: vi.fn()
      })
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders the scanner header inside a real form with workflow toggles and collapsed assumptions defaults', () => {
    render(<ScannerWorkbench />)

    const form = getSearchForm()
    const button = getVisibleSearchButton()
    const hiddenSubmit = form.querySelector('input[type="submit"][hidden]')
    const quickCheckButton = screen.getByRole('button', { name: 'Quick Check' })
    const fullAnalysisButton = screen.getByRole('button', { name: 'Full Analysis' })
    const boardButton = screen.getByRole('button', { name: 'Board View' })
    const assumptionsToggle = screen.getByRole('button', { name: /Compact assumptions summary/i })

    expect(form.tagName).toBe('FORM')
    expect(button.getAttribute('type')).toBe('button')
    expect(button.closest('form')).toBe(form)
    expect(hiddenSubmit).toBeTruthy()
    expect(quickCheckButton.getAttribute('aria-pressed')).toBe('true')
    expect(fullAnalysisButton.getAttribute('aria-pressed')).toBe('false')
    expect(boardButton.getAttribute('aria-pressed')).toBe('false')
    expect(assumptionsToggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('Seller shipping cost')).toBeNull()
    expect(screen.queryByTestId('scanner-submit-debug')).toBeNull()
  })

  it('submits through the native form event and prevents the browser default action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    const form = getSearchForm()

    fireEvent.change(input, { target: { value: 'iphone 15 pro max' } })

    const submitEvent = createEvent.submit(form)
    fireEvent(form, submitEvent)

    expect(submitEvent.defaultPrevented).toBe(true)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      query: 'iphone 15 pro max'
    })
    expect(screen.getByText('Search added to board.')).toBeTruthy()
  })

  it('starts a search from the visible button click without relying on native submit navigation', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    fireEvent.change(input, { target: { value: 'iphone 15 pro max' } })
    fireEvent.click(getVisibleSearchButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.getByText('Current check status')).toBeTruthy()
    expect(getActiveSessionCard()).toBeTruthy()
    expect(screen.queryByTestId('scanner-submit-debug')).toBeNull()
  })

  it('renders swipe deck controls for search results and selected comparisons', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          buildSearchResponse({
            totalReturned: 2,
            rawListings: [buildListing('1'), buildListing('2')],
            suggestedComparisonItemIds: ['1', '2']
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())

    const resultsDeck = await screen.findByRole('region', {
      name: 'eBay listing results swipe deck'
    })
    expect(within(resultsDeck).getByText('Apple iPhone 1')).toBeTruthy()
    expect(screen.getByText('1 / 2')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Next result' }))
    expect(screen.getByText('2 / 2')).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Add to comparison' })[0]!)
    await user.click(screen.getByRole('button', { name: /Selected for comparison/i }))

    const selectedDeck = await screen.findByRole('region', {
      name: 'Selected comparison listings swipe deck'
    })
    expect(within(selectedDeck).getByText('Apple iPhone 1')).toBeTruthy()
  })

  it('does not start a search from the input keydown handler alone', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    fireEvent.change(input, { target: { value: 'iphone 15 pro max' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('prefers the live input value over stale React state on button click submit', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')

    fireEvent.click(getVisibleSearchButton())

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      query: 'iphone 15 pro max'
    })
  })

  it('shows a blank-query error and does not fetch when the button is clicked empty', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const button = getVisibleSearchButton()
    expect(button).toHaveProperty('disabled', false)

    fireEvent.click(button)

    expect(fetchMock).toHaveBeenCalledTimes(0)
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Enter a keyword or GTIN before searching.')
    )
  })

  it('shows a visible form-level error when the search request fails', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'Search failed from eBay.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Search failed from eBay.')
  })

  it('disables repeated submits while the search request is still pending', async () => {
    const user = userEvent.setup()
    const deferred = createDeferredResponse()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')

    const button = getVisibleSearchButton()

    await user.click(button)
    await waitFor(() => expect(button).toHaveProperty('disabled', true))
    await user.click(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    deferred.resolve(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await screen.findByText('Search added to board.')
  })

  it('submits immediately from touch pointerdown using the live input value even if React state is stale', async () => {
    const deferred = createDeferredResponse()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    const button = getVisibleSearchButton()

    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    expect(document.activeElement).toBe(input)
    expect(button).toHaveProperty('disabled', false)

    fireEvent.pointerDown(button, { pointerType: 'touch' })

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      query: 'iphone 15 pro max'
    })
    expect(document.activeElement).not.toBe(input)
    expect(button).toHaveProperty('disabled', true)
    expect(screen.getByText('1 searches in session')).toBeTruthy()
    expect(screen.getByText('Current check status')).toBeTruthy()

    deferred.resolve(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await screen.findByText('Search added to board.')
  })

  it('suppresses follow-up click and form submit after mobile pointerdown already started the search', async () => {
    const deferred = createDeferredResponse()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    const button = getVisibleSearchButton()
    const form = getSearchForm()

    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    fireEvent.pointerDown(button, { pointerType: 'touch' })
    fireEvent.click(button)

    const submitEvent = createEvent.submit(form)
    fireEvent(form, submitEvent)

    expect(submitEvent.defaultPrevented).toBe(true)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    deferred.resolve(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await screen.findByText('Search added to board.')
  })

  it('uses the touchstart fallback when PointerEvent is unavailable', async () => {
    vi.stubGlobal('PointerEvent', undefined)

    const deferred = createDeferredResponse()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const input = screen.getByLabelText('Keyword')
    const button = getVisibleSearchButton()

    setNativeInputValue(input as HTMLInputElement, 'iphone 15 pro max')
    input.focus()

    fireEvent.touchStart(button)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    deferred.resolve(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await screen.findByText('Search added to board.')
  })

  it('makes the newest search active and resets the workflow mode to Quick Check', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            buildSearchResponse({
              totalReturned: 1,
              rawListings: [buildListing('1')]
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'first query')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Search added to board.')

    await user.click(screen.getByRole('button', { name: 'Board View' }))
    expect(screen.getByRole('button', { name: 'Board View' }).getAttribute('aria-pressed')).toBe('true')

    await user.clear(screen.getByLabelText('Keyword'))
    await user.type(screen.getByLabelText('Keyword'), 'second query')
    await user.click(getVisibleSearchButton())

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Quick Check' }).getAttribute('aria-pressed')).toBe('true')
    )
    expect(getActiveSessionCard()).toBeTruthy()
    expect(within(getActiveSessionCard()!).getAllByText('second query').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('article.session-card').length).toBe(2)
  })

  it('switches the active session while keeping only one expanded detail view in both modes', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify(
            buildSearchResponse({
              totalReturned: 2,
              rawListings: [buildListing('1'), buildListing('2')]
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'first query')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Search added to board.')

    await user.clear(screen.getByLabelText('Keyword'))
    await user.type(screen.getByLabelText('Keyword'), 'second query')
    await user.click(getVisibleSearchButton())
    await waitFor(() =>
      expect(within(getActiveSessionCard()!).getAllByText('second query').length).toBeGreaterThan(0)
    )

    expect(document.querySelectorAll('article.session-card--active')).toHaveLength(1)
    expect(within(getActiveSessionCard()!).getAllByText('second query').length).toBeGreaterThan(0)
    expect(within(getSessionCard('first query')).queryByText('Current check status')).toBeNull()

    await user.click(screen.getByRole('button', { name: /first query/i }))
    expect(document.querySelectorAll('article.session-card--active')).toHaveLength(1)
    expect(within(getActiveSessionCard()!).getAllByText('first query').length).toBeGreaterThan(0)
    expect(within(getSessionCard('second query')).queryByText('Current check status')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Board View' }))
    expect(document.querySelectorAll('article.session-card--active')).toHaveLength(1)
    expect(within(getActiveSessionCard()!).getAllByText('first query').length).toBeGreaterThan(0)
  })

  it('opens the deeper research panels when Full Analysis is selected', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          buildSearchResponse({
            totalReturned: 2,
            rawListings: [buildListing('1'), buildListing('2')]
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'full analysis item')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Current check status')

    await user.click(screen.getByRole('button', { name: 'Full Analysis' }))

    const activeCard = getActiveSessionCard()
    expect(activeCard).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Full Analysis' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(activeCard!).getByRole('button', { name: /Selected for comparison/i }).getAttribute('aria-expanded')).toBe('true')
    expect(within(activeCard!).getByRole('button', { name: /Analysis inputs/i }).getAttribute('aria-expanded')).toBe('true')
  })

  it('shows progress metrics before analysis and deal metrics after analysis in the result summary card', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/ebay/search')) {
        return new Response(
          JSON.stringify(
            buildSearchResponse({
              totalReturned: 2,
              rawListings: [buildListing('1'), buildListing('2')],
              suggestedComparisonItemIds: ['1', '2'],
              excludedCount: 1
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      if (url.endsWith('/api/deal/analyze')) {
        return new Response(JSON.stringify(buildAnalysisResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())

    const activeCard = await waitFor(() => {
      const card = getActiveSessionCard()
      expect(card).toBeTruthy()
      return card!
    })
    const soldCompsButton = within(activeCard).getByRole('link', { name: 'Open Sold Comps' })
    const activeListingsButton = within(activeCard).getByRole('button', { name: 'Open Active Listings' })
    const searchWordsInput = within(activeCard).getByLabelText('Search words')
    const handoffTitle = within(activeCard).getByText('Refine the eBay handoff')
    const resultSummary = within(activeCard).getByText('Result summary')

    expect(soldCompsButton).toBeTruthy()
    expect(soldCompsButton.getAttribute('href')).toBe(buildSoldCompsHandoffPath('iphone 15 pro max'))
    expect(activeListingsButton).toBeTruthy()
    expect((searchWordsInput as HTMLInputElement).value).toBe('iphone 15 pro max')
    expect(Boolean(handoffTitle.compareDocumentPosition(resultSummary) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(within(activeCard).getByText('Current check status')).toBeTruthy()
    expect(within(activeCard).getByText('Query')).toBeTruthy()
    expect(within(activeCard).getByText('Search mode')).toBeTruthy()
    expect(within(activeCard).getByText('Target condition')).toBeTruthy()
    expect(within(activeCard).getByText('Active listings')).toBeTruthy()
    expect(within(activeCard).getByText('Selected listings')).toBeTruthy()
    expect(within(activeCard).getByText('Store price status')).toBeTruthy()
    expect(within(activeCard).getByText('Recommendation status')).toBeTruthy()

    await user.click(screen.getAllByRole('button', { name: 'Add to comparison' })[0]!)
    await user.click(screen.getByRole('button', { name: /Analysis inputs/i }))
    await user.clear(screen.getByLabelText('Store price'))
    await user.type(screen.getByLabelText('Store price'), '95')
    await user.click(screen.getByRole('button', { name: 'Analyze deal' }))

    await screen.findByText('Latest deal snapshot')
    expect(within(getActiveSessionCard()!).getAllByText('Estimated profit').length).toBeGreaterThan(0)
    expect(within(getActiveSessionCard()!).getAllByText('ROI').length).toBeGreaterThan(0)
    expect(within(getActiveSessionCard()!).getAllByText('Confidence').length).toBeGreaterThan(0)
    expect(within(getActiveSessionCard()!).getAllByText('Suggested list').length).toBeGreaterThan(0)
    expect(within(getActiveSessionCard()!).getAllByText('BUY').length).toBeGreaterThan(0)
  })

  it('submits sold-search query and manual sold comps with the analysis request', async () => {
    const user = userEvent.setup()
    let analysisRequestBody: Record<string, unknown> | null = null
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/ebay/search')) {
        return new Response(
          JSON.stringify(
            buildSearchResponse({
              totalReturned: 1,
              rawListings: [buildListing('1')],
              suggestedComparisonItemIds: ['1']
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      if (url.endsWith('/api/deal/analyze')) {
        analysisRequestBody = JSON.parse(String(init?.body))

        return new Response(JSON.stringify(buildAnalysisResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Current check status')

    const activeCard = getActiveSessionCard()!

    await user.clear(within(activeCard).getByLabelText('Search words'))
    await user.type(within(activeCard).getByLabelText('Search words'), 'iphone 15 pro max 256gb unlocked')
    await user.click(within(activeCard).getByRole('button', { name: 'Add to comparison' }))
    await user.click(within(activeCard).getByRole('button', { name: /Analysis inputs/i }))
    await user.clear(screen.getByLabelText('Store price'))
    await user.type(screen.getByLabelText('Store price'), '95')
    await user.type(screen.getByLabelText('Comp 1 title'), 'Sold comp from eBay')
    await user.type(screen.getByLabelText('Comp 1 sold price'), '760')
    await user.type(screen.getByLabelText('Comp 1 shipping'), '15')
    await user.type(screen.getByLabelText('Comp 1 condition'), 'Used')
    await user.type(screen.getByLabelText('Comp 1 sold date'), '2026-06-03')
    await user.type(screen.getByLabelText('Comp 1 notes'), 'Clean comp with box')
    await user.click(screen.getByRole('button', { name: 'Analyze deal' }))

    await screen.findByText('Latest deal snapshot')
    expect(analysisRequestBody).toMatchObject({
      soldSearchQuery: 'iphone 15 pro max 256gb unlocked',
      storePrice: 95,
      comparisonListings: [expect.objectContaining({ itemId: '1' })]
    })

    const manualSoldComps = (
      analysisRequestBody as { manualSoldComps?: Array<Record<string, unknown>> } | null
    )?.manualSoldComps

    expect(manualSoldComps?.[0]).toEqual({
      title: 'Sold comp from eBay',
      soldPrice: 760,
      shippingCost: 15,
      condition: 'Used',
      soldDate: '2026-06-03',
      notes: 'Clean comp with box'
    })
    expect(manualSoldComps?.length).toBe(3)
  })

  it('uploads a picture into a focused image session without calling the keyword search route', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        const body = init?.body as FormData
        expect(body.get('condition')).toBe('used')

        return new Response(JSON.stringify(buildImageSearchResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getTakePhotoInput(), new File(['image-bytes'], 'calculator.png', { type: 'image/png' }))

    await screen.findByText('Picture search added to board.')

    const pictureDeck = getPictureSearchDeck()
    const activeCard = getActiveSessionCard()
    expect(within(pictureDeck).getByText('calculator.png')).toBeTruthy()
    expect(within(pictureDeck).getByRole('link', { name: 'Open Sold Comps' })).toBeTruthy()
    expect(within(pictureDeck).getByRole('button', { name: 'Focus session' })).toBeTruthy()
    expect(activeCard).toBeTruthy()
    expect(within(activeCard!).getAllByText('Texas Instruments TI 84 Plus CE Graphing Calculator Black').length).toBeGreaterThan(0)
    expect(within(activeCard!).getByText('Picture search')).toBeTruthy()
    expect(screen.getAllByText('Search added').length).toBeGreaterThan(0)

    expect(
      fetchMock.mock.calls.some((call) => {
        const url =
          typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url
        return url.endsWith('/api/ebay/search')
      })
    ).toBe(false)
  })

  it('enables multi-select only on the choose photo picker and uses the shared batch review deck', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(JSON.stringify(buildImageSearchResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    const takePhotoInput = getTakePhotoInput()
    const choosePhotoInput = getChoosePhotoInput()

    expect(getTakePhotoButton()).toBeTruthy()
    expect(getChoosePhotoButton()).toBeTruthy()
    expect(takePhotoInput.getAttribute('accept')).toBe('image/*')
    expect(takePhotoInput.getAttribute('capture')).toBe('environment')
    expect(takePhotoInput.multiple).toBe(false)
    expect(choosePhotoInput.getAttribute('accept')).toBe('image/*')
    expect(choosePhotoInput.getAttribute('capture')).toBeNull()
    expect(choosePhotoInput.multiple).toBe(true)

    await user.upload(choosePhotoInput, new File(['image-bytes'], 'calculator-library.png', { type: 'image/png' }))

    await screen.findByText('Picture search added to board.')
    expect(within(getPictureSearchDeck()).getByText('calculator-library.png')).toBeTruthy()
    expect(screen.getAllByText('Search added').length).toBeGreaterThan(0)
  })

  it('does not show sold comps actions while photo batch items are still uploading or queued', async () => {
    const user = userEvent.setup()
    const deferred = createDeferredResponse()
    const fetchMock = vi.fn().mockReturnValue(deferred.promise)
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getChoosePhotoInput(), [
      new File(['image-1'], 'queued-1.png', { type: 'image/png' }),
      new File(['image-2'], 'queued-2.png', { type: 'image/png' })
    ])

    await waitFor(() => expect(screen.getByText(/Processing 0 of 2/i)).toBeTruthy())
    expect(within(getPictureSearchDeck()).queryByRole('link', { name: 'Open Sold Comps' })).toBeNull()

    deferred.resolve(
      new Response(
        JSON.stringify(
          buildImageSearchResponse({
            detectedTitle: '',
            session: null,
            fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
          })
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    )
  })

  it('processes multiple chosen photos sequentially and keeps mixed outcomes visible in the swipe deck', async () => {
    const user = userEvent.setup()
    const requestedFileNames: string[] = []
    const imageResponses = [
      buildImageSearchResponse({
        detectedTitle: 'Canon AE-1 Program 35mm Camera Body',
        session: buildSearchResponse({
          query: 'Canon AE-1 Program 35mm Camera Body',
          totalReturned: 1,
          rawListings: [buildListing('camera-1', 'Canon AE-1 Program 35mm Camera Body')],
          suggestedComparisonItemIds: ['camera-1']
        })
      }),
      buildImageSearchResponse({
        detectedTitle: '',
        session: null,
        fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
      }),
      buildImageSearchResponse({
        detectedTitle: 'Sony PSP 3000 Black Console',
        session: buildSearchResponse({
          query: 'Sony PSP 3000 Black Console',
          totalReturned: 1,
          rawListings: [buildListing('psp-1', 'Sony PSP 3000 Black Console')],
          suggestedComparisonItemIds: ['psp-1']
        })
      })
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        const body = init?.body as FormData
        const image = body.get('image')
        requestedFileNames.push(image instanceof File ? image.name : 'unknown')

        return new Response(JSON.stringify(imageResponses.shift()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getChoosePhotoInput(), [
      new File(['image-1'], 'camera.png', { type: 'image/png' }),
      new File(['image-2'], 'mystery-item.png', { type: 'image/png' }),
      new File(['image-3'], 'psp.png', { type: 'image/png' })
    ])

    await screen.findByText('2 picture searches added to board.')

    expect(requestedFileNames).toEqual(['camera.png', 'mystery-item.png', 'psp.png'])
    expect(screen.getByText('2 matched / 1 no match')).toBeTruthy()
    expect(within(getPictureSearchDeck()).getByText('camera.png')).toBeTruthy()
    expect(screen.getAllByText('Canon AE-1 Program 35mm Camera Body').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sony PSP 3000 Black Console').length).toBeGreaterThan(0)
    expect(screen.getByText(/Could not confidently identify this item/i)).toBeTruthy()
    expect(screen.getByText('1 / 3')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Next photo result' }))
    expect(screen.getByText('2 / 3')).toBeTruthy()

    const sessionTitles = Array.from(
      document.querySelectorAll('article.session-card > button.session-card__toggle h3')
    ).map((node) => node.textContent?.trim())
    expect(sessionTitles.slice(0, 2)).toEqual([
      'Canon AE-1 Program 35mm Camera Body',
      'Sony PSP 3000 Black Console'
    ])
    expect(within(getActiveSessionCard()!).getAllByText('Canon AE-1 Program 35mm Camera Body').length).toBeGreaterThan(0)
  })

  it('opens sold comps from a matched photo slide using the linked session query', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(
          JSON.stringify(
            buildImageSearchResponse({
              detectedTitle: 'Canon AE-1 Program 35mm Camera Body',
              session: buildSearchResponse({
                query: 'Canon AE-1 Program 35mm Camera Body',
                totalReturned: 1,
                rawListings: [buildListing('camera-1', 'Canon AE-1 Program 35mm Camera Body')],
                suggestedComparisonItemIds: ['camera-1']
              })
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getTakePhotoInput(), new File(['image-bytes'], 'camera.png', { type: 'image/png' }))
    await screen.findByText('Picture search added to board.')

    const soldCompsLink = within(getPictureSearchDeck()).getByRole('link', { name: 'Open Sold Comps' })
    expect(soldCompsLink.getAttribute('href')).toBe(
      buildSoldCompsHandoffPath('Canon AE-1 Program 35mm Camera Body')
    )
    expect(soldCompsLink.getAttribute('target')).toBe('_blank')
    expect(soldCompsLink.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('uses the updated linked session sold-search query from the photo slide sold comps button', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(JSON.stringify(buildImageSearchResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getTakePhotoInput(), new File(['image-bytes'], 'calculator.png', { type: 'image/png' }))
    await screen.findByText('Picture search added to board.')

    const activeCard = getActiveSessionCard()!
    await user.clear(within(activeCard).getByLabelText('Detected search words'))
    await user.type(
      within(activeCard).getByLabelText('Detected search words'),
      'ti 84 plus ce python edition'
    )

    const soldCompsLink = within(getPictureSearchDeck()).getByRole('link', { name: 'Open Sold Comps' })
    expect(soldCompsLink.getAttribute('href')).toBe(
      buildSoldCompsHandoffPath('ti 84 plus ce python edition')
    )
  })

  it('preserves the current active session during a batch and lets the swipe deck focus a matched session on demand', async () => {
    const user = userEvent.setup()
    const imageResponses = [
      buildImageSearchResponse({
        detectedTitle: 'Nintendo DS Lite Crimson Black',
        session: buildSearchResponse({
          query: 'Nintendo DS Lite Crimson Black',
          totalReturned: 1,
          rawListings: [buildListing('ds-1', 'Nintendo DS Lite Crimson Black')],
          suggestedComparisonItemIds: ['ds-1']
        })
      }),
      buildImageSearchResponse({
        detectedTitle: 'Bose QuietComfort 35 II Headphones',
        session: buildSearchResponse({
          query: 'Bose QuietComfort 35 II Headphones',
          totalReturned: 1,
          rawListings: [buildListing('bose-1', 'Bose QuietComfort 35 II Headphones')],
          suggestedComparisonItemIds: ['bose-1']
        })
      })
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/ebay/search')) {
        return new Response(
          JSON.stringify(
            buildSearchResponse({
              query: 'existing query',
              totalReturned: 1,
              rawListings: [buildListing('existing-1', 'Existing Query Listing')]
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      if (url.endsWith('/api/scanner/image-search')) {
        const body = init?.body as FormData
        expect(body.get('condition')).toBe('used')

        return new Response(JSON.stringify(imageResponses.shift()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'existing query')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Search added to board.')

    await user.upload(getChoosePhotoInput(), [
      new File(['image-1'], 'ds.png', { type: 'image/png' }),
      new File(['image-2'], 'bose.png', { type: 'image/png' })
    ])

    await screen.findByText('2 picture searches added to board.')

    expect(within(getActiveSessionCard()!).getAllByText('existing query').length).toBeGreaterThan(0)
    expect(document.querySelectorAll('article.session-card').length).toBe(3)

    const focusButtons = within(getPictureSearchDeck()).getAllByRole('button', { name: 'Focus session' })
    await user.click(focusButtons[1]!)

    await waitFor(() =>
      expect(within(getActiveSessionCard()!).getAllByText('Bose QuietComfort 35 II Headphones').length).toBeGreaterThan(0)
    )
  })

  it('does not show sold comps actions for no-match or error photo slides', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        const callIndex = fetchMock.mock.calls.length

        if (callIndex === 1) {
          return new Response(
            JSON.stringify(
              buildImageSearchResponse({
                detectedTitle: '',
                session: null,
                fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
              })
            ),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            error: 'Image search failed from eBay.',
            fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getChoosePhotoInput(), [
      new File(['image-1'], 'mystery-item.png', { type: 'image/png' }),
      new File(['image-2'], 'broken-item.png', { type: 'image/png' })
    ])

    await screen.findByText('Image search failed from eBay.')
    expect(within(getPictureSearchDeck()).queryByRole('link', { name: 'Open Sold Comps' })).toBeNull()
    expect(within(getPictureSearchDeck()).queryByRole('button', { name: 'Focus session' })).toBeNull()
  })

  it('replaces the current picture batch deck when a new gallery selection is made without deleting prior sessions', async () => {
    const user = userEvent.setup()
    const imageResponses = [
      buildImageSearchResponse({
        detectedTitle: 'Texas Instruments TI 30X IIS Calculator',
        session: buildSearchResponse({
          query: 'Texas Instruments TI 30X IIS Calculator',
          totalReturned: 1,
          rawListings: [buildListing('calc-1', 'Texas Instruments TI 30X IIS Calculator')],
          suggestedComparisonItemIds: ['calc-1']
        })
      }),
      buildImageSearchResponse({
        detectedTitle: '',
        session: null,
        fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
      })
    ]
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(JSON.stringify(imageResponses.shift()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getChoosePhotoInput(), new File(['image-1'], 'first-batch.png', { type: 'image/png' }))
    await screen.findByText('Picture search added to board.')
    expect(within(getPictureSearchDeck()).getByText('first-batch.png')).toBeTruthy()

    await user.upload(getChoosePhotoInput(), new File(['image-2'], 'replacement-batch.png', { type: 'image/png' }))

    expect(await screen.findByText('replacement-batch.png')).toBeTruthy()
    expect(screen.queryByText('first-batch.png')).toBeNull()
    expect(document.querySelectorAll('article.session-card').length).toBe(1)
  })

  it('shows picture search as unavailable and prevents uploads when the feature is not configured', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ScannerWorkbench
        initialImageSearchFeatureState={{
          status: 'missing_configuration',
          missingConfiguration: ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_MARKETPLACE_ID']
        }}
      />
    )

    const takePhotoInput = getTakePhotoInput()
    const choosePhotoInput = getChoosePhotoInput()

    expect(screen.getByText('Unavailable')).toBeTruthy()
    expect(
      screen.getByText(
        'Picture search is unavailable until EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_MARKETPLACE_ID is configured. Use keyword search above in the meantime.'
      )
    ).toBeTruthy()
    expect(getTakePhotoButton()).toHaveProperty('disabled', true)
    expect(getChoosePhotoButton()).toHaveProperty('disabled', true)
    expect(takePhotoInput).toHaveProperty('disabled', true)
    expect(choosePhotoInput).toHaveProperty('disabled', true)

    await user.upload(takePhotoInput, new File(['image-bytes'], 'calculator.png', { type: 'image/png' }))

    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('shows picture search as unavailable in sandbox and prevents uploads', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ScannerWorkbench
        initialImageSearchFeatureState={{
          status: 'unsupported_environment',
          missingConfiguration: []
        }}
      />
    )

    const takePhotoInput = getTakePhotoInput()
    const choosePhotoInput = getChoosePhotoInput()

    expect(screen.getByText('Unavailable')).toBeTruthy()
    expect(
      screen.getByText(
        'Picture search requires EBAY_ENV=production because eBay image search is not available in sandbox. Use keyword search above in the meantime.'
      )
    ).toBeTruthy()
    expect(getTakePhotoButton()).toHaveProperty('disabled', true)
    expect(getChoosePhotoButton()).toHaveProperty('disabled', true)
    expect(takePhotoInput).toHaveProperty('disabled', true)
    expect(choosePhotoInput).toHaveProperty('disabled', true)

    await user.upload(choosePhotoInput, new File(['image-bytes'], 'calculator.png', { type: 'image/png' }))

    expect(fetchMock).toHaveBeenCalledTimes(0)
  })

  it('shows the detected image title in the batch review panel after a successful match', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(JSON.stringify(buildImageSearchResponse()), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getTakePhotoInput(), new File(['image-bytes'], 'calculator.png', { type: 'image/png' }))

    expect(await screen.findByText('Detected item')).toBeTruthy()
    expect(screen.getAllByText('Texas Instruments TI 84 Plus CE Graphing Calculator Black').length).toBeGreaterThan(1)
  })

  it('shows the fallback message and does not create a session when image detection has no confident matches', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.endsWith('/api/scanner/image-search')) {
        return new Response(
          JSON.stringify(
            buildImageSearchResponse({
              detectedTitle: '',
              session: null,
              fallbackMessage: 'Could not confidently identify this item. Try retaking the picture or use keyword search above.'
            })
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      throw new Error(`Unexpected fetch url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.upload(getChoosePhotoInput(), new File(['image-bytes'], 'mystery-item.png', { type: 'image/png' }))

    expect(await screen.findByText(/Could not confidently identify this item/i)).toBeTruthy()
    expect(screen.queryByText('Picture search added to board.')).toBeNull()
    expect(document.querySelectorAll('article.session-card').length).toBe(0)
  })

  it('keeps the shared sold comps buttons for normal text searches', async () => {
    const user = userEvent.setup()
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(
      () => ({ closed: false } as Window)
    )
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Current check status')

    const activeCard = getActiveSessionCard()!
    const soldCompsLink = within(activeCard).getByRole('link', { name: 'Open Sold Comps' })
    await user.click(within(activeCard).getByRole('button', { name: 'Open Active Listings' }))

    expect(soldCompsLink.getAttribute('href')).toBe(buildSoldCompsHandoffPath('iphone 15 pro max'))
    expect(soldCompsLink.getAttribute('target')).toBe('_blank')
    expect(soldCompsLink.getAttribute('rel')).toBe('noopener noreferrer')
    expect(windowOpenSpy).toHaveBeenCalledWith(
      buildEbayActiveSearchUrl('iphone 15 pro max'),
      '_blank',
      'noopener,noreferrer'
    )
    expect(within(activeCard).queryByText('Allow pop-ups to open eBay in a new tab.')).toBeNull()
  })

  it('shows a warning and stays on the scanner page when the active listings popup is blocked', async () => {
    const user = userEvent.setup()
    const startingHref = window.location.href
    vi.spyOn(window, 'open').mockImplementation(() => null)
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(buildSearchResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<ScannerWorkbench />)

    await user.type(screen.getByLabelText('Keyword'), 'iphone 15 pro max')
    await user.click(getVisibleSearchButton())
    await screen.findByText('Current check status')

    const activeCard = getActiveSessionCard()!
    await user.click(within(activeCard).getByRole('button', { name: 'Open Active Listings' }))

    expect(within(activeCard).getByRole('status').textContent).toContain(
      'Allow pop-ups to open eBay in a new tab.'
    )
    expect(window.location.href).toBe(startingHref)
  })
})
