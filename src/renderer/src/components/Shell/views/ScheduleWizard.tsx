// ============================================================================
// OpenOrbit — Schedule Wizard (multi-step modal)
// ============================================================================

import { useState, useMemo, useEffect } from 'react'
import Modal from '../../shared/Modal'
import Button from '../../shared/Button'
import DynamicConfigForm from './DynamicConfigForm'
import { CRON_PRESETS, cronToHuman, isValidCron } from '../../../lib/cron-utils'
import type { ToolMeta } from '@openorbit/core/automation/scheduler-types'
import type { Schedule } from '@openorbit/core/db/schedules-repo'

interface ScheduleWizardProps {
  open: boolean
  onClose: () => void
  onSave: (input: {
    name: string
    taskType: string
    cronExpression: string
    enabled: boolean
    config: Record<string, unknown>
  }) => void
  onUpdate?: (
    id: string,
    updates: Partial<{
      name: string
      cronExpression: string
      enabled: boolean
      config: Record<string, unknown>
    }>
  ) => void
  tools: ToolMeta[]
  editingSchedule?: Schedule | null
}

type Step = 'action' | 'config' | 'schedule' | 'review'

const inputClass =
  'w-full px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500'
const labelClass = 'block text-xs font-medium text-[var(--cos-text-secondary)] mb-1'

