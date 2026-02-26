import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { ipc } from '@renderer/lib/ipc-client'
import Button from '@renderer/components/shared/Button'

export default function APIKeys(): React.JSX.Element {
  const { apiKeys, setApiKeys } = useStore()
  const [newKey, setNewKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadKeys(): Promise<void> {
      const result = await ipc.settings.get('anthropic_api_keys')
      if (result.success && result.data) {
        try {
          const keys = JSON.parse(result.data) as string[]
          setApiKeys(keys)
        } catch {
          // Fallback to single key
          const singleResult = await ipc.settings.get('anthropic_api_key')
          if (singleResult.success && singleResult.data) {
            setApiKeys([singleResult.data])
          }
        }
      } else {
        const singleResult = await ipc.settings.get('anthropic_api_key')
        if (singleResult.success && singleResult.data) {
          setApiKeys([singleResult.data])
        }
      }
    }
    loadKeys()
  }, [])

  const saveKeys = async (keys: string[]): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      await ipc.settings.update('anthropic_api_keys', JSON.stringify(keys))
      if (keys.length > 0) {
        await ipc.settings.update('anthropic_api_key', keys[0])
      }
      setApiKeys(keys)
    } catch {
      setError('Failed to save API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = (): void => {
    const trimmed = newKey.trim()
    if (!trimmed) return
    if (!trimmed.startsWith('sk-ant-')) {
      setError('API key must start with sk-ant-')
      return
    }
    if (apiKeys.includes(trimmed)) {
      setError('This key is already added')
      return
    }
    setError(null)
    const updated = [...apiKeys, trimmed]
    setNewKey('')
    saveKeys(updated)
  }

  const handleRemove = (index: number): void => {
    const updated = apiKeys.filter((_, i) => i !== index)
    saveKeys(updated)
  }

  const maskKey = (key: string): string => {
    if (key.length <= 8) return '****'
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">
          Anthropic API Keys
        </h3>
        <p className="text-xs text-[var(--cos-text-muted)]">
          Add multiple keys for rotation. The system round-robins between them on rate limits.
        </p>
      </div>

      {apiKeys.length > 0 ? (
        <div className="space-y-2">
          {apiKeys.map((key, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2.5 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-[var(--cos-text-secondary)] truncate">
                  {maskKey(key)}
                </span>
                {index === 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-400 font-medium">
                    Primary
                  </span>
                )}
              </div>
              <Button variant="danger" size="sm" onClick={() => handleRemove(index)}>
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 bg-[var(--cos-bg-tertiary)] rounded-md border border-[var(--cos-border)]">
          <p className="text-sm text-[var(--cos-text-muted)]">No API keys configured</p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-1">
            Add a key to enable Claude AI features
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="password"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="sk-ant-..."
          className="flex-1 px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleAdd}
          disabled={loading || !newKey.trim()}
        >
          Add Key
        </Button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
