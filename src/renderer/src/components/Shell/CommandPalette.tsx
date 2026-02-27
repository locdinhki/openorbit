// ============================================================================
// OpenOrbit — Command Palette
//
// Modal overlay with filtered command list.
// Opens via Cmd/Ctrl+K or clicking the title bar search trigger.
// v1 commands: navigate to sidebar views + basic shell actions.
// ============================================================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useShellStore, getAllSidebarContributions } from '../../store/shell-store'
import { SHELL_SIDEBAR_ITEMS } from './shell-sidebar-items'
import SvgIcon from '../shared/SvgIcon'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaletteCommand {
  id: string
  label: string
  icon: string
  category: string
  keywords?: string
  execute: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simple substring match. Returns -1 for no match, or index (lower = better). */
function matchScore(query: string, text: string): number {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  return idx
}

// ---------------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  onClose: () => void
}

export default function CommandPalette({ onClose }: CommandPaletteProps): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [rawSelectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const extensions = useShellStore((s) => s.extensions)
  const extensionEnabledMap = useShellStore((s) => s.extensionEnabledMap)
  const setActiveSidebar = useShellStore((s) => s.setActiveSidebar)

  // Build command list from shell items, extension sidebars, and extension settings
  const commands = useMemo<PaletteCommand[]>(() => {
    const cmds: PaletteCommand[] = []

    // Shell navigation commands
    for (const item of SHELL_SIDEBAR_ITEMS) {
      cmds.push({
        id: `nav:${item.id}`,
        label: `Go to ${item.label}`,
        icon: item.icon,
        category: 'Navigation',
        keywords: item.label,
        execute: () => setActiveSidebar(item.id)
      })
    }

    // Extension sidebar navigation commands
    const extSidebars = getAllSidebarContributions(extensions, extensionEnabledMap)
    for (const item of extSidebars) {
      cmds.push({
        id: `nav:${item.id}`,
        label: `Go to ${item.label}`,
        icon: item.icon,
        category: 'Navigation',
        keywords: item.label,
        execute: () => setActiveSidebar(item.id)
      })
    }

    // Extension settings commands — search by extension name, open Extensions panel
    for (const ext of extensions) {
      cmds.push({
        id: `ext:${ext.id}`,
        label: `${ext.displayName}`,
        icon: ext.icon ?? 'blocks',
        category: 'Extension',
        keywords: `${ext.displayName} ${ext.id} ${ext.category ?? ''}`,
        execute: () => setActiveSidebar('shell-extensions')
      })

      // Add individual settings as searchable commands
      const settings = ext.contributes.settings ?? []
      for (const setting of settings) {
        cmds.push({
          id: `setting:${setting.key}`,
          label: `${ext.displayName}: ${setting.label}`,
          icon: 'settings',
          category: 'Setting',
          keywords: `${setting.key} ${setting.label} ${ext.displayName} ${setting.description ?? ''}`,
          execute: () => setActiveSidebar('shell-extensions')
        })
      }
    }

    return cmds
  }, [extensions, extensionEnabledMap, setActiveSidebar])

  // Filter and score commands based on query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    return commands
      .map((cmd) => {
        const labelScore = matchScore(query, cmd.label)
        const keywordScore = cmd.keywords ? matchScore(query, cmd.keywords) : -1
        const best =
          labelScore >= 0 && keywordScore >= 0
            ? Math.min(labelScore, keywordScore)
            : Math.max(labelScore, keywordScore)
        return { cmd, score: best }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.cmd)
  }, [commands, query])

  // Auto-focus input on mount
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // Derive clamped index
  const selectedIndex = Math.min(rawSelectedIndex, Math.max(0, filtered.length - 1))

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const items = listRef.current.children
    if (items[selectedIndex]) {
      ;(items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const executeAndClose = useCallback(
    (cmd: PaletteCommand) => {
      cmd.execute()
      onClose()
    },
    [onClose]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) executeAndClose(filtered[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filtered, selectedIndex, executeAndClose, onClose]
  )

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[50px] bg-black/40 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-[520px] bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg shadow-2xl overflow-hidden animate-slide-up"
        style={{ maxHeight: 'min(420px, 70vh)' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[var(--cos-border)]">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--cos-text-muted)] flex-shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] outline-none"
            spellCheck={false}
          />
        </div>

        {/* Results list */}
        <div
          ref={listRef}
          className="overflow-y-auto"
          style={{ maxHeight: 'calc(min(420px, 70vh) - 44px)' }}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-[var(--cos-text-muted)]">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => executeAndClose(cmd)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === selectedIndex
                    ? 'bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-primary)]'
                    : 'text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)]'
                }`}
              >
                <span
                  className={
                    i === selectedIndex
                      ? 'text-[var(--cos-accent)]'
                      : 'text-[var(--cos-text-muted)]'
                  }
                >
                  <SvgIcon name={cmd.icon} size={16} />
                </span>
                <span className="text-sm truncate">{cmd.label}</span>
                <span className="ml-auto text-[10px] text-[var(--cos-text-muted)] uppercase">
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
