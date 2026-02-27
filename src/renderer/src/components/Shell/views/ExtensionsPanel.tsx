// ============================================================================
// OpenOrbit — Extensions Panel (VS Code-style list + detail)
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { ExtensionManifest, SettingContribution } from '@openorbit/core/extensions/types'
import { useShellStore } from '../../../store/shell-store'
import { ipc } from '../../../lib/ipc-client'
import SvgIcon from '../../shared/SvgIcon'
import Badge from '../../shared/Badge'
import Toggle from '../../shared/Toggle'

// ---------------------------------------------------------------------------
// List item
// ---------------------------------------------------------------------------

function ExtensionListItem({
  ext,
  isSelected,
  isEnabled,
  onSelect
}: {
  ext: ExtensionManifest
  isSelected: boolean
  isEnabled: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 transition-colors ${
        isSelected
          ? 'bg-[var(--cos-bg-tertiary)] border-l-2 border-indigo-500'
          : 'hover:bg-[var(--cos-bg-hover)] border-l-2 border-transparent'
      }`}
    >
      <div className="relative flex-shrink-0">
        <div
          className={
            isEnabled
              ? 'text-[var(--cos-text-secondary)]'
              : 'text-[var(--cos-text-muted)] opacity-50'
          }
        >
          <SvgIcon name={ext.icon} size={18} />
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--cos-bg-secondary)] ${isEnabled ? 'bg-green-400' : 'bg-gray-500'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isEnabled ? 'text-[var(--cos-text-primary)]' : 'text-[var(--cos-text-muted)]'}`}
        >
          {ext.displayName}
        </p>
        <p className="text-[11px] text-[var(--cos-text-muted)] truncate">{ext.id}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Settings form
// ---------------------------------------------------------------------------

function SettingField({
  setting,
  value,
  onChange
}: {
  setting: SettingContribution
  value: string
  onChange: (value: string) => void
}): React.JSX.Element {
  if (setting.type === 'boolean') {
    return (
      <Toggle
        checked={value === '1' || value === 'true'}
        onChange={(checked) => onChange(checked ? '1' : '0')}
        size="sm"
      />
    )
  }

  return (
    <input
      type={
        setting.type === 'password' ? 'password' : setting.type === 'number' ? 'number' : 'text'
      }
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={setting.default ?? ''}
      className="w-full px-2.5 py-1.5 text-sm rounded-md bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500/50"
    />
  )
}

function ExtensionSettingsForm({
  settings
}: {
  settings: SettingContribution[]
}): React.JSX.Element {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load(): Promise<void> {
      const result: Record<string, string> = {}
      for (const s of settings) {
        const res = await ipc.settings.get(s.key)
        result[s.key] = res.success && res.data ? res.data : (s.default ?? '')
      }
      if (!cancelled) {
        setValues(result)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [settings])

  const handleChange = useCallback(async (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    await ipc.settings.update(key, value)
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {settings.map((s) => (
          <div key={s.key} className="animate-pulse">
            <div className="h-3 w-24 bg-[var(--cos-bg-hover)] rounded mb-1.5" />
            <div className="h-8 bg-[var(--cos-bg-hover)] rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {settings.map((s) => (
        <div key={s.key}>
          <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
            {s.label}
          </label>
          <SettingField
            setting={s}
            value={values[s.key] ?? ''}
            onChange={(v) => handleChange(s.key, v)}
          />
          {s.description && (
            <p className="text-[11px] text-[var(--cos-text-muted)] mt-1">{s.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

type ToggleStatus = 'idle' | 'activating' | 'success' | 'error'

function ExtensionDetail({
  ext,
  isEnabled,
  onToggle
}: {
  ext: ExtensionManifest
  isEnabled: boolean
  onToggle: (enabled: boolean) => Promise<{ activated?: boolean; error?: string }>
}): React.JSX.Element {
  const settings = ext.contributes.settings ?? []
  const sidebarCount = ext.contributes.sidebar?.length ?? 0
  const workspaceCount = ext.contributes.workspace?.length ?? 0
  const panelCount = ext.contributes.panel?.length ?? 0
  const commandCount = ext.contributes.commands?.length ?? 0
  const hasContributions = sidebarCount + workspaceCount + panelCount + commandCount > 0

  const [toggleStatus, setToggleStatus] = useState<ToggleStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [wasDisabledByUser, setWasDisabledByUser] = useState(false)

  // Reset status when switching extensions
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToggleStatus('idle')
    setStatusMessage('')
    setWasDisabledByUser(false)
  }, [ext.id])

  const handleToggle = async (enabled: boolean): Promise<void> => {
    if (enabled) {
      setToggleStatus('activating')
      setStatusMessage('Activating...')
    }
    const result = await onToggle(enabled)
    if (!enabled) {
      setToggleStatus('idle')
      setStatusMessage('')
      setWasDisabledByUser(true)
      return
    }
    if (result.error) {
      setToggleStatus('error')
      setStatusMessage(`Failed: ${result.error}`)
    } else if (result.activated) {
      setToggleStatus('success')
      setStatusMessage('Activated successfully')
      setTimeout(() => {
        setToggleStatus('idle')
        setStatusMessage('')
      }, 3000)
    } else {
      setToggleStatus('success')
      setStatusMessage('Enabled — restart to activate')
    }
  }

  const badgeVariant = toggleStatus === 'activating' ? 'info' : isEnabled ? 'success' : 'default'
  const badgeLabel =
    toggleStatus === 'activating' ? 'Activating...' : isEnabled ? 'Active' : 'Disabled'

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-secondary)]">
          <SvgIcon name={ext.icon} size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--cos-text-primary)]">
            {ext.displayName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            {ext.version && (
              <span className="text-xs text-[var(--cos-text-muted)]">v{ext.version}</span>
            )}
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
          </div>
        </div>
        <div className="flex-shrink-0 pt-1">
          <Toggle checked={isEnabled} onChange={handleToggle} size="sm" />
        </div>
      </div>

      {/* Status message */}
      {statusMessage && (
        <p
          className={`text-xs ${
            toggleStatus === 'error'
              ? 'text-red-400'
              : toggleStatus === 'success'
                ? 'text-green-400'
                : 'text-blue-400 animate-pulse'
          }`}
        >
          {statusMessage}
        </p>
      )}

      {/* Restart hint — only when user explicitly disabled in this session */}
      {wasDisabledByUser && !isEnabled && toggleStatus === 'idle' && (
        <p className="text-xs text-amber-400/80">Restart the app to fully apply this change.</p>
      )}

      {/* Description */}
      {ext.description && (
        <div>
          <p className="text-sm text-[var(--cos-text-secondary)] leading-relaxed">
            {ext.description}
          </p>
        </div>
      )}

      {/* Contributions summary */}
      {hasContributions && (
        <div>
          <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
            Contributions
          </h3>
          <div className="flex flex-wrap gap-2">
            {sidebarCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
                {sidebarCount} sidebar{sidebarCount > 1 ? 's' : ''}
              </span>
            )}
            {workspaceCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
                {workspaceCount} workspace{workspaceCount > 1 ? 's' : ''}
              </span>
            )}
            {panelCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
                {panelCount} panel{panelCount > 1 ? 's' : ''}
              </span>
            )}
            {commandCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
                {commandCount} command{commandCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Settings */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-3">
          Settings
        </h3>
        {settings.length > 0 ? (
          <ExtensionSettingsForm settings={settings} />
        ) : (
          <p className="text-sm text-[var(--cos-text-muted)]">No configurable settings</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category grouping
// ---------------------------------------------------------------------------

const EXTENSION_CATEGORIES = [
  { key: 'core', label: 'Core' },
  { key: 'ai', label: 'AI Providers' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'messaging', label: 'Messaging' }
] as const

function CategoryHeader({ label }: { label: string }): React.JSX.Element {
  return (
    <div className="px-3 pt-3 pb-1 first:pt-2">
      <p className="text-[10px] font-semibold text-[var(--cos-text-muted)] uppercase tracking-wider">
        {label}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function ExtensionsPanel(): React.JSX.Element {
  const extensions = useShellStore((s) => s.extensions)
  const extensionEnabledMap = useShellStore((s) => s.extensionEnabledMap)
  const setExtensionEnabled = useShellStore((s) => s.setExtensionEnabled)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const groupedExtensions = useMemo(() => {
    const groups = new Map<string, ExtensionManifest[]>()
    for (const cat of EXTENSION_CATEGORIES) groups.set(cat.key, [])
    groups.set('other', [])
    for (const ext of extensions) {
      const key = ext.category ?? 'other'
      const bucket = groups.get(key) ?? groups.get('other')!
      bucket.push(ext)
    }
    return groups
  }, [extensions])

  // Resolve effective selection: use selectedId if it matches a real extension, else fall back to first
  const effectiveId = useMemo(() => {
    if (selectedId && extensions.some((ext) => ext.id === selectedId)) return selectedId
    return extensions[0]?.id ?? null
  }, [extensions, selectedId])

  const selected = extensions.find((ext) => ext.id === effectiveId) ?? null

  const handleToggle = useCallback(
    async (id: string, enabled: boolean): Promise<{ activated?: boolean; error?: string }> => {
      setExtensionEnabled(id, enabled)
      if (enabled) {
        const res = await ipc.shell.enableExtension(id)
        if (!res.success) return { error: res.error ?? 'Activation failed' }
        const data = res.data as { activated?: boolean } | undefined
        return { activated: data?.activated ?? false }
      } else {
        await ipc.shell.disableExtension(id)
        return {}
      }
    },
    [setExtensionEnabled]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Extensions
        </h3>
      </div>

      {extensions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--cos-text-muted)]">No extensions installed</p>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Left: Extension list */}
          <div className="w-64 flex-shrink-0 border-r border-[var(--cos-border)] overflow-y-auto">
            {EXTENSION_CATEGORIES.map((cat) => {
              const exts = groupedExtensions.get(cat.key) ?? []
              if (exts.length === 0) return null
              return (
                <div key={cat.key}>
                  <CategoryHeader label={cat.label} />
                  {exts.map((ext) => (
                    <ExtensionListItem
                      key={ext.id}
                      ext={ext}
                      isSelected={ext.id === effectiveId}
                      isEnabled={extensionEnabledMap[ext.id] !== false}
                      onSelect={() => setSelectedId(ext.id)}
                    />
                  ))}
                </div>
              )
            })}
            {(groupedExtensions.get('other')?.length ?? 0) > 0 && (
              <div>
                <CategoryHeader label="Other" />
                {groupedExtensions.get('other')!.map((ext) => (
                  <ExtensionListItem
                    key={ext.id}
                    ext={ext}
                    isSelected={ext.id === effectiveId}
                    isEnabled={extensionEnabledMap[ext.id] !== false}
                    onSelect={() => setSelectedId(ext.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <ExtensionDetail
                key={selected.id}
                ext={selected}
                isEnabled={extensionEnabledMap[selected.id] !== false}
                onToggle={(enabled) =>
                  handleToggle(selected.id, enabled) as Promise<{
                    activated?: boolean
                    error?: string
                  }>
                }
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-[var(--cos-text-muted)]">
                  Select an extension to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
