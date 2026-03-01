import { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store'
import { ipc } from '../lib/ipc-client'
import type { JobListing, JobStatus } from '@openorbit/core/types'
import Badge from '@renderer/components/shared/Badge'
import ProfileList from './Profiles/ProfileList'
import APIKeys from './Settings/APIKeys'
import AutomationSettings from './Settings/AutomationSettings'
import UserProfile from './Settings/UserProfile'
import Resumes from './Settings/Resumes'
import AnswerTemplates from './Settings/AnswerTemplates'
import PairingQR from './Settings/PairingQR'

type LeftTab = 'profiles' | 'jobs' | 'settings'

export default function LeftPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<LeftTab>('jobs')
  const { jobs, profiles, selectedJobId, selectJob, setProfiles } = useStore()

  // Eagerly load profiles so the tab count is accurate before the tab is opened
  useEffect(() => {
    ipc.profiles.list().then((r) => {
      if (r.success && r.data) setProfiles(r.data)
    })
  }, [setProfiles])

  return (
    <div className="flex flex-col h-full">
      {/* Tab Switcher */}
      <div className="flex border-b border-[var(--cos-border)]">
        <button
          onClick={() => setActiveTab('profiles')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'profiles'
              ? 'text-[var(--cos-text-primary)] border-b-2 border-indigo-500'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          Profiles ({profiles.length})
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'jobs'
              ? 'text-[var(--cos-text-primary)] border-b-2 border-indigo-500'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
            activeTab === 'settings'
              ? 'text-[var(--cos-text-primary)] border-b-2 border-indigo-500'
              : 'text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)]'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'profiles' && <ProfileList />}
        {activeTab === 'jobs' && (
          <JobsSection jobs={jobs} selectedJobId={selectedJobId} onSelectJob={selectJob} />
        )}
        {activeTab === 'settings' && <SettingsSection />}
      </div>
    </div>
  )
}

const FILTER_STATUSES: {
  key: JobStatus | 'all'
  label: string
  color: string
  activeColor: string
}[] = [
  {
    key: 'all',
    label: 'All',
    color: 'text-[var(--cos-text-muted)]',
    activeColor:
      'bg-[var(--cos-text-primary)]/15 text-[var(--cos-text-primary)] border-[var(--cos-text-primary)]/30'
  },
  {
    key: 'new',
    label: 'New',
    color: 'text-[var(--cos-text-muted)]',
    activeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  },
  {
    key: 'reviewed',
    label: 'Reviewed',
    color: 'text-blue-400',
    activeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/30'
  },
  {
    key: 'approved',
    label: 'Approved',
    color: 'text-indigo-400',
    activeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
  },
  {
    key: 'rejected',
    label: 'Rejected',
    color: 'text-red-400',
    activeColor: 'bg-red-500/15 text-red-400 border-red-500/30'
  },
  {
    key: 'applied',
    label: 'Applied',
    color: 'text-green-400',
    activeColor: 'bg-green-500/15 text-green-400 border-green-500/30'
  },
  {
    key: 'skipped',
    label: 'Skipped',
    color: 'text-[var(--cos-text-muted)]',
    activeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  }
]

type SortKey = 'newest' | 'oldest' | 'score-high' | 'score-low' | 'company' | 'title'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'score-high', label: 'Score (high)' },
  { key: 'score-low', label: 'Score (low)' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' }
]

function sortJobs(jobs: JobListing[], key: SortKey): JobListing[] {
  const sorted = [...jobs]
  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    case 'oldest':
      return sorted.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
    case 'score-high':
      return sorted.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1))
    case 'score-low':
      return sorted.sort((a, b) => (a.matchScore ?? Infinity) - (b.matchScore ?? Infinity))
    case 'company':
      return sorted.sort((a, b) => (a.company ?? '').localeCompare(b.company ?? ''))
    case 'title':
      return sorted.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  }
}

const PAGE_SIZE = 25

