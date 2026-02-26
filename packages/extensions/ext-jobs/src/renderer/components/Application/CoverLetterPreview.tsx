import { useState } from 'react'

interface CoverLetterPreviewProps {
  content: string
  jobTitle?: string
  company?: string
  onSave?: (content: string) => void
  onRegenerate?: () => void
}

export default function CoverLetterPreview({
  content,
  jobTitle,
  company,
  onSave,
  onRegenerate
}: CoverLetterPreviewProps): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [editedContent, setEditedContent] = useState(content)

  function handleSave(): void {
    onSave?.(editedContent)
    setEditing(false)
  }

  function handleCancel(): void {
    setEditedContent(content)
    setEditing(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-[var(--cos-border)]">
        <div>
          <h3 className="text-sm font-medium text-[var(--cos-text-primary)]">Cover Letter</h3>
          {jobTitle && company && (
            <p className="text-xs text-[var(--cos-text-secondary)]">
              {jobTitle} at {company}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => setEditing(true)}
                className="px-3 py-1 text-xs font-medium rounded text-[var(--cos-text-secondary)] hover:text-[var(--cos-text-primary)] hover:bg-[var(--cos-bg-hover)]"
              >
                Edit
              </button>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="px-3 py-1 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  Regenerate
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-xs font-medium rounded text-[var(--cos-text-secondary)] hover:text-[var(--cos-text-primary)] hover:bg-[var(--cos-bg-hover)]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Save
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {editing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full h-full px-3 py-2 text-sm rounded border border-[var(--cos-border)] bg-[var(--cos-bg)] text-[var(--cos-text-primary)] focus:border-blue-500 focus:outline-none resize-none"
          />
        ) : (
          <div className="text-sm text-[var(--cos-text-primary)] whitespace-pre-wrap leading-relaxed">
            {content || (
              <span className="text-[var(--cos-text-secondary)] italic">
                No cover letter generated yet
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
