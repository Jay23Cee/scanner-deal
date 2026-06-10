import { ManualSoldComp } from '@/lib/types'

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2
})

function formatMoney(value: number | null) {
  return value === null ? 'Not provided' : money.format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return 'Not provided'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium'
  }).format(new Date(`${value}T00:00:00.000Z`))
}

export function ManualSoldCompList({
  manualSoldComps
}: {
  manualSoldComps: ManualSoldComp[]
}) {
  if (manualSoldComps.length === 0) {
    return (
      <section className="empty-state">
        <h3>No manual sold comps saved</h3>
        <p>This scan did not save any sold-comp notes.</p>
      </section>
    )
  }

  return (
    <div className="sold-comps__rows">
      {manualSoldComps.map((comp, index) => (
        <article key={`${comp.title}-${comp.soldDate ?? 'undated'}-${index}`} className="sold-comp-row panel">
          <div>
            <p className="eyebrow">Comp {index + 1}</p>
            <h3>{comp.title || 'Untitled sold comp'}</h3>
          </div>

          <div className="sold-comp-row__details">
            <div>
              <span>Sold price</span>
              <strong>{formatMoney(comp.soldPrice)}</strong>
            </div>
            <div>
              <span>Shipping</span>
              <strong>{formatMoney(comp.shippingCost)}</strong>
            </div>
            <div>
              <span>Condition</span>
              <strong>{comp.condition || 'Not provided'}</strong>
            </div>
            <div>
              <span>Sold date</span>
              <strong>{formatDate(comp.soldDate)}</strong>
            </div>
          </div>

          <p className="panel__lede">{comp.notes || 'No notes saved for this sold comp.'}</p>
        </article>
      ))}
    </div>
  )
}
