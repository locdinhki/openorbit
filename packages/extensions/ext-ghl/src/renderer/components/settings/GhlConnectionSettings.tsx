import { useState, useEffect } from 'react'
import { useExtGhlStore } from '../../store/index'
import Button from '@renderer/components/shared/Button'
import Badge from '@renderer/components/shared/Badge'

export default function GhlConnectionSettings(): React.JSX.Element {
  const hasToken = useExtGhlStore((s) => s.hasToken)
  const maskedToken = useExtGhlStore((s) => s.maskedToken)
  const locationId = useExtGhlStore((s) => s.locationId)
  const loadSettings = useExtGhlStore((s) => s.loadSettings)
  const saveSettings = useExtGhlStore((s) => s.saveSettings)
  const testConnection = useExtGhlStore((s) => s.testConnection)
  const connectionTesting = useExtGhlStore((s) => s.connectionTesting)
  const connectionResult = useExtGhlStore((s) => s.connectionResult)

  const [tokenInput, setTokenInput] = useState('')
  const [locationInput, setLocationInput] = useState('')
  const [locationSynced, setLocationSynced] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Sync locationInput once from store after settings load
  if (!locationSynced && locationId != null) {
    setLocationSynced(true)
    setLocationInput(locationId)
  }

  const handleSave = async (): Promise<void> => {
    const data: { token?: string; locationId?: string } = {}
    if (tokenInput.trim()) data.token = tokenInput.trim()
    if (locationInput.trim()) data.locationId = locationInput.trim()
    await saveSettings(data)
    setTokenInput('')
  }

  return (
    <div className="px-3 py-3 space-y-4 flex-1 overflow-y-auto">
      {/* Status */}
      <div className="flex items-center gap-2">
        <Badge variant={hasToken ? 'success' : 'warning'}>
          {hasToken ? 'Connected' : 'Not Configured'}
        </Badge>
        {maskedToken && (
          <span className="text-[10px] text-[var(--cos-text-muted)]">{maskedToken}</span>
        )}
      </div>

      {/* API Token */}
      <div>
        <label className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider block mb-1">
          API Token (Private Integration)
        </label>
        <input
          type="password"
          placeholder={hasToken ? '••••••••' : 'pit-xxxxxxxx...'}
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Location ID */}
      <div>
        <label className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider block mb-1">
          Location ID
        </label>
        <input
          type="text"
          placeholder="Location ID"
          value={locationInput}
          onChange={(e) => setLocationInput(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="primary" onClick={handleSave}>
          Save
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={testConnection}
          disabled={connectionTesting || !hasToken}
        >
          {connectionTesting ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>

      {/* Test Result */}
      {connectionResult && (
        <div className="bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded p-3">
          {connectionResult.connected ? (
            <div className="text-xs text-green-400">
              Connected — {connectionResult.contactCount} contacts found
            </div>
          ) : (
            <div className="text-xs text-red-400">Connection failed</div>
          )}
        </div>
      )}
    </div>
  )
}
