import { useState } from 'react'

interface ApplicationQuestion {
  id: string
  question: string
  prefilled?: string
  confidence?: number
  required?: boolean
}

interface AnswerEditorProps {
  questions: ApplicationQuestion[]
  onSubmit: (answers: Record<string, string>) => void
  onSkip?: () => void
}

export default function AnswerEditor({
  questions,
  onSubmit,
  onSkip
}: AnswerEditorProps): React.JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const q of questions) {
      if (q.prefilled) initial[q.id] = q.prefilled
    }
    return initial
  })

  function handleChange(id: string, value: string): void {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function handleSubmit(): void {
    onSubmit(answers)
  }

  function getConfidenceColor(confidence?: number): string {
    if (!confidence) return 'bg-gray-400'
    if (confidence >= 0.8) return 'bg-green-400'
    if (confidence >= 0.5) return 'bg-amber-400'
    return 'bg-red-400'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-[var(--cos-border)]">
        <h3 className="text-sm font-medium text-[var(--cos-text-primary)]">
          Application Questions ({questions.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-[var(--cos-text-primary)]">
                {q.question}
                {q.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {q.confidence !== undefined && (
                <div className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${getConfidenceColor(q.confidence)}`} />
                  <span className="text-[10px] text-[var(--cos-text-secondary)]">
                    {Math.round(q.confidence * 100)}%
                  </span>
                </div>
              )}
            </div>
            <textarea
              value={answers[q.id] || ''}
              onChange={(e) => handleChange(q.id, e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded border border-[var(--cos-border)] bg-[var(--cos-bg)] text-[var(--cos-text-primary)] focus:border-blue-500 focus:outline-none resize-y"
              placeholder="Type your answer..."
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 p-3 border-t border-[var(--cos-border)]">
        {onSkip && (
          <button
            onClick={onSkip}
            className="px-3 py-1.5 text-xs font-medium rounded text-[var(--cos-text-secondary)] hover:text-[var(--cos-text-primary)] hover:bg-[var(--cos-bg-hover)]"
          >
            Skip
          </button>
        )}
        <button
          onClick={handleSubmit}
          className="px-4 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700"
        >
          Save Answers
        </button>
      </div>
    </div>
  )
}
