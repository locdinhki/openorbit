// ============================================================================
// OpenOrbit — ActivityBar (VS Code-style icon sidebar)
// ============================================================================

import type { SidebarContribution } from '@openorbit/core/extensions/types'

const ICON_MAP: Record<string, string> = {
  briefcase: 'M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  'message-circle': 'M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  blocks: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v3h3M14 17h3v3',
  zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8'
}

function SvgIcon({ name, size = 20 }: { name: string; size?: number }): React.JSX.Element {
  const path = ICON_MAP[name]
  if (!path) {
    // Fallback: show first letter
    return (
      <span
        className="flex items-center justify-center font-medium text-xs"
        style={{ width: size, height: size }}
      >
        {name.charAt(0).toUpperCase()}
      </span>
    )
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  )
}

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
        <ActivityBarButton key={item.id} item={item} isActive={activeId === item.id} onSelect={onSelect} />
      ))}

      {/* Separator */}
      {shellItems.length > 0 && extensionItems.length > 0 && (
        <div className="w-7 h-px bg-[var(--cos-border)] my-1" />
      )}

      {/* Extension-contributed items */}
      {extensionItems.map((item) => (
        <ActivityBarButton key={item.id} item={item} isActive={activeId === item.id} onSelect={onSelect} />
      ))}
    </div>
  )
}
