import { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import Button from '@renderer/components/shared/Button'

/**
 * ChatPanel — registered for the "jobs-chat" panel contribution.
 * The shell's PanelContainer handles tab switching; this component
 * only renders the chat content.
 */
export function ChatPanel(): React.JSX.Element {
  const { messages, chatLoading, sendMessage } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, chatLoading])

  const handleSend = (): void => {
    if (!input.trim() || chatLoading) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-2xl mb-2">&#x1f916;</div>
            <p className="text-sm text-[var(--cos-text-muted)]">
              Ask Claude about jobs, strategies, or anything
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2.5 rounded-md text-sm ${
                msg.role === 'user' ? 'bg-indigo-600/15 ml-6' : 'bg-[var(--cos-bg-tertiary)] mr-6'
              }`}
            >
              <p className="text-xs text-[var(--cos-text-muted)] mb-1">
                {msg.role === 'user' ? 'You' : 'Claude'}
              </p>
              <p className="text-[var(--cos-text-primary)] whitespace-pre-wrap">{msg.content}</p>
            </div>
          ))
        )}
        {chatLoading && (
          <div className="bg-[var(--cos-bg-tertiary)] mr-6 p-2.5 rounded-md">
            <p className="text-xs text-[var(--cos-text-muted)] mb-1">Claude</p>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--cos-border)]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Claude..."
            disabled={chatLoading}
            className="flex-1 px-3 py-2 text-sm bg-[var(--cos-bg-tertiary)] border border-[var(--cos-border)] rounded-md text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <Button
            variant="primary"
            size="md"
            onClick={handleSend}
            disabled={chatLoading || !input.trim()}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * ActionLogPanel — registered for the "action-log" panel contribution.
 */
export function ActionLogPanel(): React.JSX.Element {
  return (
    <div className="p-3">
      <div className="text-center py-12">
        <p className="text-sm text-[var(--cos-text-muted)]">
          Action log will appear here when automation is running
        </p>
      </div>
    </div>
  )
}
