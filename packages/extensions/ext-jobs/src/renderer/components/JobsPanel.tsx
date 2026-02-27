import { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import { useSessions } from '../hooks/useSessions'
import { useAIProviders } from '@renderer/lib/use-ai'
import SvgIcon from '@renderer/components/shared/SvgIcon'
import MarkdownRenderer from '@renderer/components/shared/MarkdownRenderer'
import type { ChatSession } from '../../chat-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// SessionsListView
// ---------------------------------------------------------------------------

function SessionsListView({
  sessions,
  loading,
  onOpen,
  onDelete
}: {
  sessions: ChatSession[]
  loading: boolean
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}): React.JSX.Element {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (loading && sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-[var(--cos-text-muted)]">Loading...</p>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 space-y-3">
        <div className="w-10 h-10 rounded-lg bg-[var(--cos-bg-tertiary)] flex items-center justify-center text-[var(--cos-text-muted)]">
          <SvgIcon name="message-circle" size={20} />
        </div>
        <p className="text-sm text-[var(--cos-text-muted)]">No conversations yet</p>
        <p className="text-xs text-[var(--cos-text-muted)]">Start a new chat to begin</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onOpen(session.id)}
          onMouseEnter={() => setHoveredId(session.id)}
          onMouseLeave={() => setHoveredId(null)}
          className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-[var(--cos-bg-hover)] transition-colors border-b border-[var(--cos-border-light)]"
        >
          <div className="flex-shrink-0 mt-0.5 text-[var(--cos-text-muted)]">
            <SvgIcon name="message-circle" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[var(--cos-text-primary)] truncate">
                {session.title}
              </p>
              <span className="text-[10px] text-[var(--cos-text-muted)] flex-shrink-0">
                {relativeTime(session.updatedAt)}
              </span>
            </div>
            {session.lastMessage && (
              <p className="text-xs text-[var(--cos-text-muted)] truncate mt-0.5">
                {session.lastMessage.slice(0, 100)}
              </p>
            )}
          </div>
          {hoveredId === session.id && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(session.id)
              }}
              className="flex-shrink-0 p-1 rounded hover:bg-[var(--cos-bg-tertiary)] text-[var(--cos-text-muted)] hover:text-red-400 transition-colors"
            >
              <SvgIcon name="trash" size={14} />
            </button>
          )}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ConversationView
// ---------------------------------------------------------------------------

