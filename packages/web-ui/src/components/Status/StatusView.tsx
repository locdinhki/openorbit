import { useEffect } from 'react'
import { useStore } from '../../store'
import type { AutomationStatus, RPCResult } from '../../lib/types'

export default function StatusView(): React.JSX.Element {
  const { automationStatus, rpcClient, setAutomationStatus, disconnect } = useStore()

  useEffect(() => {
    if (!rpcClient) return
    rpcClient
      .call<AutomationStatus>('automation.status')
      .then((status) => setAutomationStatus(status))
      .catch(() => {})
  }, [rpcClient]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStart = (): void => {
    rpcClient
      ?.call<RPCResult>('automation.start', {})
      .then(() => {
        rpcClient
          ?.call<AutomationStatus>('automation.status')
          .then((s) => setAutomationStatus(s))
          .catch(() => {})
      })
      .catch(() => {})
  }

  const handleStop = (): void => {
    rpcClient
      ?.call<RPCResult>('automation.stop', {})
      .then(() => setAutomationStatus({ ...automationStatus!, running: false }))
      .catch(() => {})
  }

  const handlePause = (): void => {
    rpcClient
      ?.call<RPCResult>('automation.pause', {})
      .then(() => {
        if (automationStatus) {
          setAutomationStatus({ ...automationStatus, paused: !automationStatus.paused })
        }
      })
      .catch(() => {})
  }

  const isRunning = automationStatus?.running ?? false
  const isPaused = automationStatus?.paused ?? false

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--cos-border)',
          background: 'var(--cos-bg-secondary)'
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--cos-text-primary)' }}>
          Automation
        </h2>
      </div>

      <div className="p-4 space-y-4">
        <div
          className="p-4 rounded-xl"
          style={{
            background: 'var(--cos-bg-secondary)',
            border: '1px solid var(--cos-border)'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className={`w-2.5 h-2.5 rounded-full ${isRunning && !isPaused ? 'animate-pulse' : ''}`}
              style={{
                background: isRunning
                  ? isPaused
                    ? 'var(--cos-warning)'
                    : 'var(--cos-success)'
                  : 'var(--cos-text-muted)'
              }}
            />
            <span className="text-sm" style={{ color: 'var(--cos-text-primary)' }}>
              {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Stopped'}
            </span>
          </div>

          {isRunning && (
            <div className="text-xs space-y-1 mb-3" style={{ color: 'var(--cos-text-muted)' }}>
              {automationStatus?.currentPlatform && (
                <p>Platform: {automationStatus.currentPlatform}</p>
              )}
              {automationStatus?.currentStep && <p>Step: {automationStatus.currentStep}</p>}
              <p>
                Found: {automationStatus?.jobsFound ?? 0} | Applied:{' '}
                {automationStatus?.jobsApplied ?? 0}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="flex-1 py-2.5 text-sm font-medium text-white rounded-lg cursor-pointer transition-colors"
                style={{ background: 'var(--cos-success)' }}
              >
                Start
              </button>
            ) : (
              <>
                <button
                  onClick={handlePause}
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: 'var(--cos-warning)'
                  }}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
                <button
                  onClick={handleStop}
                  className="flex-1 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: 'var(--cos-error)'
                  }}
                >
                  Stop
                </button>
              </>
            )}
          </div>
        </div>

        <button
          onClick={disconnect}
          className="w-full py-2.5 text-sm rounded-lg cursor-pointer transition-colors"
          style={{
            background: 'var(--cos-bg-tertiary)',
            color: 'var(--cos-text-secondary)',
            border: '1px solid var(--cos-border)'
          }}
        >
          Disconnect
        </button>
      </div>
    </div>
  )
}
