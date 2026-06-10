import { ScannerDefaults } from '@/lib/types'

const STORAGE_KEY = 'ebay-resale-scanner-settings'

export const defaultScannerSettings: ScannerDefaults = {
  sellerShippingCost: 8,
  feeRate: 0.15,
  packagingCost: 2,
  promotedListingCost: 0,
  safetyBuffer: 5,
  targetProfit: 20
}

export function loadScannerSettings(): ScannerDefaults {
  if (typeof window === 'undefined') {
    return defaultScannerSettings
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultScannerSettings
    }

    const parsed = JSON.parse(raw) as Partial<ScannerDefaults>
    return {
      sellerShippingCost: Number(parsed.sellerShippingCost ?? defaultScannerSettings.sellerShippingCost),
      feeRate: Number(parsed.feeRate ?? defaultScannerSettings.feeRate),
      packagingCost: Number(parsed.packagingCost ?? defaultScannerSettings.packagingCost),
      promotedListingCost: Number(parsed.promotedListingCost ?? defaultScannerSettings.promotedListingCost),
      safetyBuffer: Number(parsed.safetyBuffer ?? defaultScannerSettings.safetyBuffer),
      targetProfit: Number(parsed.targetProfit ?? defaultScannerSettings.targetProfit)
    }
  } catch {
    return defaultScannerSettings
  }
}

export function saveScannerSettings(nextSettings: ScannerDefaults) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings))
}

