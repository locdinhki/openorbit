// ============================================================================
// OpenOrbit — Dynamic Config Form
//
// Renders form fields from a ToolConfigField[] schema.
// Fetches select/multiselect options dynamically via IPC.
// ============================================================================

import { useState, useEffect } from 'react'
import type { ToolConfigField } from '@openorbit/core/automation/scheduler-types'

interface DynamicConfigFormProps {
  schema: ToolConfigField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
}

const inputClass =
  'w-full px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500'
const labelClass = 'block text-xs font-medium text-[var(--cos-text-secondary)] mb-1'

interface SelectOption {
  label: string
  value: string
}

function useDynamicOptions(field: ToolConfigField): {
  options: SelectOption[]
  loading: boolean
} {
  const [options, setOptions] = useState<SelectOption[]>(field.options ?? [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!field.source) return
    setLoading(true)
    window.api
      .invoke(field.source)
      .then((result: { success?: boolean; data?: Record<string, unknown>[] }) => {
        if (result.success && Array.isArray(result.data)) {
          setOptions(
            result.data.map((item) => ({
              label: String(item[field.labelField ?? 'label'] ?? ''),
              value: String(item[field.valueField ?? 'value'] ?? '')
            }))
          )
        }
      })
      .finally(() => setLoading(false))
  }, [field.source, field.labelField, field.valueField])

  return { options, loading }
}

function TextField({
  field,
  value,
  onChange
}: {
  field: ToolConfigField
  value: string
  onChange: (val: string) => void
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{field.label}</label>
      {field.description && (
        <p className="text-xs text-[var(--cos-text-muted)] mb-1">{field.description}</p>
      )}
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  )
}

function NumberField({
  field,
  value,
  onChange
}: {
  field: ToolConfigField
  value: number | ''
  onChange: (val: number | undefined) => void
}): React.JSX.Element {
  return (
    <div>
      <label className={labelClass}>{field.label}</label>
      {field.description && (
        <p className="text-xs text-[var(--cos-text-muted)] mb-1">{field.description}</p>
      )}
      <input
        type="number"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        placeholder={field.placeholder}
        min={field.min}
        max={field.max}
      />
    </div>
  )
}

function SelectField({
  field,
  value,
  onChange
}: {
  field: ToolConfigField
  value: string
  onChange: (val: string) => void
}): React.JSX.Element {
  const { options, loading } = useDynamicOptions(field)

  return (
    <div>
      <label className={labelClass}>{field.label}</label>
      {field.description && (
        <p className="text-xs text-[var(--cos-text-muted)] mb-1">{field.description}</p>
      )}
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{loading ? 'Loading...' : 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function MultiSelectField({
  field,
  value,
  onChange
}: {
  field: ToolConfigField
  value: string[]
  onChange: (val: string[]) => void
}): React.JSX.Element {
  const { options, loading } = useDynamicOptions(field)

  const toggle = (optValue: string): void => {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  return (
    <div>
      <label className={labelClass}>{field.label}</label>
      {field.description && (
        <p className="text-xs text-[var(--cos-text-muted)] mb-1">{field.description}</p>
      )}
      {loading ? (
        <p className="text-xs text-[var(--cos-text-muted)]">Loading options...</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-[var(--cos-text-muted)]">No options available</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors ${
                value.includes(opt.value)
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)] text-[var(--cos-text-muted)]'
              }`}
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      )}
      {!field.required && value.length === 0 && options.length > 0 && (
        <p className="text-xs text-[var(--cos-text-muted)] mt-1">
          Leave empty to use all available
        </p>
      )}
    </div>
  )
}

function ToggleField({
  field,
  value,
  onChange
}: {
  field: ToolConfigField
  value: boolean
  onChange: (val: boolean) => void
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <div className="relative">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4" />
        </div>
        <span className="text-xs text-[var(--cos-text-secondary)]">{field.label}</span>
      </label>
    </div>
  )
}

export default function DynamicConfigForm({
  schema,
  values,
  onChange
}: DynamicConfigFormProps): React.JSX.Element {
  if (schema.length === 0) {
    return (
      <p className="text-sm text-[var(--cos-text-muted)]">
        No configuration required for this action.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {schema.map((field) => {
        switch (field.type) {
          case 'text':
            return (
              <TextField
                key={field.key}
                field={field}
                value={(values[field.key] as string) ?? ''}
                onChange={(val) => onChange(field.key, val)}
              />
            )
          case 'number':
            return (
              <NumberField
                key={field.key}
                field={field}
                value={(values[field.key] as number) ?? ''}
                onChange={(val) => onChange(field.key, val)}
              />
            )
          case 'select':
            return (
              <SelectField
                key={field.key}
                field={field}
                value={(values[field.key] as string) ?? ''}
                onChange={(val) => onChange(field.key, val)}
              />
            )
          case 'multiselect':
            return (
              <MultiSelectField
                key={field.key}
                field={field}
                value={(values[field.key] as string[]) ?? []}
                onChange={(val) => onChange(field.key, val)}
              />
            )
          case 'toggle':
            return (
              <ToggleField
                key={field.key}
                field={field}
                value={(values[field.key] as boolean) ?? false}
                onChange={(val) => onChange(field.key, val)}
              />
            )
          default:
            return null
        }
      })}
    </div>
  )
}
