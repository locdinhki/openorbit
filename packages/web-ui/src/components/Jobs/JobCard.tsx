import type { JobListing, RPCResult } from '../../lib/types'
import { useStore } from '../../store'

interface Props {
  job: JobListing
  onSelect: () => void
}

const STATUS_COLORS: Record<string, string> = {
  new: 'var(--cos-info)',
  approved: 'var(--cos-success)',
  rejected: 'var(--cos-error)',
  applied: 'var(--cos-accent)',
  reviewed: 'var(--cos-warning)'
}

export default function JobCard({ job, onSelect }: Props): React.JSX.Element {
  const rpcClient = useStore((s) => s.rpcClient)
  const setJobs = useStore((s) => s.setJobs)
  const jobs = useStore((s) => s.jobs)

  const handleAction = async (action: 'approve' | 'reject'): Promise<void> => {
    if (!rpcClient) return
    const method = action === 'approve' ? 'jobs.approve' : 'jobs.reject'
    await rpcClient.call<RPCResult>(method, { id: job.id })
    setJobs(
      jobs.map((j) =>
        j.id === job.id ? { ...j, status: action === 'approve' ? 'approved' : 'rejected' } : j
      )
    )
  }

  return (
    <div
      className="px-4 py-3 cursor-pointer transition-colors"
      style={{ background: 'transparent' }}
      onClick={onSelect}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cos-bg-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium truncate" style={{ color: 'var(--cos-text-primary)' }}>
            {job.title}
          </h3>
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--cos-text-secondary)' }}>
            {job.company}
            {job.location && ` \u00B7 ${job.location}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {job.score != null && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded"
              style={{ background: 'var(--cos-bg-tertiary)', color: 'var(--cos-text-secondary)' }}
            >
              {job.score}%
            </span>
          )}
          <span
            className="text-[10px] font-medium uppercase px-1.5 py-0.5 rounded"
            style={{
              color: STATUS_COLORS[job.status] ?? 'var(--cos-text-muted)',
              background: 'var(--cos-bg-tertiary)'
            }}
          >
            {job.status}
          </span>
        </div>
      </div>
      {job.status === 'new' && (
        <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleAction('approve')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
            style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'var(--cos-success)' }}
          >
            Approve
          </button>
          <button
            onClick={() => handleAction('reject')}
            className="px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors"
            style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--cos-error)' }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
