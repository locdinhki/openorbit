// ============================================================================
// OpenOrbit — Schedule Detail Modal (run history)
// ============================================================================

import { useState, useEffect } from 'react'
import Modal from '../../shared/Modal'
import Badge from '../../shared/Badge'
import Skeleton from '../../shared/Skeleton'
import { ipc } from '../../../lib/ipc-client'
import { cronToHuman, timeAgo } from '../../../lib/cron-utils'
import type { Schedule } from '@openorbit/core/db/schedules-repo'
import type { ScheduleRun } from '@openorbit/core/db/schedule-runs-repo'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'

interface ScheduleDetailModalProps {
  open: boolean
  onClose: () => void
  schedule: Schedule | null
  tool?: ToolMeta
}

export default function ScheduleDetailModal({
  open,
  onClose,
  schedule,
  tool
}: ScheduleDetailModalProps): React.JSX.Element | null {
  const [runs, setRuns] = useState<ScheduleRun[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !schedule) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRuns([])
      return
    }

    setLoading(true)
    ipc.schedules
      .runs(schedule.id, 20, 0)
      .then((result) => {
        if (result.success && result.data) setRuns(result.data)
      })
      .finally(() => setLoading(false))
  }, [open, schedule?.id])

  if (!schedule) return null

  return (
    <Modal open={open} onClose={onClose} title={schedule.name}>
      {/* Schedule summary */}
      <div className="flex items-center gap-2 mb-4">
        <Badge variant="info">{tool?.label ?? schedule.taskType}</Badge>
        <span className="text-xs text-[var(--cos-text-muted)]">
          {cronToHuman(schedule.cronExpression)}
        </span>
        <Badge variant={schedule.enabled ? 'success' : 'default'}>
          {schedule.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </div>

      {/* Run history */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
          Run History
        </h3>

        {loading && <Skeleton lines={4} />}

        {!loading && runs.length === 0 && (
          <p className="text-xs text-[var(--cos-text-muted)] py-4 text-center">No runs yet</p>
        )}

        {!loading && runs.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {runs.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

function RunRow({ run }: { run: ScheduleRun }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded text-xs bg-[var(--cos-bg-tertiary)]">
      <Badge
        variant={
          run.status === 'success' ? 'success' : run.status === 'error' ? 'error' : 'warning'
        }
      >
        {run.status === 'success' ? 'OK' : run.status}
      </Badge>

      <span className="text-[var(--cos-text-muted)]">{timeAgo(run.startedAt)}</span>

      {run.durationMs != null && (
        <span className="text-[var(--cos-text-muted)]">{formatDuration(run.durationMs)}</span>
      )}

      {run.errorMessage && (
        <span className="text-red-400 truncate flex-1" title={run.errorMessage}>
          {run.errorMessage}
        </span>
      )}
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}
