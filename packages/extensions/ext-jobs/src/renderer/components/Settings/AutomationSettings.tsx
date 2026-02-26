import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import { ipc } from '@renderer/lib/ipc-client'
import Slider from '@renderer/components/shared/Slider'

const AUTONOMY_LABELS = ['Manual', 'Semi-Auto', 'Full Auto'] as const

export default function AutomationSettings(): React.JSX.Element {
  const {
    autonomyLevel,
    autoApplyThreshold,
    reviewThreshold,
    skipThreshold,
    dailyCap,
    sessionCap,
    actionsPerMinute,
    setAutonomyLevel,
    setAutoApplyThreshold,
    setReviewThreshold,
    setSkipThreshold,
    setDailyCap,
    setSessionCap,
    setActionsPerMinute
  } = useStore()

  const [applyDisabled, setApplyDisabled] = useState(false)

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      const keys = [
        'autonomy_level',
        'auto_apply_threshold',
        'review_threshold',
        'skip_threshold',
        'daily_cap',
        'session_cap',
        'actions_per_minute'
      ]
      const setters: Record<string, (v: number) => void> = {
        autonomy_level: setAutonomyLevel,
        auto_apply_threshold: setAutoApplyThreshold,
        review_threshold: setReviewThreshold,
        skip_threshold: setSkipThreshold,
        daily_cap: setDailyCap,
        session_cap: setSessionCap,
        actions_per_minute: setActionsPerMinute
      }
      for (const key of keys) {
        const result = await ipc.settings.get(key)
        if (result.success && result.data) {
          const num = Number(result.data)
          if (!isNaN(num)) setters[key](num)
        }
      }
      const disabledResult = await ipc.settings.get('apply_disabled')
      if (disabledResult.success) {
        setApplyDisabled(disabledResult.data === '1')
      }
    }
    loadSettings()
  }, [])

  const toggleApplyDisabled = (disabled: boolean): void => {
    setApplyDisabled(disabled)
    ipc.settings.update('apply_disabled', disabled ? '1' : '0')
  }

  const saveSetting = (key: string, value: number, setter: (v: number) => void): void => {
    setter(value)
    ipc.settings.update(key, String(value))
  }

  return (
    <div className="space-y-6">
      {/* Disable Auto-Apply toggle */}
      <div
        className={`flex items-center justify-between p-3 rounded-md border ${
          applyDisabled
            ? 'bg-amber-500/10 border-amber-500/40'
            : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)]'
        }`}
      >
        <div>
          <p
            className={`text-sm font-medium ${applyDisabled ? 'text-amber-400' : 'text-[var(--cos-text-primary)]'}`}
          >
            Disable Auto-Apply
          </p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-0.5">
            {applyDisabled
              ? 'Applying is OFF — safe for testing'
              : 'Jobs will be applied to normally'}
          </p>
        </div>
        <button
          onClick={() => toggleApplyDisabled(!applyDisabled)}
          className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors cursor-pointer ${
            applyDisabled ? 'bg-amber-500' : 'bg-[var(--cos-border)]'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              applyDisabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* Autonomy Level */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">
          Autonomy Level
        </h3>
        <p className="text-xs text-[var(--cos-text-muted)] mb-3">
          Controls how independently the system acts.
        </p>
        <div className="flex gap-2">
          {AUTONOMY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => saveSetting('autonomy_level', i + 1, setAutonomyLevel)}
              className={`flex-1 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer border ${
                autonomyLevel === i + 1
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
                  : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)] text-[var(--cos-text-secondary)] hover:border-[var(--cos-border-light)]'
              }`}
            >
              <div className="text-center">
                <div>{label}</div>
                <div className="text-[10px] mt-0.5 text-[var(--cos-text-muted)]">
                  {i === 0 && 'Review everything'}
                  {i === 1 && 'Auto-apply high scores'}
                  {i === 2 && 'Full automation'}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Score Thresholds */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-3">
          Score Thresholds
        </h3>
        <div className="space-y-4">
          <Slider
            label="Auto-Apply"
            value={autoApplyThreshold}
            min={50}
            max={100}
            step={5}
            onChange={(v) => saveSetting('auto_apply_threshold', v, setAutoApplyThreshold)}
          />
          <Slider
            label="Queue for Review"
            value={reviewThreshold}
            min={20}
            max={80}
            step={5}
            onChange={(v) => saveSetting('review_threshold', v, setReviewThreshold)}
          />
          <Slider
            label="Auto-Skip Below"
            value={skipThreshold}
            min={0}
            max={50}
            step={5}
            onChange={(v) => saveSetting('skip_threshold', v, setSkipThreshold)}
          />
        </div>
      </div>

      {/* Rate Limits */}
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-3">Rate Limits</h3>
        <div className="space-y-4">
          <Slider
            label="Daily Application Cap"
            value={dailyCap}
            min={5}
            max={200}
            step={5}
            onChange={(v) => saveSetting('daily_cap', v, setDailyCap)}
          />
          <Slider
            label="Session Cap"
            value={sessionCap}
            min={5}
            max={100}
            step={5}
            onChange={(v) => saveSetting('session_cap', v, setSessionCap)}
          />
          <Slider
            label="Actions per Minute"
            value={actionsPerMinute}
            min={1}
            max={12}
            step={1}
            unit="/min"
            onChange={(v) => saveSetting('actions_per_minute', v, setActionsPerMinute)}
          />
        </div>
      </div>
    </div>
  )
}
