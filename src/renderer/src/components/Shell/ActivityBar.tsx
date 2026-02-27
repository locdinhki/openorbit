// ============================================================================
// OpenOrbit — ActivityBar (VS Code-style icon sidebar)
// ============================================================================

import type { SidebarContribution } from '@openorbit/core/extensions/types'
import SvgIcon from '../shared/SvgIcon'

function ActivityBarButton({
  item,
  isActive,
  onSelect
}: {
  item: SidebarContribution
  isActive: boolean
  onSelect: (id: string) => void
}): React.JSX.Element {
  return (
    <button
      onClick={() => onSelect(item.id)}
      title={item.label}
      className={`w-10 h-10 flex items-center justify-center rounded-md transition-colors ${
        isActive
          ? 'text-[var(--cos-text-primary)] bg-[var(--cos-bg-tertiary)]'
          : 'text-[var(--cos-text-tertiary)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-secondary)]'
      }`}
    >
      <SvgIcon name={item.icon} />
    </button>
  )
}

interface ActivityBarProps {
  shellItems: SidebarContribution[]
  extensionItems: SidebarContribution[]
  activeId: string | null
  onSelect: (id: string) => void
}

export default function ActivityBar({
  shellItems,
  extensionItems,
  activeId,
  onSelect
}: ActivityBarProps): React.JSX.Element {
  return (
    <div className="w-12 flex-shrink-0 flex flex-col items-center gap-1 py-2 border-r border-[var(--cos-border)] bg-[var(--cos-bg-primary)]">
      {/* Shell built-in items */}
      {shellItems.map((item) => (
        <ActivityBarButton
          key={item.id}
          item={item}
          isActive={activeId === item.id}
          onSelect={onSelect}
        />
      ))}

      {/* Separator */}
      {shellItems.length > 0 && extensionItems.length > 0 && (
        <div className="w-7 h-px bg-[var(--cos-border)] my-1" />
      )}

      {/* Extension-contributed items */}
      {extensionItems.map((item) => (
        <ActivityBarButton
          key={item.id}
          item={item}
          isActive={activeId === item.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
