import { useState } from 'react'
import { useStore } from '../store'
import { useChat } from '../hooks/useChat'
import { ipc } from '../lib/ipc-client'
import type { JobListing, JobStatus } from '@openorbit/core/types'
import Button from '@renderer/components/shared/Button'

/**
 * JobWorkspace fills the center panel when no browser screenshot is active.
 * Compact summary bar at top, then the selected job's full details below.
 */
export default function JobWorkspace(): React.JSX.Element {
  const { jobs, selectedJobId, setJobs, currentAction } = useStore()
  const selectedJob = selectedJobId ? (jobs.find((j) => j.id === selectedJobId) ?? null) : null
  const [refetching, setRefetching] = useState(false)

  const handleRefetch = async (): Promise<void> => {
    setRefetching(true)
    try {
      await ipc.jobs.refetch()
      const result = await ipc.jobs.list()
      if (result.success && result.data) setJobs(result.data)
    } finally {
      setRefetching(false)
    }
  }

  const hasMissingDescriptions = jobs.some((j) => !j.description)

  return (
    <div className="flex flex-col h-full">
      {/* Re-fetch bar — only when needed */}
      {hasMissingDescriptions && (
        <div className="px-4 py-2.5 border-b border-[var(--cos-border)] flex-shrink-0 flex items-center justify-end">
          <Button size="sm" variant="ghost" onClick={handleRefetch} disabled={refetching}>
            {refetching ? 'Fetching...' : 'Re-fetch Descriptions'}
          </Button>
        </div>
      )}

      {/* Refetch progress banner */}
      {refetching && currentAction && (
        <div className="px-4 py-2 border-b border-[var(--cos-border)] bg-[var(--cos-bg-tertiary)] flex items-center gap-2 flex-shrink-0">
          <div className="w-3 h-3 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin flex-shrink-0" />
          <span className="text-xs text-[var(--cos-text-secondary)] truncate">{currentAction}</span>
        </div>
      )}

      {/* Job details — scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <JobDescriptionPane job={selectedJob} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Job Description Pane
// ---------------------------------------------------------------------------

function JobDescriptionPane({ job }: { job: JobListing | null }): React.JSX.Element {
  const { analyzeJob } = useChat()
  const updateJob = useStore((s) => s.updateJob)
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnalyze = async (): Promise<void> => {
    if (!job || analyzing) return
    setAnalyzing(true)
    try {
      await analyzeJob(job.id)
    } catch {
      // Error handled in hook
    } finally {
      setAnalyzing(false)
    }
  }

  const handleApprove = async (): Promise<void> => {
    if (!job) return
    const result = await ipc.jobs.approve(job.id)
    if (result.success) updateJob(job.id, { status: 'approved' })
  }

  const handleReject = async (): Promise<void> => {
    if (!job) return
    const result = await ipc.jobs.reject(job.id)
    if (result.success) updateJob(job.id, { status: 'rejected' })
  }

  const handleSetStatus = async (status: JobStatus): Promise<void> => {
    if (!job || job.status === status) return
    const result = await ipc.jobs.update(job.id, { status })
    if (result.success) updateJob(job.id, { status })
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--cos-bg-tertiary)] flex items-center justify-center">
          <svg
            className="w-6 h-6 text-[var(--cos-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 14.15v4.073a2.25 2.25 0 01-2.25 2.25h-12a2.25 2.25 0 01-2.25-2.25V6.75A2.25 2.25 0 016 4.5h4.5M15.75 4.5h4.5v4.5M9 12h6M9 15h4.5M15.75 4.5L9.75 10.5"
            />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--cos-text-secondary)]">No job selected</p>
          <p className="text-xs text-[var(--cos-text-muted)] mt-1">
            Pick a job from the list on the left to read its full description here.
          </p>
        </div>
      </div>
    )
  }

  const canDecide = job.status === 'new' || job.status === 'reviewed'
  const isApproved = job.status === 'approved'
  const isRejected = job.status === 'rejected'

  return (
    <div className="p-5 space-y-5">
      {/* Job title + action buttons */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--cos-text-primary)] leading-snug">
              {job.title}
            </h2>
            <p className="text-sm text-[var(--cos-text-secondary)] mt-0.5">{job.company}</p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              {[job.location, job.salary, job.jobType].filter(Boolean).join(' \u00b7 ')}
            </p>
          </div>
          {/* Approve / Reject buttons */}
          {canDecide && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={handleApprove}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600/20 text-green-400 border border-green-600/30 hover:bg-green-600/30 transition-colors cursor-pointer"
              >
                Approve
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600/15 text-red-400 border border-red-600/25 hover:bg-red-600/25 transition-colors cursor-pointer"
              >
                Reject
              </button>
            </div>
          )}
          {isApproved && (
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600/15 text-green-400 border border-green-600/25 flex-shrink-0">
              Approved
            </span>
          )}
          {isRejected && (
            <span className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600/10 text-red-400/70 border border-red-600/20 flex-shrink-0">
              Rejected
            </span>
          )}
        </div>
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1.5"
          >
            Open in browser
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-4.5-6H18m0 0v4.5m0-4.5L9 15"
              />
            </svg>
          </a>
        )}
      </div>

      {/* AI Analysis */}
      {job.matchScore !== undefined && (
        <div className="p-3 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase">
              Match Score
            </span>
            <span
              className={`text-lg font-bold ${
                job.matchScore >= 80
                  ? 'text-green-400'
                  : job.matchScore >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
              }`}
            >
              {job.matchScore}
            </span>
          </div>
          {job.matchReasoning && (
            <p className="text-xs text-[var(--cos-text-secondary)]">{job.matchReasoning}</p>
          )}
          {job.summary && <p className="text-sm text-[var(--cos-text-secondary)]">{job.summary}</p>}
          {job.highlights && job.highlights.length > 0 && (
            <ul className="space-y-1">
              {job.highlights.map((h, i) => (
                <li
                  key={i}
                  className="text-xs text-[var(--cos-text-secondary)] flex items-start gap-1.5"
                >
                  <span className="text-green-400 mt-0.5 flex-shrink-0">+</span> {h}
                </li>
              ))}
            </ul>
          )}
          {job.redFlags && job.redFlags.length > 0 && (
            <ul className="space-y-1">
              {job.redFlags.map((f, i) => (
                <li
                  key={i}
                  className="text-xs text-[var(--cos-text-secondary)] flex items-start gap-1.5"
                >
                  <span className="text-red-400 mt-0.5 flex-shrink-0">!</span> {f}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Analyze CTA — shown only when not yet scored */}
      {job.matchScore === undefined && (
        <Button variant="primary" size="sm" onClick={handleAnalyze} disabled={analyzing}>
          {analyzing ? 'Analyzing...' : 'Analyze with Claude'}
        </Button>
      )}

      {/* Testing: manual status override */}
      <div className="pt-3 border-t border-[var(--cos-border)]">
        <p className="text-[10px] text-[var(--cos-text-muted)] uppercase tracking-wider mb-1.5">
          Set status
        </p>
        <div className="flex flex-wrap gap-1">
          {(['new', 'reviewed', 'approved', 'rejected', 'applied', 'skipped'] as JobStatus[]).map(
            (s) => (
              <button
                key={s}
                onClick={() => handleSetStatus(s)}
                disabled={job.status === s}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors cursor-pointer disabled:cursor-default ${
                  job.status === s
                    ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-400'
                    : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)] text-[var(--cos-text-muted)] hover:border-[var(--cos-border-light)] hover:text-[var(--cos-text-secondary)]'
                }`}
              >
                {s}
              </button>
            )
          )}
        </div>
      </div>

      {/* Job description */}
      {job.description ? (
        <div className="text-sm text-[var(--cos-text-secondary)] leading-relaxed whitespace-pre-wrap">
          {job.description}
        </div>
      ) : (
        <div className="text-xs text-[var(--cos-text-muted)] italic">
          No description available for this listing.
        </div>
      )}
    </div>
  )
}
