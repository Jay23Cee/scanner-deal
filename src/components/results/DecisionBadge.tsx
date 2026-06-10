import { Decision } from '@/lib/types'

export function DecisionBadge({ decision }: { decision: Decision }) {
  return <span className={`decision-badge decision-badge--${decision.toLowerCase()}`}>{decision}</span>
}

