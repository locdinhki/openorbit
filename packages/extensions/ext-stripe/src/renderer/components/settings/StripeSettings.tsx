import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import Button from '@renderer/components/shared/Button'

export default function StripeSettings(): React.JSX.Element {
  const [secretKey, setSecretKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [hasSecretKey, setHasSecretKey] = useState(false)
  const [secretKeyPreview, setSecretKeyPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const loadSettings = async (): Promise<void> => {
    const result = await ipc.settings.get()
    if (result.success && result.data) {
      setHasSecretKey(result.data.hasSecretKey)
      setSecretKeyPreview(result.data.secretKeyPreview)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSettings()
  }, [])

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const data: { secretKey?: string; webhookSecret?: string } = {}
    if (secretKey) data.secretKey = secretKey
    if (webhookSecret) data.webhookSecret = webhookSecret

    const result = await ipc.settings.set(data)
    if (result.success) {
      setSecretKey('')
      setWebhookSecret('')
      await loadSettings()
    }
    setSaving(false)
  }

  const handleTest = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    const result = await ipc.settings.testConnection()
    if (result.success && result.data) {
      setTestResult({
        success: true,
        message: `Connected! ${result.data.liveMode ? 'Live' : 'Test'} mode. Balance: $${(result.data.availableBalance / 100).toFixed(2)}`
      })
    } else {
      setTestResult({
        success: false,
        message: result.error || 'Connection failed'
      })
    }
    setTesting(false)
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
          Secret Key
        </label>
        {hasSecretKey && secretKeyPreview && (
          <p className="text-xs text-green-400 mb-1">Current: {secretKeyPreview}</p>
        )}
        <input
          type="password"
          value={secretKey}
          onChange={(e) => setSecretKey(e.target.value)}
          placeholder={hasSecretKey ? 'Enter new key to replace' : 'sk_live_xxx or sk_test_xxx'}
          className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
        <p className="text-xs text-[var(--cos-text-muted)] mt-1">
          Find this in Stripe Dashboard &rarr; Developers &rarr; API keys
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
          Webhook Secret (Optional)
        </label>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder="whsec_xxx"
          className="w-full px-2 py-1.5 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={saving || (!secretKey && !webhookSecret)}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {hasSecretKey && (
          <Button size="sm" variant="ghost" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </Button>
        )}
      </div>

      {testResult && (
        <div
          className={`p-2 rounded text-xs ${
            testResult.success
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {testResult.message}
        </div>
      )}
    </div>
  )
}
