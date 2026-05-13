// ============================================================================
// ext-hive — AI Agent Chat Panel
// ============================================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { useExtHiveStore, type ChatMessage } from '../store/index'

const SUGGESTIONS = [
  'What devices are online?',
  'Check disk space on all minions',
  'Install python3 on minion-01',
  'Run `uptime` on every device'
]

export default function HiveAgentPanel(): React.JSX.Element {
  const messages = useExtHiveStore((s) => s.chatMessages)
  const loading = useExtHiveStore((s) => s.chatLoading)
  const sendMessage = useExtHiveStore((s) => s.sendChatMessage)
  const clearChat = useExtHiveStore((s) => s.clearChat)

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'
    }
  }, [input])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await sendMessage(text)
  }, [input, loading, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  const handleSuggestion = useCallback(
    (text: string) => {
      if (loading) return
      sendMessage(text)
    },
    [loading, sendMessage]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--cos-border)]">
        <div className="text-xs font-medium text-[var(--cos-text-primary)]">Hive Agent</div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-[11px] text-[var(--cos-text-tertiary)] hover:text-[var(--cos-text-secondary)] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !loading && <EmptyState onSuggestion={handleSuggestion} />}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}

        {loading && <ThinkingIndicator />}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[var(--cos-border)]">
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your fleet..."
            rows={1}
            className="flex-1 px-3 py-2 bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-md text-xs text-[var(--cos-text-primary)] placeholder-[var(--cos-text-tertiary)] resize-none focus:outline-none focus:border-[var(--cos-border-focus)]"
            style={{ maxHeight: 150 }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[var(--cos-accent)] text-white text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }): React.JSX.Element {
  if (message.role === 'system') {
    return (
      <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
        {message.content}
      </div>
    )
  }

  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
          isUser
            ? 'bg-[var(--cos-accent)] text-white'
            : 'bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)] border border-[var(--cos-border)]'
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
      </div>
    </div>
  )
}

function EmptyState({ onSuggestion }: { onSuggestion: (text: string) => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="text-sm text-[var(--cos-text-secondary)] mb-1">Hive Agent</div>
      <div className="text-[11px] text-[var(--cos-text-tertiary)] mb-6">
        Ask me to manage your minion fleet
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-3 py-2 text-left text-[11px] text-[var(--cos-text-secondary)] bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-md hover:border-[var(--cos-border-focus)] transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

function ThinkingIndicator(): React.JSX.Element {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const label =
    elapsed < 3
      ? 'Thinking'
      : elapsed < 8
        ? 'Analyzing fleet data'
        : elapsed < 15
          ? 'Generating response'
          : 'Still working'

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] px-3 py-2.5 bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded-lg">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-4 h-4">
            <div
              className="absolute w-4 h-4 rounded-full border-2 border-[var(--cos-accent)] opacity-30"
              style={{
                animation: 'hive-ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite'
              }}
            />
            <div className="w-2 h-2 rounded-full bg-[var(--cos-accent)]" />
          </div>
          <span className="text-xs text-[var(--cos-text-secondary)]">{label}</span>
          <span className="text-xs text-[var(--cos-text-tertiary)] tabular-nums">{elapsed}s</span>
        </div>
        <style>{`
          @keyframes hive-ping {
            0% { transform: scale(1); opacity: 0.3; }
            75%, 100% { transform: scale(2); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  )
}
