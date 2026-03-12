import { useEffect, useState } from 'react'
import { api, type TriggerDef, type TriggerRunEntry } from '../lib/api'
import { relativeTime } from '../lib/time'

const CONDITIONS = [
  { value: 'alert.fired', label: 'Alert Fired' },
  { value: 'alert.resolved', label: 'Alert Resolved' },
  { value: 'device.online', label: 'Device Online' },
  { value: 'device.offline', label: 'Device Offline' },
  { value: 'metric.threshold', label: 'Metric Threshold' }
]

const ACTIONS = [
  { value: 'run_workflow', label: 'Run Workflow' },
  { value: 'run_template', label: 'Run Template' },
  { value: 'exec_command', label: 'Execute Command' },
  { value: 'send_telegram', label: 'Send Telegram' }
]

export default function Triggers() {
  const [triggers, setTriggers] = useState<TriggerDef[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [runs, setRuns] = useState<TriggerRunEntry[]>([])

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [condition, setCondition] = useState('alert.fired')
  const [conditionParams, setConditionParams] = useState('{}')
  const [action, setAction] = useState('run_workflow')
  const [actionParams, setActionParams] = useState('{}')
  const [cooldownS, setCooldownS] = useState('300')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listTriggers()
      .then(setTriggers)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    let cp: Record<string, unknown>
    let ap: Record<string, unknown>
    try {
      cp = JSON.parse(conditionParams)
      ap = JSON.parse(actionParams)
    } catch {
      setError('Invalid JSON in params')
      return
    }
    setCreating(true)
    try {
      await api.createTrigger({
        name,
        condition,
        conditionParams: cp,
        action,
        actionParams: ap,
        cooldownS: parseInt(cooldownS) || 300
      })
      setShowCreate(false)
      setName('')
      setConditionParams('{}')
      setActionParams('{}')
      setTriggers(await api.listTriggers())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function handleToggle(id: string, enabled: boolean) {
    await api.updateTrigger(id, { enabled: !enabled })
    setTriggers(await api.listTriggers())
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this trigger?')) return
    await api.deleteTrigger(id)
    setTriggers(await api.listTriggers())
  }

  async function toggleRuns(id: string) {
    if (expanded === id) {
      setExpanded(null)
      return
    }
    const data = await api.listTriggerRuns(id)
    setRuns(data)
    setExpanded(id)
  }

  function conditionLabel(c: string) {
    return CONDITIONS.find((x) => x.value === c)?.label ?? c
  }

  function actionLabel(a: string) {
    return ACTIONS.find((x) => x.value === a)?.label ?? a
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Triggers</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-1.5 bg-white text-black text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
        >
          New Trigger
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Condition</label>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="input w-full"
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="input w-full"
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Condition Params (JSON)</label>
            <textarea
              value={conditionParams}
              onChange={(e) => setConditionParams(e.target.value)}
              rows={2}
              className="input w-full font-mono text-xs"
              placeholder='{"ruleId": "...", "deviceId": "..."}'
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Action Params (JSON)</label>
            <textarea
              value={actionParams}
              onChange={(e) => setActionParams(e.target.value)}
              rows={2}
              className="input w-full font-mono text-xs"
              placeholder='{"workflowId": "...", "deviceId": "..."}'
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Cooldown (seconds)</label>
            <input
              type="number"
              value={cooldownS}
              onChange={(e) => setCooldownS(e.target.value)}
              className="input w-32"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
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
      ) : triggers.length === 0 ? (
        <p className="text-sm text-gray-500">No triggers configured</p>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <div key={trigger.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white">{trigger.name}</p>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        trigger.enabled
                          ? 'bg-green-900/50 text-green-400'
                          : 'bg-gray-800 text-gray-500'
                      }`}
                    >
                      {trigger.enabled ? 'enabled' : 'disabled'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {conditionLabel(trigger.condition)} → {actionLabel(trigger.action)}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    Cooldown: {trigger.cooldownS}s
                    {trigger.lastFiredAt && ` · Last fired: ${relativeTime(trigger.lastFiredAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(trigger.id, trigger.enabled)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      trigger.enabled
                        ? 'bg-yellow-800 hover:bg-yellow-700 text-yellow-200'
                        : 'bg-green-800 hover:bg-green-700 text-green-200'
                    }`}
                  >
                    {trigger.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    onClick={() => toggleRuns(trigger.id)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {expanded === trigger.id ? 'Hide' : 'History'}
                  </button>
                  <button
                    onClick={() => handleDelete(trigger.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Fire history */}
              {expanded === trigger.id && (
                <div className="mt-3 border-t border-gray-800 pt-3">
                  {runs.length === 0 ? (
                    <p className="text-xs text-gray-600">No fire history</p>
                  ) : (
                    <div className="space-y-1">
                      {runs.slice(0, 10).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs text-gray-400"
                        >
                          <span>{relativeTime(r.firedAt)}</span>
                          <span className="font-mono text-gray-600">
                            {r.resultId ? r.resultId.slice(0, 8) : '—'}
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
