// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  buildEbayActiveSearchUrl,
  buildEbaySoldCompsUrl,
  cleanEbayQuery,
  openEbayUrl
} from '@/lib/ebayLinks'

describe('eBay link helpers', () => {
  it('cleans extra whitespace and strips unsupported characters', () => {
    expect(cleanEbayQuery('  TI 84 Plus CE !!! ###  ')).toBe('TI 84 Plus CE ###')
  })

  it('builds a sold comps URL from the shared helper', () => {
    const url = buildEbaySoldCompsUrl('TI 84 Plus CE')

    expect(url).toContain('_nkw=TI+84+Plus+CE')
    expect(url).toContain('LH_Sold=1')
    expect(url).toContain('LH_Complete=1')
  })

  it('builds an active search URL without sold params', () => {
    const url = buildEbayActiveSearchUrl('TI 84 Plus CE')

    expect(url).toContain('_nkw=TI+84+Plus+CE')
    expect(url).not.toContain('LH_Sold')
    expect(url).not.toContain('LH_Complete')
  })

  it('returns true when a new eBay tab opens successfully', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(
      () => ({ closed: false } as Window)
    )

    expect(openEbayUrl('https://www.ebay.com')).toBe(true)
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://www.ebay.com',
      '_blank',
      'noopener,noreferrer'
    )
  })

  it('does not redirect the current page when the popup is blocked', () => {
    const startingHref = window.location.href
    vi.spyOn(window, 'open').mockImplementation(() => null)

    expect(openEbayUrl('https://www.ebay.com')).toBe(false)
    expect(window.location.href).toBe(startingHref)
  })
})
