import { Confidence, Decision, ItemCondition, SearchMode } from '@/lib/types'
import { DealMetrics } from '@/lib/deal/calculator'

export interface DealDecision {
  confidence: Confidence
  decision: Decision
  reason: string
}

function getConfidence(metrics: DealMetrics, mode: SearchMode, condition: ItemCondition): Confidence {
  let score = 0

  if (metrics.listingCount >= 8) {
    score += 2
  } else if (metrics.listingCount >= 5) {
    score += 1
  }

  if (metrics.averageMatchScore >= 0.85) {
    score += 2
  } else if (metrics.averageMatchScore >= 0.7) {
    score += 1
  }

  if (metrics.priceSpreadRatio <= 0.2) {
    score += 2
  } else if (metrics.priceSpreadRatio <= 0.35) {
    score += 1
  }

  if (mode === 'gtin') {
    score += 1
  }

  let confidence: Confidence = 'LOW'
  if (score >= 5) {
    confidence = 'HIGH'
  } else if (score >= 3) {
    confidence = 'MEDIUM'
  }

  if (condition === 'open_box' && metrics.conditionCloseCount < 3 && confidence === 'HIGH') {
    confidence = 'MEDIUM'
  }

  return confidence
}

function buildReason(metrics: DealMetrics, confidence: Confidence) {
  const spreadTone =
    metrics.priceSpreadRatio <= 0.2
      ? 'Price spread is tight.'
      : metrics.priceSpreadRatio <= 0.35
        ? 'Price spread is workable.'
        : 'Price spread is wide.'

  return `${metrics.listingCount} similar active listings found. ${spreadTone} Confidence is ${confidence.toLowerCase()}.`
}

export function evaluateDeal(
  metrics: DealMetrics,
  input: { mode: SearchMode; condition: ItemCondition; targetProfit: number }
): DealDecision {
  const confidence = getConfidence(metrics, input.mode, input.condition)

  let decision: Decision = 'PASS'
  if (
    metrics.estimatedProfit >= input.targetProfit &&
    metrics.roi >= 0.4 &&
    metrics.listingCount >= 5 &&
    confidence !== 'LOW'
  ) {
    decision = 'BUY'
  } else if (
    metrics.estimatedProfit >= 10 &&
    metrics.roi >= 0.25 &&
    metrics.listingCount >= 3
  ) {
    decision = 'MAYBE'
  }

  return {
    confidence,
    decision,
    reason: buildReason(metrics, confidence)
  }
}

