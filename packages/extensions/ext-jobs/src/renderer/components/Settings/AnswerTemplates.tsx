import { useState, useEffect } from 'react'
import { ipc } from '@renderer/lib/ipc-client'
import Button from '@renderer/components/shared/Button'

interface AnswerTemplate {
  id: string
  questionPattern: string
  answer: string
  platform: string | null
  usageCount: number
}

export default function AnswerTemplates(): React.JSX.Element {
  const [templates, setTemplates] = useState<AnswerTemplate[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [newAnswer, setNewAnswer] = useState('')
  const [newPlatform, setNewPlatform] = useState('')

  useEffect(() => {
    async function loadTemplates(): Promise<void> {
      const result = await ipc.settings.get('answer_templates')
      if (result.success && result.data) {
        try {
          setTemplates(JSON.parse(result.data) as AnswerTemplate[])
        } catch {
          // ignore
        }
      }
    }
    loadTemplates()
  }, [])

  const saveTemplates = async (updated: AnswerTemplate[]): Promise<void> => {
    await ipc.settings.update('answer_templates', JSON.stringify(updated))
    setTemplates(updated)
  }

  const handleAdd = (): void => {
    if (!newPattern.trim() || !newAnswer.trim()) return
    const template: AnswerTemplate = {
      id: crypto.randomUUID(),
      questionPattern: newPattern.trim(),
      answer: newAnswer.trim(),
      platform: newPlatform.trim() || null,
      usageCount: 0
    }
    saveTemplates([...templates, template])
    setNewPattern('')
    setNewAnswer('')
    setNewPlatform('')
    setShowAdd(false)
  }

  const handleRemove = (id: string): void => {
    saveTemplates(templates.filter((t) => t.id !== id))
    if (editing === id) setEditing(null)
  }

  const handleUpdate = (id: string, field: keyof AnswerTemplate, value: string): void => {
    const updated = templates.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    saveTemplates(updated)
  }

  const inputClass =
    'w-full px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--cos-text-primary)] mb-1">
            Answer Templates
          </h3>
          <p className="text-xs text-[var(--cos-text-muted)]">
            Pre-fill answers for common application questions.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancel' : 'Add Template'}
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-3 rounded-md bg-[var(--cos-bg-tertiary)] border border-indigo-500/30 space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
              Question Pattern
            </label>
            <input
              className={inputClass}
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder='e.g., "Why are you interested in this role?"'
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
              Answer
            </label>
            <textarea
              className={`${inputClass} resize-none`}
              rows={3}
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Your template answer..."
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs font-medium text-[var(--cos-text-secondary)] mb-1 block">
                Platform (optional)
              </label>
              <input
                className={inputClass}
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value)}
                placeholder="linkedin, indeed, all"
              />
            </div>
            <Button variant="primary" size="md" onClick={handleAdd}>
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Templates list */}
      {templates.length > 0 ? (
        <div className="space-y-2">
          {templates.map((template) => (
            <div
              key={template.id}
              className="p-3 rounded-md bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)]"
            >
              {editing === template.id ? (
                <div className="space-y-2">
                  <input
                    className={inputClass}
                    value={template.questionPattern}
                    onChange={(e) => handleUpdate(template.id, 'questionPattern', e.target.value)}
                  />
                  <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    value={template.answer}
                    onChange={(e) => handleUpdate(template.id, 'answer', e.target.value)}
                  />
                  <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--cos-text-primary)]">
                      {template.questionPattern}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(template.id)}>
                        Edit
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => handleRemove(template.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--cos-text-secondary)] mt-1 line-clamp-2">
                    {template.answer}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {template.platform && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-600/15 text-blue-400">
                        {template.platform}
                      </span>
                    )}
                    <span className="text-[10px] text-[var(--cos-text-muted)]">
                      Used {template.usageCount}x
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        !showAdd && (
          <div className="text-center py-6 bg-[var(--cos-bg-tertiary)] rounded-md border border-[var(--cos-border)]">
            <p className="text-sm text-[var(--cos-text-muted)]">No answer templates yet</p>
            <p className="text-xs text-[var(--cos-text-muted)] mt-1">
              Templates help auto-fill common application questions
            </p>
          </div>
        )
      )}
    </div>
  )
}
