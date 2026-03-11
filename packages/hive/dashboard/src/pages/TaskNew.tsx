import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api, type Device } from '../lib/api'

const INSTRUCTION_TYPES = ['exec', 'read', 'write', 'http'] as const
type InstructionType = (typeof INSTRUCTION_TYPES)[number]

export default function TaskNew() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [devices, setDevices] = useState<Device[]>([])
  const [targetDevice, setTargetDevice] = useState(searchParams.get('device') ?? '')
  const [instrType, setInstrType] = useState<InstructionType>('exec')
  const [priority, setPriority] = useState('normal')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Exec fields
  const [command, setCommand] = useState('')
  const [cwd, setCwd] = useState('')
  const [timeout, setTimeout] = useState('60000')

  // Read fields
  const [readPath, setReadPath] = useState('')

  // Write fields
  const [writePath, setWritePath] = useState('')
  const [writeContent, setWriteContent] = useState('')

  // HTTP fields
  const [httpMethod, setHttpMethod] = useState('GET')
  const [httpUrl, setHttpUrl] = useState('')
  const [httpBody, setHttpBody] = useState('')

  useEffect(() => {
    api
      .listDevices()
      .then(setDevices)
      .catch(() => {})
  }, [])

  function buildInstruction(): Record<string, unknown> {
    switch (instrType) {
      case 'exec':
        return {
          type: 'exec',
          command,
          ...(cwd ? { cwd } : {}),
          timeout: parseInt(timeout) || 60000
        }
      case 'read':
        return { type: 'read', path: readPath }
      case 'write':
        return { type: 'write', path: writePath, content: writeContent }
      case 'http':
        return {
          type: 'http',
          method: httpMethod,
          url: httpUrl,
          ...(httpBody ? { body: httpBody } : {})
        }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!targetDevice) {
      setError('Select a target device')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const task = await api.createTask({
        targetDevice,
        instruction: buildInstruction(),
        priority
      })
      navigate(`/tasks/${task.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dispatch task')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">Dispatch Task</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Device */}
        <Field label="Target Device">
          <select
            value={targetDevice}
            onChange={(e) => setTargetDevice(e.target.value)}
            className="input"
          >
            <option value="">Select device...</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.status})
              </option>
            ))}
          </select>
        </Field>

        {/* Instruction type */}
        <Field label="Instruction Type">
          <select
            value={instrType}
            onChange={(e) => setInstrType(e.target.value as InstructionType)}
            className="input"
          >
            {INSTRUCTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {/* Dynamic fields */}
        {instrType === 'exec' && (
          <>
            <Field label="Command">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="e.g. df -h"
                className="input"
                required
              />
            </Field>
            <Field label="Working Directory (optional)">
              <input
                value={cwd}
                onChange={(e) => setCwd(e.target.value)}
                placeholder="/home/pi"
                className="input"
              />
            </Field>
            <Field label="Timeout (ms)">
              <input
                type="number"
                value={timeout}
                onChange={(e) => setTimeout(e.target.value)}
                className="input"
              />
            </Field>
          </>
        )}

        {instrType === 'read' && (
          <Field label="File Path">
            <input
              value={readPath}
              onChange={(e) => setReadPath(e.target.value)}
              placeholder="/etc/hostname"
              className="input"
              required
            />
          </Field>
        )}

        {instrType === 'write' && (
          <>
            <Field label="File Path">
              <input
                value={writePath}
                onChange={(e) => setWritePath(e.target.value)}
                placeholder="/tmp/test.txt"
                className="input"
                required
              />
            </Field>
            <Field label="Content">
              <textarea
                value={writeContent}
                onChange={(e) => setWriteContent(e.target.value)}
                rows={4}
                className="input"
                required
              />
            </Field>
          </>
        )}

        {instrType === 'http' && (
          <>
            <Field label="Method">
              <select
                value={httpMethod}
                onChange={(e) => setHttpMethod(e.target.value)}
                className="input"
              >
                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="URL">
              <input
                value={httpUrl}
                onChange={(e) => setHttpUrl(e.target.value)}
                placeholder="https://api.example.com/data"
                className="input"
                required
              />
            </Field>
            <Field label="Body (optional)">
              <textarea
                value={httpBody}
                onChange={(e) => setHttpBody(e.target.value)}
                rows={3}
                className="input"
                placeholder='{"key": "value"}'
              />
            </Field>
          </>
        )}

        {/* Priority */}
        <Field label="Priority">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input">
            {['low', 'normal', 'high', 'critical'].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Dispatching...' : 'Dispatch'}
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
