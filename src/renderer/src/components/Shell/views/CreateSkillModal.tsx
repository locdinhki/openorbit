// ============================================================================
// OpenOrbit — Create/Edit Skill Modal
// ============================================================================

import { useState, useEffect, useRef } from 'react'
import type { SkillCategory } from '@openorbit/core/skills/skill-types'
import SvgIcon from '../../shared/SvgIcon'

const CATEGORY_OPTIONS: { value: SkillCategory; label: string }[] = [
  { value: 'utility', label: 'Utility' },
  { value: 'document', label: 'Document' },
  { value: 'data', label: 'Data' },
  { value: 'media', label: 'Media' },
  { value: 'communication', label: 'Communication' }
]

const TEMPLATE = `## Workflow
1. ...

## Conventions
- ...

## Dependencies
- ...

## Quality Gates
- ...`

export interface SkillFormData {
  id?: string
  displayName: string
  description: string
  category: SkillCategory
  content: string
}

interface CreateSkillModalProps {
  open: boolean
  editData?: SkillFormData | null
  onSave: (data: SkillFormData) => void
  onClose: () => void
}

export default function CreateSkillModal({
  open,
  editData,
  onSave,
  onClose
}: CreateSkillModalProps): React.JSX.Element | null {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SkillCategory>('utility')
  const [content, setContent] = useState(TEMPLATE)
  const nameRef = useRef<HTMLInputElement>(null)

  const isEditing = !!editData?.id

  // Reset form state when modal opens — state-during-render pattern (no effect needed)
  const [prevOpen, setPrevOpen] = useState(open)
  const [prevEditId, setPrevEditId] = useState(editData?.id)
  if (open !== prevOpen || editData?.id !== prevEditId) {
    setPrevOpen(open)
    setPrevEditId(editData?.id)
    if (open && editData) {
      setName(editData.displayName)
      setDescription(editData.description)
      setCategory(editData.category)
      setContent(editData.content)
    } else if (open) {
      setName('')
      setDescription('')
      setCategory('utility')
      setContent(TEMPLATE)
    }
  }

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const canSave = name.trim().length > 0 && description.trim().length > 0

  const handleSave = (): void => {
    if (!canSave) return
    onSave({
      id: editData?.id,
      displayName: name.trim(),
      description: description.trim(),
      category,
      content: content.trim()
    })
  }

  const inputClass =
    'w-full px-3 py-2 text-sm rounded-md bg-[var(--cos-bg-primary)] border border-[var(--cos-border)] text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500/50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-xl border border-[var(--cos-border)] bg-[var(--cos-bg-secondary)] shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--cos-border)]">
          <h2 className="text-sm font-semibold text-[var(--cos-text-primary)]">
            {isEditing ? 'Edit Skill' : 'New Skill'}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--cos-text-muted)] hover:text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
          >
            <SvgIcon name="plus" size={14} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
              Name
            </label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom Skill"
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this skill do?"
              className={inputClass}
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SkillCategory)}
              className={inputClass}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Content (markdown) */}
          <div>
            <label className="block text-xs font-medium text-[var(--cos-text-secondary)] mb-1">
              Instructions (Markdown)
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={TEMPLATE}
              className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
            />
            <p className="text-[10px] text-[var(--cos-text-muted)] mt-1">
              This content is injected into the AI system prompt when the skill is installed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--cos-border)]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded-md text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--cos-accent)] text-white hover:bg-[var(--cos-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Save Changes' : 'Create Skill'}
          </button>
        </div>
      </div>
    </div>
  )
}
