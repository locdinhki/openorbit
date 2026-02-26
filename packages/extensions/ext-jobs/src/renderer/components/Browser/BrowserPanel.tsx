import { useState } from 'react'
import { useStore } from '../../store'
import Button from '@renderer/components/shared/Button'
import StatusIndicator from '@renderer/components/shared/StatusIndicator'

interface BrowserPanelProps {
  screenshotData: string | null
  onScreenshot: (data: string) => void
  onClearScreenshot: () => void
}

export default function BrowserPanel({
  screenshotData,
  onScreenshot,
  onClearScreenshot
}: BrowserPanelProps): React.JSX.Element {
  const { sessionInitialized, automationState, setSessionInitialized } = useStore()
  const [loading, setLoading] = useState(false)

  const handleInitSession = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = (await window.api.invoke('session:init')) as {
        success: boolean
        error?: string
      }
      if (result.success) {
        setSessionInitialized(true)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (platform: string): Promise<void> => {
    setLoading(true)
    try {
      await window.api.invoke('session:login', { platform })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSession = async (): Promise<void> => {
    await window.api.invoke('session:save')
  }

  const handleScreenshot = async (): Promise<void> => {
    const result = (await window.api.invoke('browser:screenshot')) as {
      success: boolean
      data?: string
    }
    if (result.success && result.data) {
      onScreenshot(result.data)
    }
  }

  if (!sessionInitialized) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-8">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Browser Not Connected</h2>
          <p className="text-sm text-[var(--cos-text-muted)] max-w-sm">
            Launch the browser to start automating. You&apos;ll need to log into job platforms
            manually on first use.
          </p>
        </div>

        <Button variant="primary" size="lg" onClick={handleInitSession} disabled={loading}>
          {loading ? 'Launching...' : 'Launch Browser'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Browser Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] flex-shrink-0">
        <StatusIndicator
          status={
            automationState === 'running'
              ? 'running'
              : sessionInitialized
                ? 'connected'
                : 'disconnected'
          }
          label={automationState === 'running' ? 'Automating' : 'Connected'}
        />

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => handleLogin('linkedin')}>
            LinkedIn
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleLogin('indeed')}>
            Indeed
          </Button>
          <Button size="sm" variant="ghost" onClick={handleSaveSession}>
            Save Session
          </Button>
          <Button size="sm" variant="ghost" onClick={handleScreenshot}>
            Screenshot
          </Button>
          {screenshotData && (
            <Button size="sm" variant="ghost" onClick={onClearScreenshot}>
              Close Preview
            </Button>
          )}
        </div>
      </div>

      {/* Screenshot View */}
      <div className="flex-1 flex items-center justify-center bg-[var(--cos-bg-primary)] overflow-hidden">
        {screenshotData ? (
          <img
            src={`data:image/png;base64,${screenshotData}`}
            alt="Browser screenshot"
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <div className="text-center px-6">
            <p className="text-sm text-[var(--cos-text-muted)]">
              Browser is running in a separate window.
            </p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Click &quot;Screenshot&quot; to preview what the bot sees.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
