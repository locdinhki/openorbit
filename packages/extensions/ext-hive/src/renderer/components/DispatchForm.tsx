// ============================================================================
// ext-hive — Dispatch Form
// ============================================================================

import { useExtHiveStore } from '../store/index'
import type { InstructionType } from '../../main/types'

const INSTRUCTION_TYPES: InstructionType[] = ['exec', 'read', 'write', 'http']

export default function DispatchForm(): React.JSX.Element {
  const devices = useExtHiveStore((s) => s.devices)
  const targetDevice = useExtHiveStore((s) => s.targetDevice)
  const setTargetDevice = useExtHiveStore((s) => s.setTargetDevice)
  const instructionType = useExtHiveStore((s) => s.instructionType)
  const setInstructionType = useExtHiveStore((s) => s.setInstructionType)
  const instructionFields = useExtHiveStore((s) => s.instructionFields)
  const setInstructionField = useExtHiveStore((s) => s.setInstructionField)
  const dispatching = useExtHiveStore((s) => s.dispatching)
  const dispatchError = useExtHiveStore((s) => s.dispatchError)
  const dispatchTask = useExtHiveStore((s) => s.dispatchTask)

  const onlineDevices = devices.filter((d) => d.status === 'online')

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    dispatchTask()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Device + Type selectors */}
      <div className="flex gap-2">
        <select
          value={targetDevice}
          onChange={(e) => setTargetDevice(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
        >
          <option value="">Select device...</option>
          {onlineDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.id})
            </option>
          ))}
          {/* Show offline devices too, but marked */}
          {devices
            .filter((d) => d.status !== 'online')
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id}) [offline]
              </option>
            ))}
        </select>

        <select
          value={instructionType}
          onChange={(e) => setInstructionType(e.target.value as InstructionType)}
          className="w-24 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
        >
          {INSTRUCTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Dynamic fields based on instruction type */}
      {instructionType === 'exec' && (
        <>
          <textarea
            placeholder="Command (e.g. uname -a)"
            value={instructionFields.command ?? ''}
            onChange={(e) => setInstructionField('command', e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 font-mono resize-y"
          />
          <input
            type="text"
            placeholder="Working directory (optional)"
            value={instructionFields.cwd ?? ''}
            onChange={(e) => setInstructionField('cwd', e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
          />
        </>
      )}

      {instructionType === 'read' && (
        <input
          type="text"
          placeholder="File path (e.g. /etc/hostname)"
          value={instructionFields.path ?? ''}
          onChange={(e) => setInstructionField('path', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
      )}

      {instructionType === 'write' && (
        <>
          <input
            type="text"
            placeholder="File path"
            value={instructionFields.path ?? ''}
            onChange={(e) => setInstructionField('path', e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
          />
          <textarea
            placeholder="File content"
            value={instructionFields.content ?? ''}
            onChange={(e) => setInstructionField('content', e.target.value)}
            rows={4}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 font-mono resize-y"
          />
        </>
      )}

      {instructionType === 'http' && (
        <>
          <div className="flex gap-2">
            <select
              value={instructionFields.method ?? 'GET'}
              onChange={(e) => setInstructionField('method', e.target.value)}
              className="w-24 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] focus:outline-none focus:border-indigo-500"
            >
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="URL"
              value={instructionFields.url ?? ''}
              onChange={(e) => setInstructionField('url', e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
            />
          </div>
          <textarea
            placeholder='Headers (JSON, optional)\ne.g. {"Content-Type": "application/json"}'
            value={instructionFields.headers ?? ''}
            onChange={(e) => setInstructionField('headers', e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 font-mono resize-y"
          />
          <textarea
            placeholder="Body (optional)"
            value={instructionFields.body ?? ''}
            onChange={(e) => setInstructionField('body', e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 font-mono resize-y"
          />
        </>
      )}

      {/* Dispatch button */}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={dispatching || !targetDevice}
          className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {dispatching ? 'Dispatching...' : 'Dispatch'}
        </button>
        {dispatchError && <span className="text-[10px] text-red-400">{dispatchError}</span>}
      </div>
    </form>
  )
}
