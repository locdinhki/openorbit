// ============================================================================
// OpenOrbit — Skills Panel (shell-level sidebar view)
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import type { SkillInfo, SkillCategory } from '@openorbit/core/skills/skill-types'
import { ipc } from '../../../lib/ipc-client'
import SvgIcon from '../../shared/SvgIcon'
import Badge from '../../shared/Badge'
import Toggle from '../../shared/Toggle'

// ---------------------------------------------------------------------------
// Category metadata
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<SkillCategory, { label: string; icon: string }> = {
  document: { label: 'Document', icon: 'list' },
  communication: { label: 'Communication', icon: 'send' },
  data: { label: 'Data', icon: 'database' },
  media: { label: 'Media', icon: 'microphone' },
  utility: { label: 'Utility', icon: 'settings' }
}

const CATEGORIES: SkillCategory[] = ['document', 'communication', 'data', 'media', 'utility']

/** Get the best icon for a skill: per-skill icon > category fallback */
function getSkillIcon(skill: SkillInfo): string {
  return skill.icon ?? CATEGORY_META[skill.category].icon
}

// ---------------------------------------------------------------------------
// Skill list item
// ---------------------------------------------------------------------------

function SkillListItem({
  skill,
  isSelected,
  isEnabled,
  onSelect
}: {
  skill: SkillInfo
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
          <SvgIcon name={getSkillIcon(skill)} size={18} />
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[var(--cos-bg-secondary)] ${isEnabled ? 'bg-green-400' : 'bg-gray-500'}`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${isEnabled ? 'text-[var(--cos-text-primary)]' : 'text-[var(--cos-text-muted)]'}`}
        >
          {skill.displayName}
        </p>
        <p className="text-[11px] text-[var(--cos-text-muted)] truncate">{skill.id}</p>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Skill detail panel
// ---------------------------------------------------------------------------

function SkillDetail({
  skill,
  isEnabled,
  onToggle
}: {
  skill: SkillInfo
  isEnabled: boolean
  onToggle: (enabled: boolean) => void
}): React.JSX.Element {
  const catMeta = CATEGORY_META[skill.category]
  const paramNames = Object.keys(skill.inputSchema.properties)
  const requiredParams = skill.inputSchema.required ?? []

  const badgeVariant = isEnabled ? 'success' : 'default'
  const badgeLabel = isEnabled ? 'Active' : 'Disabled'

  return (
    <div className="p-5 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 flex items-center justify-center rounded-lg bg-[var(--cos-bg-tertiary)] ${
            isEnabled
              ? 'text-[var(--cos-text-secondary)]'
              : 'text-[var(--cos-text-muted)] opacity-50'
          }`}
        >
          <SvgIcon name={getSkillIcon(skill)} size={28} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--cos-text-primary)]">
            {skill.displayName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="info">{catMeta.label}</Badge>
            <Badge variant={badgeVariant}>{badgeLabel}</Badge>
            <span className="text-xs text-[var(--cos-text-muted)]">by {skill.extensionId}</span>
          </div>
        </div>
        <div className="flex-shrink-0 pt-1">
          <Toggle checked={isEnabled} onChange={onToggle} size="sm" />
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-[var(--cos-text-secondary)] leading-relaxed">
        {skill.description}
      </p>

      {/* Capabilities */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
          Capabilities
        </h3>
        <div className="flex flex-wrap gap-2">
          {skill.capabilities.aiTool !== false && <Badge variant="score">AI Tool</Badge>}
          {skill.capabilities.streaming && <Badge variant="info">Streaming</Badge>}
          {skill.capabilities.offlineCapable && <Badge variant="success">Offline</Badge>}
          {skill.capabilities.requiresBrowser && <Badge variant="warning">Browser</Badge>}
        </div>
      </div>

      {/* Parameters */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
          Parameters
        </h3>
        {paramNames.length === 0 ? (
          <p className="text-sm text-[var(--cos-text-muted)]">No parameters</p>
        ) : (
          <div className="space-y-2">
            {paramNames.map((name) => {
              const param = skill.inputSchema.properties[name]
              const isRequired = requiredParams.includes(name)
              return (
                <div
                  key={name}
                  className="px-3 py-2 rounded-md bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)]"
                >
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-indigo-400">{name}</code>
                    <span className="text-[10px] text-[var(--cos-text-muted)]">{param.type}</span>
                    {isRequired && <Badge variant="warning">required</Badge>}
                  </div>
                  {param.description && (
                    <p className="text-xs text-[var(--cos-text-muted)] mt-1">{param.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Output */}
      <div>
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider mb-2">
          Output
        </h3>
        <div className="px-3 py-2 rounded-md bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)]">
          <span className="text-xs font-mono text-[var(--cos-text-muted)]">
            {skill.outputSchema.type}
          </span>
          {skill.outputSchema.description && (
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              {skill.outputSchema.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function SkillsPanel(): React.JSX.Element {
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const loadSkills = useCallback(async () => {
    const res = await ipc.skills.list()
    if (res.success && res.data) {
      setSkills(res.data.skills)
      setEnabledMap(res.data.enabledMap)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSkills()
  }, [loadSkills])

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    // Optimistic update
    setEnabledMap((prev) => ({ ...prev, [id]: enabled }))
    if (enabled) {
      await ipc.skills.enable(id)
    } else {
      await ipc.skills.disable(id)
    }
  }, [])

  const selected = skills.find((s) => s.id === selectedId) ?? skills[0] ?? null

  // Group skills by category
  const grouped = new Map<SkillCategory, SkillInfo[]>()
  for (const cat of CATEGORIES) grouped.set(cat, [])
  for (const skill of skills) {
    const bucket = grouped.get(skill.category)
    if (bucket) bucket.push(skill)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Skills
        </h3>
      </div>

      {loading && skills.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[var(--cos-text-muted)]">Loading...</p>
        </div>
      )}

      {!loading && skills.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-[var(--cos-text-muted)] mb-2">
              <SvgIcon name="sparkles" size={32} />
            </div>
            <p className="text-sm text-[var(--cos-text-muted)]">No skills registered</p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Extensions can register skills during activation
            </p>
          </div>
        </div>
      )}

      {skills.length > 0 && (
        <div className="flex flex-1 min-h-0">
          {/* Left: Skill list */}
          <div className="w-56 flex-shrink-0 border-r border-[var(--cos-border)] overflow-y-auto">
            {CATEGORIES.map((cat) => {
              const items = grouped.get(cat) ?? []
              if (items.length === 0) return null
              return (
                <div key={cat}>
                  <div className="px-3 pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-[var(--cos-text-muted)] uppercase tracking-wider">
                      {CATEGORY_META[cat].label}
                    </p>
                  </div>
                  {items.map((skill) => (
                    <SkillListItem
                      key={skill.id}
                      skill={skill}
                      isSelected={skill.id === (selected?.id ?? null)}
                      isEnabled={enabledMap[skill.id] !== false}
                      onSelect={() => setSelectedId(skill.id)}
                    />
                  ))}
                </div>
              )
            })}
          </div>

          {/* Right: Detail panel */}
          <div className="flex-1 overflow-y-auto">
            {selected ? (
              <SkillDetail
                key={selected.id}
                skill={selected}
                isEnabled={enabledMap[selected.id] !== false}
                onToggle={(enabled) => handleToggle(selected.id, enabled)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-[var(--cos-text-muted)]">
                  Select a skill to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
