import { useState } from 'react'

interface Props {
  value: unknown
}

export default function CellRenderer({ value }: Props): React.JSX.Element {
  const [expanded, setExpanded] = useState(false)

  if (value === null || value === undefined) {
    return <span className="text-[var(--cos-text-muted)] italic">NULL</span>
  }

  const str = String(value)

  // Try to detect JSON
  let jsonFormatted: string | null = null
  let jsonPreview: string | null = null
  if (typeof value === 'string' && (str.startsWith('{') || str.startsWith('['))) {
    try {
      const parsed = JSON.parse(str)
      jsonFormatted = JSON.stringify(parsed, null, 2)
      jsonPreview = str.length > 80 ? str.slice(0, 80) + '...' : str
    } catch {
      // Not valid JSON, fall through
    }
  }

  if (jsonFormatted !== null && jsonPreview !== null) {
    if (expanded) {
      return (
        <div className="relative">
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-indigo-400 hover:text-indigo-300 cursor-pointer mb-1"
          >
            Collapse
          </button>
          <pre className="text-[10px] text-[var(--cos-text-secondary)] bg-[var(--cos-bg-secondary)] rounded p-1.5 overflow-auto max-h-[200px] whitespace-pre-wrap">
            {jsonFormatted}
          </pre>
        </div>
      )
    }

    return (
      <span
        onClick={() => setExpanded(true)}
        className="text-[var(--cos-text-secondary)] cursor-pointer hover:text-indigo-400 truncate block"
        title={jsonFormatted}
      >
        {jsonPreview}
      </span>
    )
  }

  // Long text truncation
  if (str.length > 100) {
    return (
      <span className="text-[var(--cos-text-secondary)] truncate block" title={str}>
        {str.slice(0, 100)}...
      </span>
    )
  }

  return <span className="text-[var(--cos-text-secondary)]">{str}</span>
}