export default function ScheduleWizard({
  open,
  onClose,
  onSave,
  onUpdate,
  tools,
  editingSchedule
}: ScheduleWizardProps): React.JSX.Element | null {
  const isEdit = !!editingSchedule

  const [step, setStep] = useState<Step>('action')
  const [taskType, setTaskType] = useState<string>('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [name, setName] = useState('')
  const [cronPreset, setCronPreset] = useState('custom')
  const [cronExpression, setCronExpression] = useState('')
  const [enabled, setEnabled] = useState(true)

  // Reset all state when wizard opens (for both create and edit)
  useEffect(() => {
    if (!open) return

    if (editingSchedule) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setTaskType(editingSchedule.taskType)
      setConfig(editingSchedule.config ?? {})
      setName(editingSchedule.name)
      setCronExpression(editingSchedule.cronExpression)
      setEnabled(editingSchedule.enabled)
      // Match cron preset if possible
      const preset = CRON_PRESETS.find((p) => p.value === editingSchedule.cronExpression)
      setCronPreset(preset ? preset.value : 'custom')
      // Skip to schedule step for edit (action + config already chosen)
      setStep('schedule')
    } else {
      setTaskType(tools.length === 1 ? tools[0].taskType : '')
      setConfig({})
      setName('')
      setCronExpression('')
      setEnabled(true)
      setCronPreset('custom')
      setStep('action')
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open, editingSchedule, tools])

  const selectedTool = tools.find((t) => t.taskType === taskType)
  const hasConfigFields = (selectedTool?.configSchema.length ?? 0) > 0

  // Determine which steps to show
  const activeSteps = useMemo(() => {
    const steps: Step[] = []
    if (tools.length > 1 || !taskType) steps.push('action')
    if (hasConfigFields) steps.push('config')
    steps.push('schedule', 'review')
    return steps
  }, [tools.length, taskType, hasConfigFields])

  const currentStepIndex = activeSteps.indexOf(step)

  const canGoNext = (): boolean => {
    switch (step) {
      case 'action':
        return !!taskType
      case 'config':
        return true // config fields are optional
      case 'schedule':
        return !!name.trim() && !!cronExpression.trim() && isValidCron(cronExpression)
      case 'review':
        return true
      default:
        return false
    }
  }

  const goNext = (): void => {
    if (currentStepIndex < activeSteps.length - 1) {
      setStep(activeSteps[currentStepIndex + 1])
    }
  }

  const goBack = (): void => {
    if (currentStepIndex > 0) {
      setStep(activeSteps[currentStepIndex - 1])
    }
  }

  const handleCronPresetChange = (value: string): void => {
    setCronPreset(value)
    if (value !== 'custom') {
      setCronExpression(value)
    }
  }

  const handleConfigChange = (key: string, value: unknown): void => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (): void => {
    // Clean config: remove empty arrays
    const cleanConfig: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(config)) {
      if (Array.isArray(v) && v.length === 0) continue
      if (v === '' || v === undefined) continue
      cleanConfig[k] = v
    }

    if (isEdit && onUpdate && editingSchedule) {
      onUpdate(editingSchedule.id, {
        name: name.trim(),
        cronExpression,
        enabled,
        config: cleanConfig
      })
    } else {
      onSave({
        name: name.trim(),
        taskType,
        cronExpression,
        enabled,
        config: cleanConfig
      })
    }
    onClose()
  }

  // Auto-generate name from tool
  const suggestName = (): void => {
    if (!name && selectedTool) {
      setName(selectedTool.label)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Schedule' : 'New Schedule'}
      className="max-w-2xl"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--cos-border)]">
        {activeSteps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-6 h-px bg-[var(--cos-border)]" />}
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                s === step
                  ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                  : i < currentStepIndex
                    ? 'text-[var(--cos-text-secondary)]'
                    : 'text-[var(--cos-text-muted)]'
              }`}
            >
              {s === 'action' && 'Action'}
              {s === 'config' && 'Configure'}
              {s === 'schedule' && 'Schedule'}
              {s === 'review' && 'Review'}
            </span>
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[200px] max-h-[50vh] overflow-y-auto">
        {step === 'action' && (
          <div className="space-y-3">
            <p className="text-xs text-[var(--cos-text-muted)] mb-3">
              Select the action to schedule:
            </p>
            {tools.map((tool) => (
              <button
                key={tool.taskType}
                onClick={() => {
                  setTaskType(tool.taskType)
                  goNext()
                }}
                className={`w-full text-left p-3 rounded-md border transition-colors cursor-pointer ${
                  taskType === tool.taskType
                    ? 'border-indigo-500/40 bg-indigo-600/10'
                    : 'border-[var(--cos-border)] bg-[var(--cos-bg-tertiary)] hover:border-[var(--cos-border-light)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[var(--cos-text-primary)]">
                    {tool.label}
                  </span>
                  <span className="text-xs text-[var(--cos-text-muted)]">{tool.extensionId}</span>
                </div>
                <p className="text-xs text-[var(--cos-text-muted)] mt-1">{tool.description}</p>
              </button>
            ))}
            {tools.length === 0 && (
              <p className="text-sm text-[var(--cos-text-muted)] text-center py-8">
                No automation tools registered. Install an extension that provides scheduled
                actions.
              </p>
            )}
          </div>
        )}

        {step === 'config' && selectedTool && (
          <div className="space-y-4">
            <p className="text-xs text-[var(--cos-text-muted)]">Configure {selectedTool.label}:</p>
            <DynamicConfigForm
              schema={selectedTool.configSchema}
              values={config}
              onChange={handleConfigChange}
            />
          </div>
        )}

        {step === 'schedule' && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Schedule Name</label>
              <input
                type="text"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={suggestName}
                placeholder="e.g. Weekday morning extraction"
              />
            </div>

            <div>
              <label className={labelClass}>Frequency</label>
              <select
                className={inputClass}
                value={CRON_PRESETS.some((p) => p.value === cronPreset) ? cronPreset : 'custom'}
                onChange={(e) => handleCronPresetChange(e.target.value)}
              >
                {CRON_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </select>
            </div>

            {(cronPreset === 'custom' || !CRON_PRESETS.some((p) => p.value === cronPreset)) && (
              <div>
                <label className={labelClass}>Cron Expression</label>
                <input
                  type="text"
                  className={inputClass}
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 9 * * 1-5"
                />
                <p className="text-xs text-[var(--cos-text-muted)] mt-1">
                  Format: minute hour day-of-month month day-of-week
                </p>
              </div>
            )}

            {cronExpression && (
              <div className="p-2 rounded bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]">
                <span className="text-xs text-[var(--cos-text-muted)]">Preview: </span>
                <span
                  className={`text-xs ${
                    isValidCron(cronExpression) ? 'text-[var(--cos-text-primary)]' : 'text-red-400'
                  }`}
                >
                  {isValidCron(cronExpression)
                    ? cronToHuman(cronExpression)
                    : 'Invalid cron expression'}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4" />
                </div>
                <span className="text-xs text-[var(--cos-text-secondary)]">Enable immediately</span>
              </label>
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
              Summary
            </h4>
            <div className="space-y-2">
              <ReviewRow label="Action" value={selectedTool?.label ?? taskType} />
              <ReviewRow label="Extension" value={selectedTool?.extensionId ?? '-'} />
              {Object.keys(config).length > 0 && (
                <ReviewRow
                  label="Configuration"
                  value={
                    Object.entries(config)
                      .filter(([, v]) => {
                        if (Array.isArray(v)) return v.length > 0
                        return v !== '' && v !== undefined
                      })
                      .map(([k, v]) => `${k}: ${Array.isArray(v) ? `${v.length} selected` : v}`)
                      .join(', ') || 'Default'
                  }
                />
              )}
              <ReviewRow label="Name" value={name} />
              <ReviewRow label="Schedule" value={cronToHuman(cronExpression)} />
              <ReviewRow label="Status" value={enabled ? 'Enabled' : 'Disabled'} />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex justify-between mt-4 pt-3 border-t border-[var(--cos-border)]">
        <div>
          {currentStepIndex > 0 && (
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {step === 'review' ? (
            <Button variant="primary" onClick={handleSubmit}>
              {isEdit ? 'Save Changes' : 'Create Schedule'}
            </Button>
          ) : (
            <Button variant="primary" onClick={goNext} disabled={!canGoNext()}>
              Next
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 px-3 rounded bg-[var(--cos-bg-tertiary)]">
      <span className="text-xs text-[var(--cos-text-muted)]">{label}</span>
      <span className="text-xs text-[var(--cos-text-primary)] font-medium">{value}</span>
    </div>
  )
}
