// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ActiveListingsButton,
  SoldCompsButton
} from '@/components/scanner/EbaySearchButtons'
import {
  buildEbayActiveSearchUrl,
  buildSoldCompsHandoffPath
} from '@/lib/ebayLinks'

describe('EbaySearchButtons', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the sold comps search as a new-tab link', () => {
    render(<SoldCompsButton query="TI 84 Plus CE" />)

    const soldCompsLink = screen.getByRole('link', { name: 'Open Sold Comps' })
    expect(soldCompsLink.getAttribute('href')).toBe(buildSoldCompsHandoffPath('TI 84 Plus CE'))
    expect(soldCompsLink.getAttribute('target')).toBe('_blank')
    expect(soldCompsLink.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.queryByText('Allow pop-ups to open eBay in a new tab.')).toBeNull()
  })

  it('renders a disabled sold comps control when the query is blank', () => {
    render(<SoldCompsButton query="   " />)

    const soldCompsButton = screen.getByRole('button', { name: 'Open Sold Comps' })
    expect(soldCompsButton).toHaveProperty('disabled', true)
    expect(screen.queryByRole('link', { name: 'Open Sold Comps' })).toBeNull()
  })

  it('shows a warning instead of redirecting when the popup is blocked', async () => {
    const user = userEvent.setup()
    const startingHref = window.location.href
    vi.spyOn(window, 'open').mockImplementation(() => null)

    render(<ActiveListingsButton query="TI 84 Plus CE" />)

    await user.click(screen.getByRole('button', { name: 'Open Active Listings' }))

    expect(screen.getByRole('status').textContent).toContain(
      'Allow pop-ups to open eBay in a new tab.'
    )
    expect(window.location.href).toBe(startingHref)
  })

  it('still uses the shared active listings URL builder', async () => {
    const user = userEvent.setup()
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(
      () => ({ closed: false } as Window)
    )

    render(<ActiveListingsButton query="TI 84 Plus CE" />)

    await user.click(screen.getByRole('button', { name: 'Open Active Listings' }))

    expect(windowOpenSpy).toHaveBeenCalledWith(
      buildEbayActiveSearchUrl('TI 84 Plus CE'),
      '_blank',
      'noopener,noreferrer'
    )
  })
})
