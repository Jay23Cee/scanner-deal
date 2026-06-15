// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAndroidChromeIntentUrl,
  buildEbaySoldCompsUrl,
  buildSoldCompsHandoffPath
} from '@/lib/ebayLinks'
import SoldCompsHandoffPage from '../app/ebay/sold-comps/page'

const headersMock = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({
  headers: headersMock
}))

function createRequestHeaders(userAgent: string) {
  return new Headers({
    'user-agent': userAgent,
    host: 'scanner.test',
    'x-forwarded-proto': 'https'
  })
}

async function renderPage(searchParams: Record<string, string | string[] | undefined>) {
  render(await SoldCompsHandoffPage({ searchParams: Promise.resolve(searchParams) }))
}

describe('sold comps handoff page', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    headersMock.mockResolvedValue(
      createRequestHeaders(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36'
      )
    )
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the desktop handoff with a direct continue link', async () => {
    await renderPage({ query: 'TI 84 Plus CE' })

    expect(screen.getByText('Open sold comps in the browser')).toBeTruthy()
    expect(screen.getByText('TI 84 Plus CE')).toBeTruthy()

    const continueLink = screen.getByRole('link', { name: 'Continue to eBay' })
    expect(continueLink.getAttribute('href')).toBe(buildEbaySoldCompsUrl('TI 84 Plus CE'))
    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull()

    const urlField = screen.getByLabelText('Full eBay URL') as HTMLTextAreaElement
    expect(urlField.readOnly).toBe(true)
    expect(urlField.value).toBe(buildEbaySoldCompsUrl('TI 84 Plus CE'))
    expect(screen.getByRole('button', { name: 'Copy eBay URL' })).toBeTruthy()
  })

  it('renders the Android Chrome launcher with a manual fallback URL', async () => {
    headersMock.mockResolvedValue(
      createRequestHeaders(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36'
      )
    )

    await renderPage({ query: 'Canon AE-1 Program 35mm Camera Body' })

    const chromeLauncher = screen.getByRole('link', { name: 'Open in Chrome' })
    expect(chromeLauncher.getAttribute('href')).toBe(
      buildAndroidChromeIntentUrl(
        buildEbaySoldCompsUrl('Canon AE-1 Program 35mm Camera Body'),
        `https://scanner.test${buildSoldCompsHandoffPath(
          'Canon AE-1 Program 35mm Camera Body',
          'manual'
        )}`
      )
    )
    expect(screen.getByRole('link', { name: 'Try direct eBay link' }).getAttribute('href')).toBe(
      buildEbaySoldCompsUrl('Canon AE-1 Program 35mm Camera Body')
    )
    expect(screen.getByRole('button', { name: 'Copy eBay URL' })).toBeTruthy()
  })

  it('suppresses the launcher in manual mode and uses copy-first mobile guidance', async () => {
    headersMock.mockResolvedValue(
      createRequestHeaders(
        'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/137.0.0.0 Mobile Safari/537.36'
      )
    )

    await renderPage({
      query: 'Canon AE-1 Program 35mm Camera Body',
      mode: 'manual'
    })

    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Continue to eBay' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy eBay URL' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try direct eBay link' })).toBeTruthy()
  })

  it('uses the copy-first mobile flow for iPhone by default', async () => {
    headersMock.mockResolvedValue(
      createRequestHeaders(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
      )
    )

    await renderPage({ query: 'TI 84 Plus CE' })

    expect(screen.queryByRole('link', { name: 'Open in Chrome' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Continue to eBay' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Copy eBay URL' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Try direct eBay link' })).toBeTruthy()
  })

  it('renders a non-actionable error state when the query is missing', async () => {
    await renderPage({})

    expect(screen.getByText('Sold comps handoff unavailable')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to Scanner' }).getAttribute('href')).toBe('/scanner')
    expect(screen.queryByRole('link', { name: 'Continue to eBay' })).toBeNull()
  })

  it('shows a manual-copy fallback status when clipboard write fails', async () => {
    const user = userEvent.setup()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error('clipboard denied'))
      }
    })

    await renderPage({ query: 'Canon AE-1 Program 35mm Camera Body' })
    await user.click(screen.getByRole('button', { name: 'Copy eBay URL' }))

    expect((await screen.findByRole('status')).textContent).toContain(
      'Copy failed. Use the field below to copy the full eBay URL manually into your browser.'
    )
  })
})
