// ============================================================================
// OpenOrbit — ActivityBar (VS Code-style icon sidebar)
// ============================================================================

import { useState, useRef, useEffect } from 'react'
import type { SidebarContribution } from '@openorbit/core/extensions/types'
import SvgIcon from '../shared/SvgIcon'
import { useShellStore } from '../../store/shell-store'
import { ipc } from '../../lib/ipc-client'

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

function SettingsGear(): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { updateVersion, updateReady, updateDownloading, setUpdateDownloading } = useShellStore()
  const hasUpdate = updateVersion !== null

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent): void => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const handleDownload = async (): Promise<void> => {
    setUpdateDownloading(true)
    await ipc.update.download()
  }

  const handleInstall = async (): Promise<void> => {
    await ipc.update.install()
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setMenuOpen((prev) => !prev)}
        title="Settings"
        className="w-10 h-10 flex items-center justify-center rounded-md transition-colors text-[var(--cos-text-tertiary)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-secondary)] relative"
      >
        <SvgIcon name="settings" />
        {hasUpdate && (
          <span
            className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--cos-bg-primary)] ${
              updateReady ? 'bg-[var(--cos-success)]' : 'bg-[var(--cos-accent)]'
            }`}
          />
        )}
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-0 left-full ml-2 w-56 rounded-lg border border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] shadow-xl z-50 overflow-hidden"
        >
          {hasUpdate && (
            <div className="px-3 py-2.5 border-b border-[var(--cos-border)]">
              <div className="text-[11px] font-medium text-[var(--cos-text-primary)] mb-1.5">
                v{updateVersion} available
              </div>
              {updateReady ? (
                <button
                  onClick={handleInstall}
                  className="w-full text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--cos-success)] text-white hover:brightness-110 transition-all"
                >
                  Restart to Update
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  disabled={updateDownloading}
                  className="w-full text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--cos-accent)] text-white hover:bg-[var(--cos-accent-hover)] transition-colors disabled:opacity-50"
                >
                  {updateDownloading ? 'Downloading...' : 'Download Update'}
                </button>
              )}
            </div>
          )}
          <div className="px-3 py-2 text-[10px] text-[var(--cos-text-muted)]">
            OpenOrbit v{__APP_VERSION__}
          </div>
        </div>
      )}
    </div>
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

      {/* Spacer to push gear to bottom */}
      <div className="flex-1" />

      {/* Settings gear with update badge */}
      <SettingsGear />
    </div>
  )
}
