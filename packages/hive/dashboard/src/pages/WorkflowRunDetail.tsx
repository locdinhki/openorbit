import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api, type WorkflowRunDetail as RunDetail, type Workflow } from '../lib/api'
import { relativeTime } from '../lib/time'
import StatusBadge from '../components/StatusBadge'

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-gray-400',
  running: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400'
}

export default function WorkflowRunDetail() {
  const { runId } = useParams<{ runId: string }>()
  const [run, setRun] = useState<RunDetail | null>(null)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!runId) return

    async function load() {
      const r = await api.getWorkflowRunDetail(runId!)
      setRun(r)
      if (!workflow) {
        const wf = await api.getWorkflow(r.workflowId)
        setWorkflow(wf)
      }
      setLoading(false)
      return r
    }

    load().catch(() => setLoading(false))

    // Poll while running
    const interval = setInterval(async () => {
      const r = await api.getWorkflowRunDetail(runId!).catch(() => null)
      if (!r) return
      setRun(r)
      if (r.status === 'completed' || r.status === 'failed') {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [runId])

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>
  if (!run) return <p className="text-sm text-red-400">Run not found</p>

  const steps = workflow?.steps ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {workflow && (
          <Link
            to="/workflows"
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            ← Workflows
          </Link>
        )}
        <h1 className="text-lg font-semibold">Run {run.id.slice(0, 8)}</h1>
        <span className={`text-sm font-medium ${STATUS_COLORS[run.status] ?? 'text-gray-400'}`}>
          {run.status}
        </span>
      </div>

      {workflow && <p className="text-sm text-gray-400">{workflow.name}</p>}

      <div className="text-xs text-gray-500 flex gap-4">
        {run.startedAt && <span>Started {relativeTime(run.startedAt)}</span>}
        {run.completedAt && <span>Completed {relativeTime(run.completedAt)}</span>}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, i) => {
          const stepRun = run.stepRuns.find((sr) => sr.stepIndex === i)
          const isCurrent = run.status === 'running' && run.currentStep === i
          const isNotReached = !stepRun

          return (
            <div
              key={i}
              className={`border rounded-lg p-3 transition-colors ${
                isCurrent
                  ? 'border-yellow-600/50 bg-yellow-900/10'
                  : stepRun?.status === 'completed'
                    ? 'border-green-800/50 bg-green-900/10'
                    : stepRun?.status === 'failed'
                      ? 'border-red-800/50 bg-red-900/10'
                      : 'border-gray-800 bg-gray-900/30'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{i + 1}.</span>
                  <span className="text-sm text-white">{step.name}</span>
                  <span className="text-xs text-gray-600 font-mono">
                    {String(step.instruction.type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {isCurrent && (
                    <span className="text-yellow-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" />
                      running
                    </span>
                  )}
                  {stepRun && !isCurrent && (
                    <span className={STATUS_COLORS[stepRun.status] ?? 'text-gray-400'}>
                      {stepRun.status}
                    </span>
                  )}
                  {isNotReached && !isCurrent && <span className="text-gray-600">pending</span>}
                  {stepRun?.taskId && (
                    <Link
                      to={`/tasks/${stepRun.taskId}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      task →
                    </Link>
                  )}
                </div>
              </div>

              {/* Output */}
              {stepRun?.output && (
                <div className="mt-2">
                  {typeof stepRun.output.stdout === 'string' && stepRun.output.stdout && (
                    <pre className="text-xs text-green-300 bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
                      {stepRun.output.stdout}
                    </pre>
                  )}
                  {typeof stepRun.output.stderr === 'string' && stepRun.output.stderr && (
                    <pre className="text-xs text-yellow-300 bg-black/30 rounded p-2 mt-1 overflow-x-auto whitespace-pre-wrap max-h-24">
                      {stepRun.output.stderr}
                    </pre>
                  )}
                </div>
              )}
              {stepRun?.error && (
                <p className="mt-2 text-xs text-red-400 bg-red-900/20 rounded p-2">
                  {stepRun.error}
                </p>
              )}

              {/* Timings */}
              {stepRun?.startedAt && (
                <p className="mt-1 text-xs text-gray-600">
                  {relativeTime(stepRun.startedAt)}
                  {stepRun.completedAt &&
                    ` · ${Math.round((new Date(stepRun.completedAt).getTime() - new Date(stepRun.startedAt).getTime()) / 1000)}s`}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Context variables */}
      {Object.keys(run.context ?? {}).length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">Context variables</p>
          <div className="space-y-1">
            {Object.entries(run.context).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-xs">
                <span className="text-gray-400 font-mono">${k}</span>
                <span className="text-gray-300 truncate">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
