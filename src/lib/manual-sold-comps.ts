import { ManualSoldComp } from '@/lib/types'

export const DEFAULT_MANUAL_SOLD_COMP_COUNT = 3

export function createEmptyManualSoldComp(): ManualSoldComp {
  return {
    title: '',
    soldPrice: null,
    shippingCost: null,
    condition: '',
    soldDate: null,
    notes: ''
  }
}

export function createDefaultManualSoldComps(count = DEFAULT_MANUAL_SOLD_COMP_COUNT) {
  return Array.from({ length: count }, () => createEmptyManualSoldComp())
}

export function normalizeManualSoldComp(comp: ManualSoldComp): ManualSoldComp {
  return {
    title: comp.title.trim(),
    soldPrice: comp.soldPrice,
    shippingCost: comp.shippingCost,
    condition: comp.condition.trim(),
    soldDate: comp.soldDate?.trim() ? comp.soldDate.trim() : null,
    notes: comp.notes.trim()
  }
}

export function hasManualSoldCompContent(comp: ManualSoldComp) {
  const normalized = normalizeManualSoldComp(comp)

  return Boolean(
    normalized.title ||
      normalized.soldPrice !== null ||
      normalized.shippingCost !== null ||
      normalized.condition ||
      normalized.soldDate ||
      normalized.notes
  )
}
