import { useState } from 'react'

interface ResumeSelectorProps {
  resumes: string[]
  recommended?: string
  selected?: string
  onSelect: (resumePath: string) => void
  onUpload?: () => void
}

export default function ResumeSelector({
  resumes,
  recommended,
  selected,
  onSelect,
  onUpload
}: ResumeSelectorProps): React.JSX.Element {
  const [currentSelection, setCurrentSelection] = useState(
    selected || recommended || resumes[0] || ''
  )

  function handleChange(value: string): void {
    setCurrentSelection(value)
    onSelect(value)
  }

  function getDisplayName(path: string): string {
    return path.split('/').pop() || path
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--cos-text-primary)]">Resume</label>

      {resumes.length > 0 ? (
        <select
          value={currentSelection}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded border border-[var(--cos-border)] bg-[var(--cos-bg)] text-[var(--cos-text-primary)] focus:border-blue-500 focus:outline-none"
        >
          {resumes.map((resume) => (
            <option key={resume} value={resume}>
              {getDisplayName(resume)}
              {resume === recommended ? ' (Recommended)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <p className="text-sm text-[var(--cos-text-secondary)]">No resumes uploaded</p>
      )}

      {recommended && recommended !== currentSelection && (
        <p className="text-xs text-amber-400">Claude recommends: {getDisplayName(recommended)}</p>
      )}

      {onUpload && (
        <button
          onClick={onUpload}
          className="px-3 py-1.5 text-xs font-medium rounded border border-[var(--cos-border)] text-[var(--cos-text-secondary)] hover:text-[var(--cos-text-primary)] hover:bg-[var(--cos-bg-hover)]"
        >
          Upload New Resume
        </button>
      )}
    </div>
  )
}
