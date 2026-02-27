// ============================================================================
// OpenOrbit — Title Bar (custom window chrome)
//
// Replaces the native title bar. Features:
// - Draggable region for window movement
// - macOS: space reserved for traffic lights (left side)
// - Windows/Linux: custom minimize/maximize/close buttons (right side)
// - Centered command palette trigger (search bar)
// ============================================================================

import { useCallback } from 'react'

const platform = window.electron.process.platform
const isMac = platform === 'darwin'

// ---------------------------------------------------------------------------
// Window Controls (Windows / Linux only)
// ---------------------------------------------------------------------------

function WindowControls(): React.JSX.Element {
  const minimize = useCallback(() => window.api.send('window:minimize'), [])
  const maximize = useCallback(() => window.api.send('window:maximize'), [])
  const close = useCallback(() => window.api.send('window:close'), [])

  return (
    <div className="flex items-center h-full title-bar-no-drag">
      <button
        onClick={minimize}
        className="w-[46px] h-full flex items-center justify-center hover:bg-[var(--cos-bg-hover)] transition-colors"
        aria-label="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={maximize}
        className="w-[46px] h-full flex items-center justify-center hover:bg-[var(--cos-bg-hover)] transition-colors"
        aria-label="Maximize"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        onClick={close}
        className="w-[46px] h-full flex items-center justify-center hover:bg-red-600/80 transition-colors"
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Title Bar
// ---------------------------------------------------------------------------

interface TitleBarProps {
  onCommandPaletteOpen: () => void
}

export default function TitleBar({ onCommandPaletteOpen }: TitleBarProps): React.JSX.Element {
  return (
    <div className="flex items-center h-[38px] flex-shrink-0 border-b border-[var(--cos-border)] bg-[var(--cos-bg-primary)] text-[var(--cos-text-secondary)] select-none">
      {/* Left region: traffic light spacer on macOS, minimal padding otherwise */}
      <div className={isMac ? 'w-[78px] flex-shrink-0' : 'w-3 flex-shrink-0'} />

      {/* Center: draggable area + command palette trigger */}
      <div className="flex-1 flex items-center justify-center title-bar-drag">
        <button
          onClick={onCommandPaletteOpen}
          className="title-bar-no-drag flex items-center gap-2 px-3 py-1 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:bg-[var(--cos-bg-hover)] hover:border-[var(--cos-border-light)] transition-colors cursor-pointer min-w-[240px] max-w-[480px] w-[40%]"
        >
          <svg
            width="14"
            height="14"
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
          <span className="text-xs text-[var(--cos-text-muted)] truncate">
            Search or run a command...
          </span>
          <kbd className="ml-auto text-[10px] text-[var(--cos-text-muted)] bg-[var(--cos-bg-primary)] px-1.5 py-0.5 rounded border border-[var(--cos-border)] flex-shrink-0">
            {isMac ? '\u2318K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>

      {/* Right region: window controls on Windows/Linux, spacer on macOS */}
      {isMac ? <div className="w-3 flex-shrink-0" /> : <WindowControls />}
    </div>
  )
}