function ConversationView({
  hasAI,
  providersLoading,
  activeProviderName
}: {
  hasAI: boolean
  providersLoading: boolean
  activeProviderName: string
}): React.JSX.Element {
  const { messages, chatLoading, sendMessage } = useChat()
  const { providers, setDefault } = useAIProviders()
  const [input, setInput] = useState('')
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const configuredProviders = providers.filter((p) => p.configured)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, chatLoading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = '0'
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`
  }, [input])

  // Close provider menu on outside click
  useEffect(() => {
    if (!providerMenuOpen) return
    const handleClick = (e: MouseEvent): void => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProviderMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [providerMenuOpen])

  const handleSend = (): void => {
    if (!input.trim() || chatLoading || !hasAI) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleProviderSwitch = (providerId: string): void => {
    setDefault(providerId)
    setProviderMenuOpen(false)
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            {!providersLoading && hasAI ? (
              <>
                <div className="w-10 h-10 rounded-lg bg-indigo-600/15 flex items-center justify-center text-indigo-400">
                  <SvgIcon name="sparkles" size={20} />
                </div>
                <p className="text-sm text-[var(--cos-text-muted)]">
                  Ask about jobs, strategies, or anything
                </p>
              </>
            ) : !providersLoading && !hasAI ? (
              <>
                <div className="w-10 h-10 rounded-lg bg-[var(--cos-bg-tertiary)] flex items-center justify-center text-[var(--cos-text-muted)]">
                  <SvgIcon name="sparkles" size={20} />
                </div>
                <p className="text-sm text-[var(--cos-text-secondary)]">No AI provider connected</p>
                <p className="text-xs text-[var(--cos-text-muted)] text-center">
                  Enable an AI extension in the Extensions panel to use chat
                </p>
              </>
            ) : null}
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
                {msg.role === 'user' ? 'You' : activeProviderName}
              </p>
              {msg.role === 'assistant' ? (
                <MarkdownRenderer content={msg.content} />
              ) : (
                <p className="text-[var(--cos-text-primary)] whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
          ))
        )}
        {chatLoading && (
          <div className="bg-[var(--cos-bg-tertiary)] mr-6 p-2.5 rounded-md">
            <p className="text-xs text-[var(--cos-text-muted)] mb-1">{activeProviderName}</p>
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce [animation-delay:0.1s]" />
              <span className="w-1.5 h-1.5 bg-[var(--cos-text-muted)] rounded-full animate-bounce [animation-delay:0.2s]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — VS Code-style bordered box */}
      <div className="relative p-3" ref={menuRef}>
        {providerMenuOpen && (
          <div className="absolute bottom-full left-3 mb-1 min-w-[200px] py-1 rounded-md bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] shadow-lg z-20">
            {configuredProviders.map((p, i) => (
              <button
                key={p.id}
                onClick={() => handleProviderSwitch(p.id)}
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--cos-bg-hover)] transition-colors whitespace-nowrap"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    i === 0 ? 'bg-green-400' : 'bg-[var(--cos-text-muted)]'
                  }`}
                />
                <span
                  className={
                    i === 0 ? 'text-[var(--cos-text-primary)]' : 'text-[var(--cos-text-secondary)]'
                  }
                >
                  {p.displayName}
                </span>
                {i === 0 && (
                  <span className="ml-auto text-[10px] text-[var(--cos-text-muted)]">default</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          className={`rounded-lg border transition-colors ${
            hasAI
              ? 'border-[var(--cos-border)] focus-within:border-indigo-500/50'
              : 'border-[var(--cos-border)] opacity-60'
          } bg-[var(--cos-bg-tertiary)]`}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasAI ? 'Ask a question...' : 'Enable an AI provider to chat'}
            disabled={chatLoading || !hasAI}
            rows={1}
            style={{ resize: 'none' }}
            className="w-full px-3 pt-3 pb-2 text-sm bg-transparent text-[var(--cos-text-primary)] placeholder-[var(--cos-text-muted)] focus:outline-none disabled:cursor-not-allowed"
          />

          <div className="flex items-center justify-between px-3 pb-2.5">
            {hasAI ? (
              <button
                onClick={() => {
                  if (configuredProviders.length > 1) setProviderMenuOpen(!providerMenuOpen)
                }}
                className={`flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                  configuredProviders.length > 1
                    ? 'text-[var(--cos-text-secondary)] hover:bg-[var(--cos-bg-hover)] cursor-pointer'
                    : 'text-[var(--cos-text-muted)] cursor-default'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                <span className="whitespace-nowrap">{activeProviderName}</span>
                {configuredProviders.length > 1 && (
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    className="opacity-50 flex-shrink-0"
                  >
                    <path d="M3 4l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                )}
              </button>
            ) : (
              <span className="text-[11px] px-2 py-0.5 text-[var(--cos-text-muted)]">
                No AI provider
              </span>
            )}

            <button
              onClick={handleSend}
              disabled={chatLoading || !input.trim() || !hasAI}
              className="p-1.5 rounded-md text-[var(--cos-text-muted)] hover:text-indigo-400 hover:bg-indigo-600/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--cos-text-muted)] transition-colors flex-shrink-0"
            >
              <SvgIcon name="send" size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ChatPanel — two-view container
// ---------------------------------------------------------------------------

/**
 * ChatPanel — registered for the "jobs-chat" panel contribution.
 * Two-view pattern: sessions list ↔ conversation detail.
 */
export function ChatPanel(): React.JSX.Element {
  const { providers, loading: providersLoading } = useAIProviders()
  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    chatView,
    openSession,
    newChat,
    showSessionsList,
    deleteSession
  } = useSessions()

  const configuredProviders = providers.filter((p) => p.configured)
  const activeProvider =
    configuredProviders.find((p) => p.isDefault) ?? configuredProviders[0] ?? null
  const hasAI = activeProvider !== null
  const activeProviderName = activeProvider?.displayName ?? 'AI'

  // Determine header title
  const sessionTitle =
    chatView === 'list'
      ? 'Chat History'
      : (sessions.find((s) => s.id === activeSessionId)?.title ?? 'New Chat')

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--cos-border-light)]">
        {/* Back arrow (conversation view only) */}
        {chatView === 'conversation' && (
          <button
            onClick={showSessionsList}
            className="p-1 rounded hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] transition-colors"
          >
            <SvgIcon name="arrow-left" size={16} />
          </button>
        )}

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-[var(--cos-text-primary)] truncate">
          {sessionTitle}
        </span>

        {/* New chat button */}
        <button
          onClick={newChat}
          className="p-1 rounded hover:bg-[var(--cos-bg-hover)] text-[var(--cos-text-muted)] hover:text-[var(--cos-text-primary)] transition-colors"
          title="New chat"
        >
          <SvgIcon name="plus" size={16} />
        </button>
      </div>

      {/* Body: switch between views */}
      {chatView === 'list' ? (
        <SessionsListView
          sessions={sessions}
          loading={sessionsLoading}
          onOpen={openSession}
          onDelete={deleteSession}
        />
      ) : (
        <ConversationView
          hasAI={hasAI}
          providersLoading={providersLoading}
          activeProviderName={activeProviderName}
        />
      )}
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
