// ============================================================================
// OpenOrbit — Skill Card (catalog grid item)
// ============================================================================

import type { CatalogListItem } from '@openorbit/core/skills/skill-catalog'
import SvgIcon from '../../shared/SvgIcon'

interface SkillCardProps {
  skill: CatalogListItem
  isEnabled?: boolean
  onInstall: (id: string) => void
  onUninstall: (id: string) => void
  onEnable?: (id: string) => void
  onDisable?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onConfigure?: (id: string) => void
}

export default function SkillCard({
  skill,
  isEnabled = false,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onEdit,
  onDelete,
  onConfigure
}: SkillCardProps): React.JSX.Element {
  return (
    <div className="rounded-lg border border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] p-4 flex flex-col gap-3 hover:border-[var(--cos-border-hover)] transition-colors">
      {/* Top row: icon + name + action */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-md bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-secondary)]">
          <SvgIcon name={skill.icon} size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
            {skill.displayName}
          </h4>
          <p className="text-[11px] text-[var(--cos-text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
            {skill.description}
          </p>
        </div>
      </div>

      {/* Bottom row: badges + action button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {skill.isBuiltIn && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
              Built-in
            </span>
          )}
          {skill.isCustom && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400">
              Custom
            </span>
          )}
          {skill.type === 'instruction' && !skill.isCustom && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)]">
              Instruction
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Configure button for skills with configFields */}
          {skill.configFields && skill.configFields.length > 0 && onConfigure && (
            <button
              onClick={() => onConfigure(skill.id)}
              title="Configure"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
            >
              <SvgIcon name="settings" size={14} />
            </button>
          )}

          {/* Custom skill edit/delete */}
          {skill.isCustom && onEdit && (
            <button
              onClick={() => onEdit(skill.id)}
              title="Edit"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
            >
              <SvgIcon name="settings" size={14} />
            </button>
          )}
          {skill.isCustom && onDelete && (
            <button
              onClick={() => onDelete(skill.id)}
              title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <SvgIcon name="trash" size={14} />
            </button>
          )}

          {/* Unified Enable/Disable button */}
          {(() => {
            // Determine active state: built-in tools use enabledMap, others use isInstalled
            const isActive =
              skill.isBuiltIn && skill.type === 'tool' ? isEnabled : skill.isInstalled
            const handleActivate = (): void => {
              if (skill.isBuiltIn && skill.type === 'tool') {
                onEnable?.(skill.id)
              } else {
                onInstall(skill.id)
              }
            }
            const handleDeactivate = (): void => {
              if (skill.isBuiltIn && skill.type === 'tool') {
                onDisable?.(skill.id)
              } else {
                onUninstall(skill.id)
              }
            }

            return isActive ? (
              <button
                onClick={handleDeactivate}
                title="Disable"
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-md bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400 transition-colors"
              >
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Enabled
              </button>
            ) : (
              <button
                onClick={handleActivate}
                title="Enable"
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-accent)] hover:bg-[var(--cos-accent)]/10 transition-colors border border-[var(--cos-border)]"
              >
                Enable
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
