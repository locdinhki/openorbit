import { useState } from 'react'

interface Props {
  onSend: (message: string) => void
  disabled: boolean
}

export default function ChatInput({ onSend, disabled }: Props): React.JSX.Element {
  const [input, setInput] = useState('')

  const handleSend = (): void => {
    const trimmed = input.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex items-end gap-2 px-3 py-2 safe-area-bottom"
      style={{
        borderTop: '1px solid var(--cos-border)',
        background: 'var(--cos-bg-secondary)'
      }}
    >
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything..."
        rows={1}
        className="flex-1 px-3 py-2.5 text-sm rounded-xl outline-none resize-none"
        style={{
          background: 'var(--cos-bg-tertiary)',
          border: '1px solid var(--cos-border)',
          color: 'var(--cos-text-primary)',
          minHeight: '44px',
          maxHeight: '120px'
        }}
      />
      <button
        onClick={handleSend}
        disabled={disabled || !input.trim()}
        className="px-4 py-2.5 text-sm font-medium text-white rounded-xl transition-colors cursor-pointer disabled:opacity-40"
        style={{ background: 'var(--cos-accent)', minHeight: '44px' }}
      >
        Send
      </button>
    </div>
  )
}