function JobsSection({
  jobs,
  selectedJobId,
  onSelectJob
}: {
  jobs: JobListing[]
  selectedJobId: string | null
  onSelectJob: (id: string | null) => void
}): React.JSX.Element {
  const removeJob = useStore((s) => s.removeJob)
  const updateJob = useStore((s) => s.updateJob)
  const [filter, setFilter] = useState<JobStatus | 'all'>('reviewed')
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(0)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [analyzingAll, setAnalyzingAll] = useState(false)

  const filteredJobs = useMemo(() => {
    const filtered = filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)
    return sortJobs(filtered, sort)
  }, [jobs, filter, sort])

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pagedJobs = filteredJobs.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const handleFilterChange = (key: JobStatus | 'all'): void => {
    setFilter(key)
    setPage(0)
  }

  const handleDelete = async (e: React.MouseEvent, jobId: string): Promise<void> => {
    e.stopPropagation()
    const result = await ipc.jobs.delete(jobId)
    if (result.success) removeJob(jobId)
  }

  const handleAnalyze = async (e: React.MouseEvent, jobId: string): Promise<void> => {
    e.stopPropagation()
    setAnalyzingId(jobId)
    try {
      const result = await ipc.chat.analyzeJob(jobId)
      if (result.success && result.data) updateJob(jobId, result.data)
    } finally {
      setAnalyzingId(null)
    }
  }

  const handleAnalyzeAll = async (): Promise<void> => {
    setAnalyzingAll(true)
    try {
      await ipc.chat.analyzeAll()
    } finally {
      setAnalyzingAll(false)
    }
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[var(--cos-text-secondary)] uppercase tracking-wider">
          Job Listings
        </h3>
        <span className="text-xs text-[var(--cos-text-muted)]">{jobs.length} total</span>
      </div>

      {/* Filter badges */}
      <div className="flex flex-wrap items-center gap-1">
        {FILTER_STATUSES.map(({ key, label, activeColor }) => {
          const count = key === 'all' ? jobs.length : countByStatus(jobs, [key])
          const isActive = filter === key
          return (
            <button
              key={key}
              onClick={() => handleFilterChange(key)}
              className={`px-2 py-0.5 text-[10px] font-medium rounded-full border transition-colors cursor-pointer ${
                isActive
                  ? activeColor
                  : 'bg-transparent border-[var(--cos-border)] text-[var(--cos-text-muted)] hover:border-[var(--cos-border-light)] hover:text-[var(--cos-text-secondary)]'
              }`}
            >
              {label} {count}
            </button>
          )
        })}
      </div>

      {/* Analyze All — shown when filtering to 'new' and there are new jobs */}
      {filter === 'new' && filteredJobs.length > 0 && (
        <button
          onClick={handleAnalyzeAll}
          disabled={analyzingAll}
          className="w-full px-2 py-1.5 text-[11px] font-medium rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default flex items-center justify-center gap-1.5"
        >
          {analyzingAll ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing {filteredJobs.length} jobs...
            </>
          ) : (
            <>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                />
              </svg>
              Analyze All ({filteredJobs.length})
            </>
          )}
        </button>
      )}

      {/* Sort */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-[var(--cos-text-muted)]">Sort:</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as SortKey)
            setPage(0)
          }}
          className="text-[10px] bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] text-[var(--cos-text-secondary)] rounded px-1.5 py-0.5 cursor-pointer outline-none focus:border-indigo-500/50"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {filteredJobs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-[var(--cos-text-muted)]">
            {jobs.length === 0 ? 'No jobs found yet' : `No ${filter} jobs`}
          </p>
          {jobs.length === 0 && (
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Run a search profile to extract jobs
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            {pagedJobs.map((job) => (
              <div
                key={job.id}
                className={`group relative w-full text-left p-2.5 rounded-md transition-colors cursor-pointer ${
                  job.id === selectedJobId
                    ? 'bg-indigo-600/15 border border-indigo-500/40'
                    : 'bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] hover:border-[var(--cos-border-light)]'
                }`}
                onClick={() => onSelectJob(job.id === selectedJobId ? null : job.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-[var(--cos-text-muted)] truncate">{job.company}</p>
                  </div>
                  {job.matchScore !== undefined && <ScoreBadge score={job.matchScore} />}
                </div>
                {(job.salary || job.jobType) && (
                  <p className="text-xs text-[var(--cos-text-muted)] truncate mt-0.5">
                    {[job.salary, job.jobType].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                    {job.easyApply && <Badge variant="info">Easy Apply</Badge>}
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Analyze button — shown for new/unanalyzed jobs */}
                    {(job.status === 'new' || job.matchScore === undefined) && (
                      <button
                        onClick={(e) => handleAnalyze(e, job.id)}
                        disabled={analyzingId === job.id}
                        className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-[var(--cos-text-muted)] hover:text-indigo-400 hover:bg-indigo-500/10 transition-all cursor-pointer disabled:opacity-100 disabled:animate-pulse"
                        title="Analyze with AI"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                          />
                        </svg>
                      </button>
                    )}
                    {/* Delete button */}
                    <button
                      onClick={(e) => handleDelete(e, job.id)}
                      className="w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-[var(--cos-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Delete job"
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="px-2 py-1 text-[10px] font-medium rounded border border-[var(--cos-border)] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:border-[var(--cos-border-light)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                Prev
              </button>
              <span className="text-[10px] text-[var(--cos-text-muted)]">
                {safePage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="px-2 py-1 text-[10px] font-medium rounded border border-[var(--cos-border)] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:border-[var(--cos-border-light)] transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ScoreBadge({ score }: { score: number }): React.JSX.Element {
  const variant = score >= 80 ? 'success' : score >= 60 ? 'warning' : 'error'
  return <Badge variant={variant}>{score}</Badge>
}

function SettingsSection(): React.JSX.Element {
  return (
    <div className="p-3 space-y-6">
      <UserProfile />
      <hr className="border-[var(--cos-border)]" />
      <APIKeys />
      <hr className="border-[var(--cos-border)]" />
      <AutomationSettings />
      <hr className="border-[var(--cos-border)]" />
      <Resumes />
      <hr className="border-[var(--cos-border)]" />
      <AnswerTemplates />
      <hr className="border-[var(--cos-border)]" />
      <PairingQR />
    </div>
  )
}

function countByStatus(jobs: JobListing[], statuses: JobStatus[]): number {
  return jobs.filter((j) => statuses.includes(j.status as JobStatus)).length
}

function statusVariant(status: string): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'applied':
      return 'success'
    case 'approved':
      return 'info'
    case 'rejected':
    case 'error':
      return 'error'
    case 'reviewed':
      return 'warning'
    default:
      return 'default'
  }
}
