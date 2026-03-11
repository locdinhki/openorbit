import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Device } from '../lib/api'

const CRON_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' }
]

export default function ScheduleNew() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [name, setName] = useState('')
  const [cronExpression, setCronExpression] = useState('0 * * * *')
  const [instrType, setInstrType] = useState('exec')
  const [command, setCommand] = useState('')
  const [path, setPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .listDevices()
      .then(setDevices)
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!deviceId || !name || !cronExpression) {
      setError('All fields required')
      return
    }

    let instruction: Record<string, unknown>
    if (instrType === 'exec') {
      if (!command) {
        setError('Command required')
        return
      }
      instruction = { type: 'exec', command }
    } else {
      if (!path) {
        setError('Path required')
        return
      }
      instruction = { type: 'read', path }
    }

    setSubmitting(true)
    setError('')

    try {
      await api.createSchedule({ deviceId, name, instruction, cronExpression })
      navigate('/schedules')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">New Schedule</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Disk check"
            className="input"
            required
          />
        </Field>

        <Field label="Device">
          <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="input">
            <option value="">Select device...</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.status})
              </option>
            ))}
          </select>
        </Field>

        <Field label="Cron Expression">
          <input
            value={cronExpression}
            onChange={(e) => setCronExpression(e.target.value)}
            placeholder="*/5 * * * *"
            className="input font-mono"
            required
          />
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setCronExpression(p.value)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  cronExpression === p.value
                    ? 'border-gray-500 text-gray-300'
                    : 'border-gray-800 text-gray-500 hover:border-gray-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Instruction Type">
          <select
            value={instrType}
            onChange={(e) => setInstrType(e.target.value)}
            className="input"
          >
            <option value="exec">exec</option>
            <option value="read">read</option>
          </select>
        </Field>

        {instrType === 'exec' && (
          <Field label="Command">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="df -h"
              className="input"
              required
            />
          </Field>
        )}

        {instrType === 'read' && (
          <Field label="File Path">
            <input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/proc/uptime"
              className="input"
              required
            />
          </Field>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating...' : 'Create Schedule'}
        </button>
      </form>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  )
}
