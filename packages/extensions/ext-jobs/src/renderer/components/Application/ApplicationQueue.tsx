import { useEffect, useState } from 'react'
import type { JobListing } from '@openorbit/core/types'
import { ipc } from '../../lib/ipc-client'
import Badge from '@renderer/components/shared/Badge'

export default function ApplicationQueue(): React.JSX.Element {
  const [queue, setQueue] = useState<JobListing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadQueue(): Promise<void> {
      setLoading(true)
      const result = await ipc.jobs.list({ status: ['approved', 'applied'] })
      if (result.success && result.data) {
        setQueue(result.data)
      }
      setLoading(false)
    }
    loadQueue()
  }, [])

  async function handleStartBatch(): Promise<void> {
    if (queue.length === 0) return
    const first = queue.find((j) => j.status === 'approved')
    if (first) {
      await ipc.application.start(first.id)
    }
  }

  function getStatusBadge(status: string): React.JSX.Element {
    switch (status) {
      case 'approved':
        return <Badge variant="info">Queued</Badge>
      case 'applied':
        return <Badge variant="success">Applied</Badge>
      case 'error':
        return <Badge variant="error">Failed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (loading) {
    return <div className="p-4 text-sm text-[var(--cos-text-secondary)]">Loading queue...</div>
  }

  const approvedCount = queue.filter((j) => j.status === 'approved').length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-sm font-medium text-[var(--cos-text-primary)]">
          Application Queue ({approvedCount} pending)
        </h3>
        <button
          onClick={handleStartBatch}
          disabled={approvedCount === 0}
          className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
        >
          Start Applying
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="p-4 text-sm text-[var(--cos-text-secondary)]">
            No approved jobs in queue. Approve jobs to add them here.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--cos-border)]">
            {queue.map((job) => (
              <li
                key={job.id}
                className="flex items-center justify-between p-3 hover:bg-[var(--cos-bg-hover)]"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
                    {job.title}
                  </div>
                  <div className="text-xs text-[var(--cos-text-secondary)]">{job.company}</div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {job.matchScore !== undefined && <Badge variant="score">{job.matchScore}</Badge>}
                  {getStatusBadge(job.status)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
