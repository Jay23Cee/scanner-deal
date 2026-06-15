// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import {
  buildAndroidChromeIntentUrl,
  buildEbayActiveSearchUrl,
  buildEbaySoldCompsUrl,
  buildSoldCompsHandoffPath,
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
    expect(url).toContain('_ipg=120')
    expect(url).toContain('LH_Sold=1')
    expect(url).toContain('LH_Complete=1')
  })

  it('builds the same-origin sold comps handoff path from the shared helper', () => {
    expect(buildSoldCompsHandoffPath(' TI 84 Plus CE ')).toBe(
      '/ebay/sold-comps?query=TI+84+Plus+CE'
    )
  })

  it('adds manual mode to the sold comps handoff path when requested', () => {
    expect(buildSoldCompsHandoffPath('TI 84 Plus CE', 'manual')).toBe(
      '/ebay/sold-comps?query=TI+84+Plus+CE&mode=manual'
    )
  })

  it('omits the query parameter from the handoff path when the cleaned query is blank', () => {
    expect(buildSoldCompsHandoffPath('   ')).toBe('/ebay/sold-comps')
  })

  it('builds an Android Chrome intent URL with a browser fallback', () => {
    expect(
      buildAndroidChromeIntentUrl(
        'https://www.ebay.com/sch/i.html?_nkw=ti+84+plus+ce&_ipg=120&LH_Sold=1&LH_Complete=1',
        'https://scanner.test/ebay/sold-comps?query=ti+84+plus+ce&mode=manual'
      )
    ).toBe(
      'intent://www.ebay.com/sch/i.html?_nkw=ti+84+plus+ce&_ipg=120&LH_Sold=1&LH_Complete=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fscanner.test%2Febay%2Fsold-comps%3Fquery%3Dti%2B84%2Bplus%2Bce%26mode%3Dmanual;end'
    )
  })

  it('builds an active search URL without sold params', () => {
    const url = buildEbayActiveSearchUrl('TI 84 Plus CE')

    expect(url).toContain('_nkw=TI+84+Plus+CE')
    expect(url).not.toContain('_ipg')
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
