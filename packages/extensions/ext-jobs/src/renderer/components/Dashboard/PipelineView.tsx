import type { JobStatus } from '@openorbit/core/types'
import { useStore } from '../../store'

interface PipelineStage {
  label: string
  statuses: JobStatus[]
  color: string
}

const STAGES: PipelineStage[] = [
  { label: 'New', statuses: ['new'], color: 'bg-gray-500' },
  { label: 'Reviewed', statuses: ['reviewed'], color: 'bg-blue-500' },
  { label: 'Approved', statuses: ['approved'], color: 'bg-indigo-500' },
  { label: 'Applied', statuses: ['applied'], color: 'bg-green-500' }
]

interface PipelineViewProps {
  onStageClick?: (statuses: JobStatus[]) => void
}

export default function PipelineView({ onStageClick }: PipelineViewProps): React.JSX.Element {
  const jobs = useStore((s) => s.jobs)

  function getCount(statuses: JobStatus[]): number {
    return jobs.filter((j) => statuses.includes(j.status as JobStatus)).length
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-[var(--cos-text-secondary)] uppercase tracking-wider">
        Pipeline
      </h3>
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const count = getCount(stage.statuses)
          return (
            <div key={stage.label} className="flex items-center">
              <button
                onClick={() => onStageClick?.(stage.statuses)}
                className="flex flex-col items-center px-3 py-2 rounded hover:bg-[var(--cos-bg-hover)] transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-full ${stage.color} flex items-center justify-center text-white text-xs font-bold`}
                >
                  {count}
                </div>
                <span className="text-[10px] text-[var(--cos-text-secondary)] mt-1">
                  {stage.label}
                </span>
              </button>
              {i < STAGES.length - 1 && <div className="w-4 h-px bg-[var(--cos-border)]" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
