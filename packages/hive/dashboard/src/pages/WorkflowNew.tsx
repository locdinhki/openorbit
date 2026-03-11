import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, type Device, type WorkflowStep } from '../lib/api'

type InstructionType = 'exec' | 'read' | 'write' | 'http'

const EMPTY_STEP: WorkflowStep = {
  name: '',
  deviceId: '',
  instruction: { type: 'exec', command: '' }
}

export default function WorkflowNew() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<WorkflowStep[]>([{ ...EMPTY_STEP }])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .listDevices()
      .then(setDevices)
      .catch(() => {})
  }, [])

  function updateStep(index: number, update: Partial<WorkflowStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)))
  }

  function updateInstructionField(index: number, key: string, value: string) {
    setSteps((prev) =>
      prev.map((s, i) =>
        i === index ? { ...s, instruction: { ...s.instruction, [key]: value } } : s
      )
    )
  }

  function changeInstructionType(index: number, type: InstructionType) {
    const baseInstruction: Record<string, string> = { type }
    if (type === 'exec') baseInstruction.command = ''
    if (type === 'read') baseInstruction.path = ''
    if (type === 'write') {
      baseInstruction.path = ''
      baseInstruction.content = ''
    }
    if (type === 'http') {
      baseInstruction.method = 'GET'
      baseInstruction.url = ''
    }
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, instruction: baseInstruction } : s))
    )
  }

  function addStep() {
    setSteps((prev) => [...prev, { ...EMPTY_STEP }])
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Workflow name required')
      return
    }
    for (const [i, step] of steps.entries()) {
      if (!step.name.trim()) {
        setError(`Step ${i + 1}: name required`)
        return
      }
      if (!step.deviceId) {
        setError(`Step ${i + 1}: device required`)
        return
      }
    }

    setSaving(true)
    try {
      await api.createWorkflow({
        name: name.trim(),
        description: description.trim() || undefined,
        steps
      })
      navigate('/workflows')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-lg font-semibold">New Workflow</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Workflow metadata */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Workflow Name</label>
            <input
              className="input w-full"
              placeholder="e.g. Deploy + verify"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Description (optional)</label>
            <input
              className="input w-full"
              placeholder="What does this workflow do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Steps</h2>
            <button
              type="button"
              onClick={addStep}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              + Add step
            </button>
          </div>

          {steps.map((step, i) => {
            const itype = (step.instruction.type as InstructionType) ?? 'exec'
            return (
              <div key={i} className="border border-gray-700 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Step {i + 1}</span>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Step Name</label>
                    <input
                      className="input w-full"
                      placeholder="e.g. Pull latest code"
                      value={step.name}
                      onChange={(e) => updateStep(i, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Device</label>
                    <select
                      className="input w-full"
                      value={step.deviceId}
                      onChange={(e) => updateStep(i, { deviceId: e.target.value })}
                    >
                      <option value="">Select device…</option>
                      {devices.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Instruction Type</label>
                  <select
                    className="input w-48"
                    value={itype}
                    onChange={(e) => changeInstructionType(i, e.target.value as InstructionType)}
                  >
                    <option value="exec">exec — shell command</option>
                    <option value="read">read — read file</option>
                    <option value="write">write — write file</option>
                    <option value="http">http — HTTP request</option>
                  </select>
                </div>

                {itype === 'exec' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Command</label>
                    <input
                      className="input w-full font-mono text-xs"
                      placeholder="e.g. git pull && npm install"
                      value={String(step.instruction.command ?? '')}
                      onChange={(e) => updateInstructionField(i, 'command', e.target.value)}
                    />
                  </div>
                )}
                {(itype === 'read' || itype === 'write') && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">File Path</label>
                    <input
                      className="input w-full font-mono text-xs"
                      placeholder="/absolute/path/to/file"
                      value={String(step.instruction.path ?? '')}
                      onChange={(e) => updateInstructionField(i, 'path', e.target.value)}
                    />
                  </div>
                )}
                {itype === 'write' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Content</label>
                    <textarea
                      className="input w-full font-mono text-xs resize-y"
                      rows={3}
                      placeholder="File content (supports ${VAR} substitution)"
                      value={String(step.instruction.content ?? '')}
                      onChange={(e) => updateInstructionField(i, 'content', e.target.value)}
                    />
                  </div>
                )}
                {itype === 'http' && (
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Method</label>
                      <select
                        className="input w-full"
                        value={String(step.instruction.method ?? 'GET')}
                        onChange={(e) => updateInstructionField(i, 'method', e.target.value)}
                      >
                        {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">URL</label>
                      <input
                        className="input w-full font-mono text-xs"
                        placeholder="https://..."
                        value={String(step.instruction.url ?? '')}
                        onChange={(e) => updateInstructionField(i, 'url', e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Pass stdout as variable (optional)
                    </label>
                    <input
                      className="input w-full font-mono text-xs"
                      placeholder="e.g. GIT_HASH"
                      value={step.passOutputAs ?? ''}
                      onChange={(e) => updateStep(i, { passOutputAs: e.target.value || undefined })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      On failure: jump to step # (blank = abort)
                    </label>
                    <input
                      className="input w-full"
                      type="number"
                      min={1}
                      max={steps.length}
                      placeholder="(abort run)"
                      value={
                        step.onFailure !== undefined && step.onFailure !== null
                          ? step.onFailure + 1
                          : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value ? parseInt(e.target.value, 10) - 1 : null
                        updateStep(i, { onFailure: v })
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Workflow'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/workflows')}
            className="px-4 py-2 bg-gray-800 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
