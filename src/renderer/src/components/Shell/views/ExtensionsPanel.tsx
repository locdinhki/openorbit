// ============================================================================
// OpenOrbit — Extensions Panel (shell-level sidebar view)
// ============================================================================

import { useShellStore } from '../../../store/shell-store'

export default function ExtensionsPanel(): React.JSX.Element {
  const extensions = useShellStore((s) => s.extensions)

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Extensions
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {extensions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--cos-text-muted)]">No extensions installed</p>
          </div>
        ) : (
          <div className="space-y-2">
            {extensions.map((ext) => (
              <div
                key={ext.id}
                className="flex items-center gap-3 p-2.5 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
                    {ext.displayName}
                  </p>
                  <p className="text-xs text-[var(--cos-text-muted)]">{ext.id}</p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30">
                  Active
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
