import { useExtGhlStore } from '../../store/index'
import type { GhlOpportunityRow } from '../../../main/db/opportunities-repo'
import Badge from '@renderer/components/shared/Badge'

interface Props {
  opportunity: GhlOpportunityRow
}

const statusVariant: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  open: 'default',
  won: 'success',
  lost: 'error',
  abandoned: 'warning'
}

export default function OpportunityCard({ opportunity }: Props): React.JSX.Element {
  const selectOpportunity = useExtGhlStore((s) => s.selectOpportunity)

  return (
    <button
      onClick={() => selectOpportunity(opportunity)}
      className="w-full px-3 py-2 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--cos-text-primary)] truncate">
          {opportunity.name}
        </span>
        <Badge variant={statusVariant[opportunity.status] ?? 'default'}>{opportunity.status}</Badge>
      </div>
      {opportunity.monetary_value != null && (
        <div className="text-[10px] text-green-400 font-medium mt-0.5">
          ${opportunity.monetary_value.toLocaleString()}
        </div>
      )}
    </button>
  )
}
