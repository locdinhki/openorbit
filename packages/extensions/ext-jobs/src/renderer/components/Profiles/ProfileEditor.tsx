import { useState } from 'react'
import type { SearchProfile, PlatformName } from '@openorbit/core/types'
import Modal from '@renderer/components/shared/Modal'
import Button from '@renderer/components/shared/Button'

interface ProfileEditorProps {
  open: boolean
  onClose: () => void
  onSave: (profile: Omit<SearchProfile, 'id' | 'createdAt' | 'updatedAt'>) => void
  initial?: SearchProfile
}

const PLATFORMS: { value: PlatformName; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'upwork', label: 'Upwork' },
  { value: 'dice', label: 'Dice' },
  { value: 'wellfound', label: 'Wellfound' },
  { value: 'glassdoor', label: 'Glassdoor' }
]

const JOB_TYPES = ['full-time', 'contract', 'freelance', 'part-time'] as const
const DATE_POSTED = [
  { value: 'past24hrs', label: 'Past 24 Hours' },
  { value: 'pastWeek', label: 'Past Week' },
  { value: 'pastMonth', label: 'Past Month' }
] as const

const inputClass =
  'w-full px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500'
const labelClass = 'block text-xs font-medium text-[var(--cos-text-secondary)] mb-1'

export default function ProfileEditor({
  open,
  onClose,
  onSave,
  initial
}: ProfileEditorProps): React.JSX.Element | null {
  const [name, setName] = useState(initial?.name ?? '')
  const [platform, setPlatform] = useState<PlatformName>(initial?.platform ?? 'linkedin')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [keywords, setKeywords] = useState(initial?.search.keywords.join(', ') ?? '')
  const [location, setLocation] = useState(initial?.search.location.join(', ') ?? '')
  const [datePosted, setDatePosted] = useState(initial?.search.datePosted ?? 'pastWeek')
  const [experienceLevel, setExperienceLevel] = useState(
    initial?.search.experienceLevel.join(', ') ?? ''
  )
  const [jobType, setJobType] = useState<Set<string>>(
    new Set(initial?.search.jobType ?? ['full-time', 'contract'])
  )
  const [salaryMin, setSalaryMin] = useState(initial?.search.salaryMin?.toString() ?? '')
  const [easyApplyOnly, setEasyApplyOnly] = useState(initial?.search.easyApplyOnly ?? false)
  const [remoteOnly, setRemoteOnly] = useState(initial?.search.remoteOnly ?? false)
  const [excludeTerms, setExcludeTerms] = useState(initial?.search.excludeTerms.join(', ') ?? '')
  const [resumeFile, setResumeFile] = useState(initial?.application.resumeFile ?? '')
  const [coverLetterTemplate, setCoverLetterTemplate] = useState(
    initial?.application.coverLetterTemplate ?? 'auto'
  )

  const handleSubmit = (): void => {
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      platform,
      enabled,
      search: {
        keywords: splitCSV(keywords),
        location: splitCSV(location),
        datePosted,
        experienceLevel: splitCSV(experienceLevel),
        jobType: Array.from(jobType) as SearchProfile['search']['jobType'],
        salaryMin: salaryMin ? parseInt(salaryMin, 10) : undefined,
        easyApplyOnly,
        remoteOnly,
        excludeTerms: splitCSV(excludeTerms)
      },
      application: {
        resumeFile: resumeFile.trim(),
        coverLetterTemplate: coverLetterTemplate.trim() || undefined,
        defaultAnswers: initial?.application.defaultAnswers ?? {}
      }
    })
    onClose()
  }

  const toggleJobType = (type: string): void => {
    setJobType((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Edit Profile' : 'New Search Profile'}
      className="max-w-xl"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        {/* Name & Platform */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Profile Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Senior React Remote"
            />
          </div>
          <div>
            <label className={labelClass}>Platform</label>
            <select
              className={inputClass}
              value={platform}
              onChange={(e) => setPlatform(e.target.value as PlatformName)}
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Keywords */}
        <div>
          <label className={labelClass}>Keywords (comma-separated)</label>
          <input
            className={inputClass}
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="React, TypeScript, Node.js"
          />
        </div>

        {/* Location */}
        <div>
          <label className={labelClass}>Location (comma-separated)</label>
          <input
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Dallas, TX, Remote"
          />
        </div>

        {/* Job Type Checkboxes */}
        <div>
          <label className={labelClass}>Job Type</label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map((type) => (
              <label
                key={type}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer border transition-colors ${
                  jobType.has(type)
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-[var(--cos-bg-tertiary)] border-[var(--cos-border)] text-[var(--cos-text-muted)]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={jobType.has(type)}
                  onChange={() => toggleJobType(type)}
                  className="sr-only"
                />
                {type}
              </label>
            ))}
          </div>
        </div>

        {/* Date Posted & Salary */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Date Posted</label>
            <select
              className={inputClass}
              value={datePosted}
              onChange={(e) =>
                setDatePosted(e.target.value as 'past24hrs' | 'pastWeek' | 'pastMonth')
              }
            >
              {DATE_POSTED.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Min Salary ($)</label>
            <input
              className={inputClass}
              type="number"
              value={salaryMin}
              onChange={(e) => setSalaryMin(e.target.value)}
              placeholder="100000"
            />
          </div>
        </div>

        {/* Experience Level */}
        <div>
          <label className={labelClass}>Experience Level (comma-separated)</label>
          <input
            className={inputClass}
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            placeholder="Senior, Lead, Staff"
          />
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-4">
          <Toggle label="Easy Apply Only" checked={easyApplyOnly} onChange={setEasyApplyOnly} />
          <Toggle label="Remote Only" checked={remoteOnly} onChange={setRemoteOnly} />
          <Toggle label="Enabled" checked={enabled} onChange={setEnabled} />
        </div>

        {/* Exclude Terms */}
        <div>
          <label className={labelClass}>Exclude Terms (comma-separated)</label>
          <input
            className={inputClass}
            value={excludeTerms}
            onChange={(e) => setExcludeTerms(e.target.value)}
            placeholder="clearance, on-site only"
          />
        </div>

        {/* Resume & Cover Letter */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Resume File Path</label>
            <input
              className={inputClass}
              value={resumeFile}
              onChange={(e) => setResumeFile(e.target.value)}
              placeholder="/path/to/resume.pdf"
            />
          </div>
          <div>
            <label className={labelClass}>Cover Letter</label>
            <select
              className={inputClass}
              value={coverLetterTemplate}
              onChange={(e) => setCoverLetterTemplate(e.target.value)}
            >
              <option value="auto">Auto-generate (Claude)</option>
              <option value="none">None</option>
            </select>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[var(--cos-border)]">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          {initial ? 'Save Changes' : 'Create Profile'}
        </Button>
      </div>
    </Modal>
  )
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-8 h-4 bg-[var(--cos-border-light)] peer-checked:bg-indigo-600 rounded-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-transform peer-checked:after:translate-x-4" />
      </div>
      <span className="text-xs text-[var(--cos-text-secondary)]">{label}</span>
    </label>
  )
}

function splitCSV(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}
