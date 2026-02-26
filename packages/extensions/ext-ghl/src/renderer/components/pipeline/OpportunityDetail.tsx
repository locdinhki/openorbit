import { useState } from 'react'
import { useExtGhlStore } from '../../store/index'
import Badge from '@renderer/components/shared/Badge'
import Button from '@renderer/components/shared/Button'
import { ipc } from '../../lib/ipc-client'

const statuses = ['open', 'won', 'lost', 'abandoned'] as const
const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  open: 'default',
  won: 'success',
  lost: 'error',
  abandoned: 'warning'
}

export default function OpportunityDetail(): React.JSX.Element {
  const opp = useExtGhlStore((s) => s.selectedOpportunity)
  const selectOpportunity = useExtGhlStore((s) => s.selectOpportunity)
  const loadOpportunities = useExtGhlStore((s) => s.loadOpportunities)
  const [updating, setUpdating] = useState(false)

  if (!opp) return <div />

  const customFields: { id: string; value: unknown }[] = (() => {
    try {
      return JSON.parse(opp.custom_fields)
    } catch {
      return []
    }
  })()

  const handleStatusChange = async (status: string): Promise<void> => {
    setUpdating(true)
    await ipc.opportunities.updateStatus(opp.id, status)
    await loadOpportunities()
    setUpdating(false)
  }

  return (
    <div className="p-6 max-w-2xl">
      <button
        onClick={() => selectOpportunity(null)}
        className="text-xs text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer mb-4"
      >
        &larr; Back to pipeline
      </button>

      <h2 className="text-lg font-semibold text-[var(--cos-text-primary)] mb-1">{opp.name}</h2>

      <div className="flex items-center gap-2 mb-6">
        <Badge variant={statusVariant[opp.status] ?? 'default'}>{opp.status}</Badge>
        {opp.monetary_value != null && (
          <span className="text-sm font-medium text-green-400">
            ${opp.monetary_value.toLocaleString()}
          </span>
        )}
      </div>

      {/* Status Change */}
      <div className="bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg p-4 mb-4">
        <div className="text-xs font-medium text-[var(--cos-text-muted)] uppercase tracking-wider mb-2">
          Change Status
        </div>
        <div className="flex gap-2">
          {statuses.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={opp.status === s ? 'primary' : 'secondary'}
              onClick={() => handleStatusChange(s)}
              disabled={updating || opp.status === s}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3 mb-6">
        <Field label="Contact ID" value={opp.contact_id} />
        <Field label="Pipeline ID" value={opp.pipeline_id} />
        <Field label="Stage ID" value={opp.pipeline_stage_id} />
        <Field label="Assigned To" value={opp.assigned_to} />
      </div>

      {/* Custom Fields */}
      {customFields.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--cos-text-muted)] uppercase tracking-wider mb-2">
            Custom Fields
          </h3>
          <div className="space-y-2">
            {customFields.map((cf) => (
              <div key={cf.id} className="flex justify-between text-xs">
                <span className="text-[var(--cos-text-muted)]">{cf.id}</span>
                <span className="text-[var(--cos-text-primary)]">{String(cf.value ?? '')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value
}: {
  label: string
  value: string | null | undefined
}): React.JSX.Element | null {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm text-[var(--cos-text-primary)]">{value}</div>
    </div>
  )
}
