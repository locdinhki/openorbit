import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import Button from '@renderer/components/shared/Button'

export default function PlaidSettings(): React.JSX.Element {
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [environment, setEnvironment] = useState<'sandbox' | 'development' | 'production'>(
    'sandbox'
  )
  const [hasCredentials, setHasCredentials] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadSettings = async (): Promise<void> => {
    const result = await ipc.settings.get()
    if (result.success && result.data) {
      setHasCredentials(result.data.hasCredentials)
      setEnvironment(result.data.environment as 'sandbox' | 'development' | 'production')
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
  }, [])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const data: {
      clientId?: string
      secret?: string
      environment?: 'sandbox' | 'development' | 'production'
    } = { environment }

    if (clientId) data.clientId = clientId
    if (secret) data.secret = secret

    const result = await ipc.settings.set(data)
    if (result.success) {
      setClientId('')
      setSecret('')
      await loadSettings()
    }
    setSaving(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
          Client ID
        </label>
        {hasCredentials && <p className="text-xs text-green-400 mb-1">Credentials configured</p>}
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={hasCredentials ? 'Enter new ID to replace' : 'Enter Plaid Client ID'}
          className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
          Secret
        </label>
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={hasCredentials ? 'Enter new secret to replace' : 'Enter Plaid Secret'}
          className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
          Environment
        </label>
        <select
          value={environment}
          onChange={(e) =>
            setEnvironment(e.target.value as 'sandbox' | 'development' | 'production')
          }
          className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
        >
          <option value="sandbox">Sandbox (Testing)</option>
          <option value="development">Development</option>
          <option value="production">Production</option>
        </select>
        <p className="text-xs text-[var(--cos-text-muted)] mt-1">
          Use &quot;Sandbox&quot; for testing with fake data
        </p>
      </div>

      <Button
        size="sm"
        variant="primary"
        onClick={handleSave}
        disabled={saving || (!clientId && !secret && hasCredentials)}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>

      <div className="pt-2 border-t border-[var(--cos-border)]">
        <p className="text-xs text-[var(--cos-text-muted)]">
          Get your credentials from the{' '}
          <a
            href="https://dashboard.plaid.com/developers/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline"
          >
            Plaid Dashboard
          </a>
        </p>
      </div>
    </div>
  )
}
