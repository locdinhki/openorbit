import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type TaskWithResults } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

export default function TaskDetail() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<TaskWithResults | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    load()

    // Poll if task is still in progress
    const interval = setInterval(() => {
      if (task && ['queued', 'dispatched', 'running'].includes(task.status)) {
        load()
      }
    }, 2_000)
    return () => clearInterval(interval)
  }, [id, task?.status])

  async function load() {
    if (!id) return
    try {
      setTask(await api.getTask(id))
    } catch {
      // handled by api interceptor
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="animate-pulse h-40 bg-gray-800/50 rounded-lg" />
  if (!task) return <p className="text-sm text-gray-500">Task not found</p>

  const instruction = task.instruction as Record<string, unknown>
  const result = task.results?.[0]
  const resultData = result?.result as Record<string, unknown> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/tasks" className="text-xs text-gray-500 hover:text-gray-300">
          Tasks
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-sm font-mono text-white">{task.id}</h1>
        <StatusBadge status={task.status} />
      </div>

      {/* Task info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <InfoItem label="Device" value={task.targetDevice ?? '—'} />
        <InfoItem label="Priority" value={task.priority} />
        <InfoItem label="Created" value={relativeTime(task.createdAt)} />
        <InfoItem label="Completed" value={relativeTime(task.completedAt)} />
      </div>

      {/* Instruction */}
      <div>
        <h2 className="text-sm font-medium text-gray-300 mb-2">Instruction</h2>
        <pre className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-300 overflow-x-auto">
          {JSON.stringify(instruction, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {result && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-medium text-gray-300">Result</h2>
            <StatusBadge status={result.status} />
            {result.durationMs && (
              <span className="text-xs text-gray-500">{result.durationMs}ms</span>
            )}
          </div>

          {result.error && (
            <pre className="p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs text-red-300 overflow-x-auto mb-3">
              {result.error}
            </pre>
          )}

          {resultData && (
            <div className="space-y-3">
              {/* stdout */}
              {resultData.stdout != null && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">
                    stdout (exit {String(resultData.exitCode ?? '?')})
                  </p>
                  <pre className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-300 overflow-x-auto max-h-96">
                    {String(resultData.stdout)}
                  </pre>
                </div>
              )}

              {/* stderr */}
              {resultData.stderr && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">stderr</p>
                  <pre className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-orange-300 overflow-x-auto max-h-96">
                    {String(resultData.stderr)}
                  </pre>
                </div>
              )}

              {/* content (for read results) */}
              {resultData.content != null && (
                <div>
                  <p className="text-[11px] text-gray-500 mb-1">content</p>
                  <pre className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-300 overflow-x-auto max-h-96">
                    {String(resultData.content)}
                  </pre>
                </div>
              )}

              {/* Generic fallback for other result types */}
              {!resultData.stdout && !resultData.content && (
                <pre className="p-3 bg-gray-900 border border-gray-800 rounded-lg text-xs text-gray-300 overflow-x-auto">
                  {JSON.stringify(resultData, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading indicator for in-progress tasks */}
      {['queued', 'dispatched', 'running'].includes(task.status) && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-3 h-3 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
          Waiting for result...
        </div>
      )}
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-900/50 border border-gray-800 rounded-lg">
      <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-white">{value}</p>
    </div>
  )
}
