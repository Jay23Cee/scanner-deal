import { expect, Page, test } from '@playwright/test'

function buildListing(itemId: string) {
  return {
    title: `Apple iPhone ${itemId}`,
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

function buildSearchPayload(overrides: Record<string, unknown> = {}) {
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

function buildImageSearchPayload(overrides: Record<string, unknown> = {}) {
  const detectedTitle =
    (overrides.detectedTitle as string | undefined) ??
    'Texas Instruments TI 84 Plus CE Graphing Calculator Black'

  return {
    detectedTitle,
    session:
      overrides.session === undefined
        ? buildSearchPayload({
            query: detectedTitle,
            totalReturned: 1,
            rawListings: [buildListing('image-1')],
            suggestedComparisonItemIds: ['image-1']
          })
        : overrides.session,
    ...overrides
  }
}

async function installLoadCounter(page: Page) {
  await page.addInitScript(() => {
    const key = '__scannerLoadCount'
    const nextCount = Number(window.sessionStorage.getItem(key) ?? '0') + 1
    window.sessionStorage.setItem(key, String(nextCount))
  })
}

async function expectNoReload(page: Page) {
  await expect.poll(() =>
    page.evaluate(() => Number(window.sessionStorage.getItem('__scannerLoadCount') ?? '0'))
  ).toBe(1)
}

function buildExpectedManualFallbackUrl(baseUrl: string, query: string) {
  return `${baseUrl}/ebay/sold-comps?query=${query}&mode=manual`
}

test.describe('scanner mobile submit flow', () => {
  test('sends exactly one request when the search button is tapped while the input is focused', async ({ page }) => {
    let requestCount = 0

    await installLoadCounter(page)

    await page.route('**/api/ebay/search', async (route) => {
      requestCount += 1

      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toMatchObject({
        mode: 'keyword',
        query: 'iphone 15 pro max',
        condition: 'used'
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSearchPayload())
      })
    })

    await page.goto('/scanner')

    const input = page.getByRole('textbox', { name: 'Keyword' })
    const button = page.getByRole('button', { name: 'Check Item' })

    await expect(button).toBeEnabled()

    await input.tap()
    await input.pressSequentially('iphone 15 pro max')

    await expect(input).toHaveValue('iphone 15 pro max')
    await expect(button).toBeEnabled()

    await button.tap()

    await expect(page).toHaveURL(/\/scanner$/)
    await expect(page).not.toHaveURL(/\?query=/)
    await expect(page.getByText('1 searches in session')).toBeVisible()
    await expect(page.locator('article.session-card')).toHaveCount(1)
    await expect(page.locator('article.session-card--active')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Quick Check', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('Current check status')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Search added to board.')
    await expect.poll(() => requestCount).toBe(1)
    await expectNoReload(page)
  })

  test('pressing Enter in the query input uses the native form submit path', async ({ page }) => {
    let requestCount = 0

    await installLoadCounter(page)

    await page.route('**/api/ebay/search', async (route) => {
      requestCount += 1

      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toMatchObject({
        mode: 'keyword',
        query: 'iphone 15 pro max',
        condition: 'used'
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSearchPayload())
      })
    })

    await page.goto('/scanner')

    const input = page.getByRole('textbox', { name: 'Keyword' })

    await input.tap()
    await input.pressSequentially('iphone 15 pro max')
    await expect(input).toHaveValue('iphone 15 pro max')

    await input.press('Enter')

    await expect(page).toHaveURL(/\/scanner$/)
    await expect(page).not.toHaveURL(/\?query=/)
    await expect(page.getByText('1 searches in session')).toBeVisible()
    await expect(page.locator('article.session-card')).toHaveCount(1)
    await expect(page.locator('article.session-card--active')).toHaveCount(1)
    await expect(page.getByText('Current check status')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Search added to board.')
    await expect.poll(() => requestCount).toBe(1)
    await expectNoReload(page)
  })

  test('submits through the visible button click path when the input is not focused', async ({ page }) => {
    let requestCount = 0

    await installLoadCounter(page)

    await page.route('**/api/ebay/search', async (route) => {
      requestCount += 1

      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toMatchObject({
        mode: 'keyword',
        query: 'iphone 15 pro max',
        condition: 'used'
      })

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildSearchPayload())
      })
    })

    await page.goto('/scanner')

    const input = page.getByRole('textbox', { name: 'Keyword' })
    const button = page.getByRole('button', { name: 'Check Item' })

    await input.tap()
    await input.pressSequentially('iphone 15 pro max')
    await expect(input).toHaveValue('iphone 15 pro max')

    await input.evaluate((element) => {
      ;(element as HTMLInputElement).blur()
    })
    await expect(input).not.toBeFocused()

    await button.tap()

    await expect(page).toHaveURL(/\/scanner$/)
    await expect(page).not.toHaveURL(/\?query=/)
    await expect(page.getByText('1 searches in session')).toBeVisible()
    await expect(page.locator('article.session-card')).toHaveCount(1)
    await expect(page.locator('article.session-card--active')).toHaveCount(1)
    await expect(page.getByText('Current check status')).toBeVisible()
    await expect(page.getByRole('status')).toContainText('Search added to board.')
    await expect.poll(() => requestCount).toBe(1)
    await expectNoReload(page)
  })

  test('keeps listing deck navigation stable and reversible after search results load', async ({ page }) => {
    await installLoadCounter(page)

    await page.route('**/api/ebay/search', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildSearchPayload({
            totalReturned: 3,
            rawListings: [buildListing('1'), buildListing('2'), buildListing('3')],
            suggestedComparisonItemIds: ['1', '2', '3']
          })
        )
      })
    })

    await page.goto('/scanner')

    await page.getByRole('textbox', { name: 'Keyword' }).fill('iphone 15 pro max')
    await page.getByRole('button', { name: 'Check Item' }).tap()

    const deck = page.getByRole('region', { name: 'eBay listing results swipe deck' })

    await expect(deck.locator('[data-slide-index="0"][aria-current="true"]')).toHaveCount(1)
    await expect(page.getByText('1 / 3')).toBeVisible()

    await page.getByRole('button', { name: 'Next result' }).tap()
    await expect(deck.locator('[data-slide-index="1"][aria-current="true"]')).toHaveCount(1)
    await expect(page.getByText('2 / 3')).toBeVisible()

    await page.waitForTimeout(700)
    await expect(deck.locator('[data-slide-index="1"][aria-current="true"]')).toHaveCount(1)
    await expect(page.getByText('2 / 3')).toBeVisible()

    await page.getByRole('button', { name: 'Previous result' }).tap()
    await expect(deck.locator('[data-slide-index="0"][aria-current="true"]')).toHaveCount(1)
    await expect(page.getByText('1 / 3')).toBeVisible()
    await expectNoReload(page)
  })

  test('processes multiple gallery photos into a swipe deck and matching session count', async ({ page }) => {
    let imageRequestCount = 0
    const imagePayloads = [
      buildImageSearchPayload({
        detectedTitle: 'Canon AE-1 Program 35mm Camera Body',
        session: buildSearchPayload({
          query: 'Canon AE-1 Program 35mm Camera Body',
          totalReturned: 1,
          rawListings: [buildListing('camera-1')],
          suggestedComparisonItemIds: ['camera-1']
        })
      }),
      buildImageSearchPayload({
        detectedTitle: 'Sony PSP 3000 Black Console',
        session: buildSearchPayload({
          query: 'Sony PSP 3000 Black Console',
          totalReturned: 1,
          rawListings: [buildListing('psp-1')],
          suggestedComparisonItemIds: ['psp-1']
        })
      })
    ]

    await installLoadCounter(page)

    await page.route('**/api/scanner/image-search', async (route) => {
      const payload = imagePayloads[imageRequestCount]
      imageRequestCount += 1

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(payload)
      })
    })

    await page.goto('/scanner')

    await page.locator('#scanner-image-choose-photo-input').setInputFiles([
      {
        name: 'camera.png',
        mimeType: 'image/png',
        buffer: Buffer.from('camera-image')
      },
      {
        name: 'psp.png',
        mimeType: 'image/png',
        buffer: Buffer.from('psp-image')
      }
    ])

    const deck = page.getByRole('region', { name: 'Picture search results swipe deck' })

    await expect(page.getByText('2 picture searches added to board.')).toBeVisible()
    await expect(page.getByText('2 searches in session')).toBeVisible()
    await expect(page.getByText('1 / 2')).toBeVisible()
    await expect(deck.locator('[data-slide-index="0"][aria-current="true"]')).toHaveCount(1)
    const soldCompsLink = deck
      .locator('[data-slide-index="0"]')
      .getByRole('link', { name: 'Open Sold Comps' })
    await expect(soldCompsLink).toBeVisible()
    await expect(soldCompsLink).toHaveAttribute(
      'href',
      '/ebay/sold-comps?query=Canon+AE-1+Program+35mm+Camera+Body'
    )
    await expect(soldCompsLink).toHaveAttribute('target', '_blank')
    await expect(soldCompsLink).toHaveAttribute('rel', 'noopener noreferrer')

    await page.getByRole('button', { name: 'Next photo result' }).tap()
    await expect(deck.locator('[data-slide-index="1"][aria-current="true"]')).toHaveCount(1)
    await expect(page.getByText('2 / 2')).toBeVisible()
    await expect.poll(() => imageRequestCount).toBe(2)
    await expectNoReload(page)
  })

  test('renders the platform-specific sold comps handoff page before the final eBay link', async ({ page }, testInfo) => {
    await page.goto('/ebay/sold-comps?query=Canon%20AE-1%20Program%2035mm%20Camera%20Body')

    await expect(page.getByText('Open sold comps in the browser')).toBeVisible()
    await expect(page.getByText('Canon AE-1 Program 35mm Camera Body')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Copy eBay URL' })).toBeVisible()

    if (testInfo.project.name === 'android-chromium') {
      const chromeLauncher = page.getByRole('link', { name: 'Open in Chrome' })
      await expect(chromeLauncher).toBeVisible()
      await expect(chromeLauncher).toHaveAttribute(
        'href',
        `intent://www.ebay.com/sch/i.html?_nkw=Canon+AE-1+Program+35mm+Camera+Body&_ipg=120&LH_Sold=1&LH_Complete=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
          buildExpectedManualFallbackUrl('http://127.0.0.1:3001', 'Canon+AE-1+Program+35mm+Camera+Body')
        )};end`
      )
      await expect(page.getByRole('link', { name: 'Try direct eBay link' })).toHaveAttribute(
        'href',
        'https://www.ebay.com/sch/i.html?_nkw=Canon+AE-1+Program+35mm+Camera+Body&_ipg=120&LH_Sold=1&LH_Complete=1'
      )
    } else {
      await expect(page.getByRole('link', { name: 'Open in Chrome' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Continue to eBay' })).toHaveCount(0)
      await expect(page.getByRole('link', { name: 'Try direct eBay link' })).toHaveAttribute(
        'href',
        'https://www.ebay.com/sch/i.html?_nkw=Canon+AE-1+Program+35mm+Camera+Body&_ipg=120&LH_Sold=1&LH_Complete=1'
      )
    }
  })
})
