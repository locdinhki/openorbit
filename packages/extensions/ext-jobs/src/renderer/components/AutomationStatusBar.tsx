import { useState } from 'react'
import { useStore } from '../store'
import { useAutomation } from '../hooks/useAutomation'
import StatusIndicator from '@renderer/components/shared/StatusIndicator'

export default function StatusBar(): React.JSX.Element {
  const { automationState, currentAction, jobsExtracted, applicationsSubmitted, actionsPerMinute, jobs } = useStore()
  const { startExtraction, stopExtraction, sessionInitialized, platforms } = useAutomation()
  const [loading, setLoading] = useState(false)

  const queueCount = jobs.filter((j) => j.status === 'approved').length
  const isRunning = automationState === 'running'
  const isPaused = automationState === 'paused'

  const handleToggle = async (): Promise<void> => {
    setLoading(true)
    try {
      if (isRunning || isPaused) {
        await stopExtraction()
      } else {
        await startExtraction()
      }
    } finally {
      setLoading(false)
    }
  }

  // Per-platform action summary when multiple platforms are active
  const activePlatforms = platforms.filter((p) => p.state === 'running' || p.state === 'paused')
  const platformActionText =
    activePlatforms.length > 1
      ? activePlatforms
          .filter((p) => p.currentAction)
          .map((p) => `${p.platform.charAt(0).toUpperCase() + p.platform.slice(1)}: ${p.currentAction}`)
          .join('  |  ')
      : null

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] text-xs">
      {/* Left: Session Status + Start/Stop */}
      <div className="flex items-center gap-4 min-w-0">
        <StatusIndicator
          status={
            automationState === 'running'
              ? 'running'
              : automationState === 'paused'
                ? 'paused'
                : automationState === 'error'
                  ? 'error'
                  : sessionInitialized
                    ? 'connected'
                    : 'disconnected'
          }
          label={
            automationState === 'running'
              ? 'Running'
              : automationState === 'paused'
                ? 'Paused'
                : automationState === 'error'
                  ? 'Error'
                  : sessionInitialized
                    ? 'Ready'
                    : 'Disconnected'
          }
        />

        <button
          onClick={handleToggle}
          disabled={loading}
          className={`px-3 py-0.5 rounded font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 ${
            isRunning || isPaused
              ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30'
              : 'bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30'
          }`}
        >
          {loading ? '...' : isRunning || isPaused ? 'Stop' : 'Start'}
        </button>

        {(platformActionText || currentAction) && (
          <span className="text-[var(--cos-text-muted)] truncate min-w-0 flex-1">
            {platformActionText ?? currentAction}
          </span>
        )}
      </div>

      {/* Right: Stats (only shown while automation is running) */}
      {automationState === 'running' && (
        <div className="flex items-center gap-4 text-[var(--cos-text-muted)] flex-shrink-0">
          <span>Extracted: {jobsExtracted}</span>
          <span>Applied: {applicationsSubmitted}</span>
          <span>Queue: {queueCount}</span>
          <span>{actionsPerMinute} actions/min</span>
        </div>
      )}
    </div>
  )
}
