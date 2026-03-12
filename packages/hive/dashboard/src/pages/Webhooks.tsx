import { useEffect, useState } from 'react'
import {
  api,
  type WebhookDef,
  type WebhookCallEntry,
  type Workflow,
  type TaskTemplate
} from '../lib/api'
import { relativeTime } from '../lib/time'

export default function Webhooks() {
  const [webhooks, setWebhooks] = useState<WebhookDef[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [calls, setCalls] = useState<WebhookCallEntry[]>([])

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [action, setAction] = useState<'workflow' | 'template'>('workflow')
  const [actionId, setActionId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api
      .listWebhooks()
      .then(setWebhooks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function loadCreateData() {
    const [wfs, tpls] = await Promise.all([api.listWorkflows(), api.listTemplates()])
    setWorkflows(wfs)
    setTemplates(tpls)
    setShowCreate(true)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !actionId) return
    setCreating(true)
    try {
      await api.createWebhook({
        name,
        action,
        actionId,
        deviceId: deviceId || undefined
      })
      setShowCreate(false)
      setName('')
      setActionId('')
      setDeviceId('')
      setWebhooks(await api.listWebhooks())
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this webhook?')) return
    await api.deleteWebhook(id)
    setWebhooks(await api.listWebhooks())
  }

  async function toggleHistory(id: string) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    const data = await api.listWebhookCalls(id)
    setCalls(data)
    setExpanded(id)
  }

  function getWebhookUrl(token: string): string {
    return `${window.location.origin}/webhooks/${token}`
  }

  function copyUrl(token: string) {
    navigator.clipboard.writeText(getWebhookUrl(token))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Webhooks</h1>
        <button
          onClick={loadCreateData}
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Webhook
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Action Type</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value as 'workflow' | 'template')
                setActionId('')
              }}
              className="input"
            >
              <option value="workflow">Run Workflow</option>
              <option value="template">Run Template</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Target</label>
            <select
              value={actionId}
              onChange={(e) => setActionId(e.target.value)}
              className="input w-full"
              required
            >
              <option value="">Select...</option>
              {action === 'workflow'
                ? workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))
                : templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creating}
              className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-800/50 rounded" />
          ))}
        </div>
      ) : webhooks.length === 0 ? (
        <p className="text-sm text-gray-500">No webhooks configured</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{wh.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {wh.action} · {relativeTime(wh.createdAt)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 font-mono truncate max-w-md">
                    {getWebhookUrl(wh.token)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => copyUrl(wh.token)}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-xs text-gray-300 rounded transition-colors"
                  >
                    Copy URL
                  </button>
                  <button
                    onClick={() => toggleHistory(wh.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {expanded === wh.id ? 'Hide' : 'History'}
                  </button>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Invocation history */}
              {expanded === wh.id && (
                <div className="mt-3 border-t border-gray-800 pt-3">
                  {calls.length === 0 ? (
                    <p className="text-xs text-gray-600">No invocations yet</p>
                  ) : (
                    <div className="space-y-1">
                      {calls.slice(0, 10).map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between text-xs text-gray-400"
                        >
                          <span>{relativeTime(c.calledAt)}</span>
                          <span className="font-mono text-gray-600">
                            {c.resultId ? c.resultId.slice(0, 8) : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
