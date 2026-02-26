// ============================================================================
// OpenOrbit — Automations Panel (shell-level sidebar view)
// ============================================================================

import { useState } from 'react'
import Button from '../../shared/Button'
import Badge from '../../shared/Badge'
import Toggle from '../../shared/Toggle'
import ScheduleWizard from './ScheduleWizard'
import ScheduleDetailModal from './ScheduleDetailModal'
import { useSchedules } from '../../../lib/use-schedules'
import { cronToHuman, timeAgo } from '../../../lib/cron-utils'
import type { Schedule } from '@openorbit/core/db/schedules-repo'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'

export default function AutomationsPanel(): React.JSX.Element {
  const {
    schedules,
    tools,
    loading,
    executingScheduleIds,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    triggerSchedule,
    wizardOpen,
    editingScheduleId,
    openWizard,
    closeWizard
  } = useSchedules()

  const [detailScheduleId, setDetailScheduleId] = useState<string | null>(null)

  const editingSchedule = editingScheduleId
    ? (schedules.find((s) => s.id === editingScheduleId) ?? null)
    : null

  const detailSchedule = detailScheduleId
    ? (schedules.find((s) => s.id === detailScheduleId) ?? null)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Automations
        </h3>
        <Button size="sm" variant="primary" onClick={() => openWizard()}>
          + New
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && schedules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--cos-text-muted)]">Loading...</p>
          </div>
        )}

        {!loading && schedules.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--cos-text-muted)]">No automations configured yet</p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Create a schedule to automate tasks
            </p>
          </div>
        )}

        {schedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            tool={tools.find((t) => t.taskType === schedule.taskType)}
            isExecuting={executingScheduleIds.has(schedule.id)}
            onToggle={(enabled) => toggleSchedule(schedule.id, enabled)}
            onEdit={() => openWizard(schedule.id)}
            onDelete={() => deleteSchedule(schedule.id)}
            onTrigger={() => triggerSchedule(schedule.id)}
            onClick={() => setDetailScheduleId(schedule.id)}
          />
        ))}
      </div>

      {/* Wizard modal */}
      <ScheduleWizard
        open={wizardOpen}
        onClose={closeWizard}
        onSave={(input) =>
          createSchedule({
            name: input.name,
            taskType: input.taskType,
            cronExpression: input.cronExpression,
            enabled: input.enabled,
            config: input.config
          })
        }
        onUpdate={(id, updates) => updateSchedule(id, updates)}
        tools={tools}
        editingSchedule={editingSchedule}
      />

      {/* Detail modal */}
      <ScheduleDetailModal
        open={detailScheduleId !== null}
        onClose={() => setDetailScheduleId(null)}
        schedule={detailSchedule}
        tool={
          detailSchedule ? tools.find((t) => t.taskType === detailSchedule.taskType) : undefined
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Schedule Card
// ---------------------------------------------------------------------------

function ScheduleCard({
  schedule,
  tool,
  isExecuting,
  onToggle,
  onEdit,
  onDelete,
  onTrigger,
  onClick
}: {
  schedule: Schedule
  tool?: ToolMeta
  isExecuting: boolean
  onToggle: (enabled: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onTrigger: () => void
  onClick: () => void
}): React.JSX.Element {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-md border transition-colors cursor-pointer ${
        isExecuting
          ? 'border-indigo-500/50 bg-[var(--cos-bg-secondary)] animate-pulse-glow'
          : schedule.enabled
            ? 'border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] hover:border-[var(--cos-border-light)]'
            : 'border-[var(--cos-border)] bg-[var(--cos-bg-tertiary)] opacity-60'
      }`}
    >
      {/* Top row: name + toggle */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-[var(--cos-text-primary)] truncate mr-2">
          {schedule.name}
        </span>
        <div onClick={(e) => e.stopPropagation()}>
          <Toggle checked={schedule.enabled} onChange={onToggle} size="sm" />
        </div>
      </div>

      {/* Tool + schedule info */}
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="info">{tool?.label ?? schedule.taskType}</Badge>
        <span className="text-xs text-[var(--cos-text-muted)]">
          {cronToHuman(schedule.cronExpression)}
        </span>
        {isExecuting && <Badge variant="warning">Running</Badge>}
      </div>

      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isExecuting && schedule.lastRunStatus && (
            <Badge
              variant={
                schedule.lastRunStatus === 'success'
                  ? 'success'
                  : schedule.lastRunStatus === 'error'
                    ? 'error'
                    : 'default'
              }
            >
              {schedule.lastRunStatus === 'success' ? 'OK' : schedule.lastRunStatus}
            </Badge>
          )}
          {schedule.lastRunAt && (
            <span className="text-xs text-[var(--cos-text-muted)]">
              {timeAgo(schedule.lastRunAt)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onTrigger}
            disabled={isExecuting}
            className="p-1 rounded hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-muted)] hover:text-indigo-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Run Now"
          >
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="p-1 rounded hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] transition-colors cursor-pointer"
            title="Edit"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-600/10 text-[var(--cos-text-muted)] hover:text-red-400 transition-colors cursor-pointer"
            title="Delete"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
