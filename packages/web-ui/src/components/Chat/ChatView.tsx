import { useRef, useEffect } from 'react'
import { useStore } from '../../store'
import type { ChatMessage, RPCResult } from '../../lib/types'
import MessageBubble from './MessageBubble'
import ChatInput from './ChatInput'

export default function ChatView(): React.JSX.Element {
  const { messages, chatLoading, rpcClient, addMessage, setMessages, setChatLoading } = useStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, chatLoading])

  // Load history on mount
  useEffect(() => {
    if (!rpcClient) return
    rpcClient
      .call<RPCResult<{ role: string; content: string }[]>>('chat.history')
      .then((result) => {
        if (result.success && result.data) {
          const msgs: ChatMessage[] = result.data.map((m, i) => ({
            id: `history-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date().toISOString()
          }))
          setMessages(msgs)
        }
      })
      .catch(() => {})
  }, [rpcClient]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (content: string): Promise<void> => {
    if (!rpcClient || chatLoading) return

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date().toISOString()
    })

    setChatLoading(true)
    try {
      const result = await rpcClient.call<RPCResult<string>>('chat.send', { message: content })
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.success ? (result.data ?? '') : `Error: ${result.error}`,
        timestamp: new Date().toISOString()
      })
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Connection error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString()
      })
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--cos-border)',
          background: 'var(--cos-bg-secondary)'
        }}
      >
        <h2 className="text-sm font-semibold" style={{ color: 'var(--cos-text-primary)' }}>
          AI Assistant
        </h2>
        <p className="text-xs" style={{ color: 'var(--cos-text-muted)' }}>
          Ask about jobs, strategies, or anything
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !chatLoading && (
          <div className="text-center py-16">
            <p className="text-3xl mb-3">&#129302;</p>
            <p className="text-sm" style={{ color: 'var(--cos-text-muted)' }}>
              Start a conversation
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {chatLoading && (
          <div
            className="mr-12 p-3 rounded-xl flex gap-1"
            style={{ background: 'var(--cos-bg-tertiary)' }}
          >
            <span
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--cos-text-muted)' }}
            />
            <span
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--cos-text-muted)', animationDelay: '0.1s' }}
            />
            <span
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: 'var(--cos-text-muted)', animationDelay: '0.2s' }}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} disabled={chatLoading} />
    </div>
  )
}
