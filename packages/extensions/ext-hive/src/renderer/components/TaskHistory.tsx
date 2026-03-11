// ============================================================================
// ext-hive — Task History
// ============================================================================

import { useEffect } from 'react'
import { useExtHiveStore } from '../store/index'
import type { Task, TaskWithResults } from '../../main/types'

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-yellow-400',
  dispatched: 'text-blue-400',
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  timeout: 'text-orange-400'
}

export default function TaskHistory(): React.JSX.Element {
  const tasks = useExtHiveStore((s) => s.tasks)
  const tasksLoading = useExtHiveStore((s) => s.tasksLoading)
  const loadTasks = useExtHiveStore((s) => s.loadTasks)
  const selectedTask = useExtHiveStore((s) => s.selectedTask)
  const selectedTaskLoading = useExtHiveStore((s) => s.selectedTaskLoading)
  const selectTask = useExtHiveStore((s) => s.selectTask)
  const clearSelectedTask = useExtHiveStore((s) => s.clearSelectedTask)

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">
          Tasks ({tasks.length})
        </span>
        <button
          onClick={() => loadTasks()}
          disabled={tasksLoading}
          className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer transition-colors disabled:opacity-50"
        >
          {tasksLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Task detail overlay */}
      {selectedTask && (
        <TaskDetail task={selectedTask} loading={selectedTaskLoading} onClose={clearSelectedTask} />
      )}

      {/* Task table */}
      {!selectedTask && (
        <div className="flex-1 overflow-auto">
          {tasks.length === 0 && !tasksLoading ? (
            <div className="flex items-center justify-center h-32 text-xs text-[var(--cos-text-muted)]">
              No tasks yet
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--cos-border)] text-[var(--cos-text-muted)]">
                  <th className="text-left px-3 py-1.5 font-medium">ID</th>
                  <th className="text-left px-3 py-1.5 font-medium">Device</th>
                  <th className="text-left px-3 py-1.5 font-medium">Type</th>
                  <th className="text-left px-3 py-1.5 font-medium">Status</th>
                  <th className="text-right px-3 py-1.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <TaskRow key={task.id} task={task} onClick={() => selectTask(task.id)} />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }): React.JSX.Element {
  const instruction = task.instruction as Record<string, unknown>
  return (
    <tr
      onClick={onClick}
      className="border-b border-[var(--cos-border)] hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors"
    >
      <td className="px-3 py-1.5 text-[var(--cos-text-muted)] font-mono">{task.id.slice(0, 8)}</td>
      <td className="px-3 py-1.5 text-[var(--cos-text-primary)]">{task.targetDevice ?? '—'}</td>
      <td className="px-3 py-1.5 text-[var(--cos-text-secondary)]">{instruction.type as string}</td>
      <td className={`px-3 py-1.5 font-medium ${STATUS_COLORS[task.status] ?? ''}`}>
        {task.status}
      </td>
      <td className="px-3 py-1.5 text-right text-[var(--cos-text-muted)]">
        {new Date(task.createdAt).toLocaleTimeString()}
      </td>
    </tr>
  )
}

function TaskDetail({
  task,
  loading,
  onClose
}: {
  task: TaskWithResults
  loading: boolean
  onClose: () => void
}): React.JSX.Element {
  const instruction = task.instruction as Record<string, unknown>
  const result = task.results?.[0]
  const resultData = result?.result as Record<string, unknown> | undefined

  return (
    <div className="flex-1 overflow-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">
          Task {task.id.slice(0, 8)}
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] cursor-pointer"
        >
          Back
        </button>
      </div>

      {loading && <p className="text-xs text-[var(--cos-text-muted)]">Loading...</p>}

      {/* Status */}
      <div className="flex gap-4 text-xs">
        <div>
          <span className="text-[var(--cos-text-muted)]">Status: </span>
          <span className={STATUS_COLORS[task.status] ?? ''}>{task.status}</span>
        </div>
        <div>
          <span className="text-[var(--cos-text-muted)]">Device: </span>
          <span className="text-[var(--cos-text-primary)]">{task.targetDevice}</span>
        </div>
        <div>
          <span className="text-[var(--cos-text-muted)]">Type: </span>
          <span className="text-[var(--cos-text-primary)]">{instruction.type as string}</span>
        </div>
      </div>

      {/* Instruction */}
      <div>
        <div className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider mb-1">
          Instruction
        </div>
        <pre className="text-xs text-[var(--cos-text-secondary)] bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded p-2 overflow-auto max-h-32 font-mono">
          {JSON.stringify(instruction, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {result && (
        <div>
          <div className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider mb-1">
            Result
          </div>

          {/* Exec: show stdout/stderr */}
          {instruction.type === 'exec' && resultData && (
            <div className="space-y-2">
              {resultData.stdout && (
                <div>
                  <span className="text-[10px] text-[var(--cos-text-muted)]">stdout:</span>
                  <pre className="text-xs text-green-400 bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded p-2 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                    {resultData.stdout as string}
                  </pre>
                </div>
              )}
              {resultData.stderr && (
                <div>
                  <span className="text-[10px] text-[var(--cos-text-muted)]">stderr:</span>
                  <pre className="text-xs text-red-400 bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded p-2 overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                    {resultData.stderr as string}
                  </pre>
                </div>
              )}
              <div className="text-[10px] text-[var(--cos-text-muted)]">
                exit {resultData.exitCode as number} · {resultData.durationMs as number}ms
              </div>
            </div>
          )}

          {/* Other types: show raw JSON */}
          {instruction.type !== 'exec' && (
            <pre className="text-xs text-[var(--cos-text-secondary)] bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded p-2 overflow-auto max-h-48 font-mono">
              {JSON.stringify(resultData, null, 2)}
            </pre>
          )}

          {result.error && <p className="text-xs text-red-400 mt-1">{result.error}</p>}
        </div>
      )}
    </div>
  )
}
