import { useEffect, useState } from 'react'
import { useStore } from '../../store'
import type { RPCResult, JobListing } from '../../lib/types'
import JobCard from './JobCard'

type Filter = 'all' | 'new' | 'approved' | 'applied' | 'rejected'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'approved', label: 'Approved' },
  { id: 'applied', label: 'Applied' },
  { id: 'rejected', label: 'Rejected' }
]

export default function JobsView(): React.JSX.Element {
  const { jobs, jobsLoading, rpcClient, setJobs, setJobsLoading, selectJob } = useStore()
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    if (!rpcClient) return
    setJobsLoading(true)
    rpcClient
      .call<RPCResult<JobListing[]>>('jobs.list', { filters: { limit: 100 } })
      .then((result) => {
        if (result.success && result.data) setJobs(result.data)
      })
      .catch(() => {})
      .finally(() => setJobsLoading(false))
  }, [rpcClient]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--cos-border)',
          background: 'var(--cos-bg-secondary)'
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--cos-text-primary)' }}>
          Jobs ({filtered.length})
        </h2>
        <div className="flex gap-1.5 mt-2 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-2.5 py-1 text-xs rounded-full whitespace-nowrap cursor-pointer transition-colors"
              style={{
                background: filter === f.id ? 'var(--cos-accent)' : 'var(--cos-bg-tertiary)',
                color: filter === f.id ? '#fff' : 'var(--cos-text-secondary)'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {jobsLoading ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--cos-text-muted)' }}>
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--cos-text-muted)' }}>
            No jobs found
          </div>
        ) : (
          <div style={{ borderColor: 'var(--cos-border)' }}>
            {filtered.map((job) => (
              <div key={job.id} style={{ borderBottom: '1px solid var(--cos-border)' }}>
                <JobCard job={job} onSelect={() => selectJob(job.id)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
