// ============================================================================
// OpenOrbit — Skill Configuration Modal
//
// Shows settings fields for configurable skills (SMTP, Twilio, etc.)
// Reads/writes values via the settings IPC channel.
// ============================================================================

import { useState, useEffect } from 'react'
import type { ConfigField } from '@openorbit/core/skills/skill-catalog'
import { ipc } from '../../../lib/ipc-client'
import SvgIcon from '../../shared/SvgIcon'

interface SkillConfigModalProps {
  open: boolean
  skillName: string
  fields: ConfigField[]
  onClose: () => void
}

const inputClass =
  'w-full px-3 py-2 text-sm rounded-md bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500/50'

export default function SkillConfigModal({
  open,
  skillName,
  fields,
  onClose
}: SkillConfigModalProps): React.JSX.Element | null {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load current values from settings
  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    Promise.all(
      fields.map(async (f) => {
        const res = await ipc.settings.get(f.key)
        return [f.key, res.success && res.data ? res.data : ''] as const
      })
    ).then((entries) => {
      setValues(Object.fromEntries(entries))
      setLoading(false)
    })
  }, [open, fields])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const handleChange = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleToggle = (key: string): void => {
    setValues((prev) => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }))
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    await Promise.all(fields.map((f) => ipc.settings.update(f.key, values[f.key] ?? '')))
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl border border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cos-border)]">
          <h2 className="text-sm font-semibold text-[var(--cos-text-primary)]">
            Configure {skillName}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
          >
            <SvgIcon name="x" size={14} />
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-[var(--cos-text-muted)]">Loading...</p>
          ) : (
            fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                {field.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={values[field.key] === 'true'}
                        onChange={() => handleToggle(field.key)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4" />
                    </div>
                  </label>
                ) : (
                  <input
                    type={
                      field.type === 'password'
                        ? 'password'
                        : field.type === 'number'
                          ? 'number'
                          : 'text'
                    }
                    value={values[field.key] ?? ''}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--cos-border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--cos-accent)] text-white hover:bg-[var(--cos-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
