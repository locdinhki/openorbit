import { useState } from 'react'
import { useExtGhlStore } from '../store/index'
import Button from '@renderer/components/shared/Button'

export default function GhlChatPanel(): React.JSX.Element {
  const messages = useExtGhlStore((s) => s.chatMessages)
  const chatLoading = useExtGhlStore((s) => s.chatLoading)
  const sendChatMessage = useExtGhlStore((s) => s.sendChatMessage)
  const clearChat = useExtGhlStore((s) => s.clearChat)
  const [input, setInput] = useState('')

  const handleSend = (): void => {
    if (!input.trim() || chatLoading) return
    sendChatMessage(input.trim())
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--cos-border)]">
        <span className="text-xs font-medium text-[var(--cos-text-primary)]">CRM Chat</span>
        <Button size="sm" variant="ghost" onClick={clearChat}>
          Clear
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-xs text-[var(--cos-text-muted)] text-center mt-8">
            Ask about your CRM — tasks, follow-ups, deals, contacts...
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] px-3 py-2 rounded-lg text-xs whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'ml-auto bg-indigo-600/20 text-indigo-200'
                : 'mr-auto bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)]'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {chatLoading && (
          <div className="mr-auto px-3 py-2 rounded-lg text-xs bg-[var(--cos-bg-secondary)] text-[var(--cos-text-muted)]">
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-[var(--cos-border)] p-3 flex gap-2">
        <input
          type="text"
          placeholder="Ask about your CRM..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
        <Button
          size="sm"
          variant="primary"
          onClick={handleSend}
          disabled={chatLoading || !input.trim()}
        >
          Send
        </Button>
      </div>
    </div>
  )
}
