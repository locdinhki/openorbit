import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { Message } from '../../../main/sdk/types'
import Button from '@renderer/components/shared/Button'

interface Props {
  conversationId: string
  contactId: string
}

async function fetchMessages(conversationId: string): Promise<Message[]> {
  const res = await ipc.conversations.messages(conversationId, 50)
  if (res.success && res.data) {
    return res.data
  }
  return []
}

export default function ConversationThread({
  conversationId,
  contactId
}: Props): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [msgType, setMsgType] = useState<'SMS' | 'Email'>('SMS')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    async function loadMessages(): Promise<void> {
      setLoading(true)
      const data = await fetchMessages(conversationId)
      setMessages(data)
      setLoading(false)
    }
    loadMessages()
  }, [conversationId])

  const handleSend = async (): Promise<void> => {
    if (!text.trim()) return
    setSending(true)
    await ipc.conversations.send(contactId, msgType, text.trim())
    setText('')
    setSending(false)
    const data = await fetchMessages(conversationId)
    setMessages(data)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="text-xs text-[var(--cos-text-muted)] text-center">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-xs text-[var(--cos-text-muted)] text-center">No messages</div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[75%] px-3 py-2 rounded-lg text-xs ${
                msg.direction === 'outbound'
                  ? 'ml-auto bg-indigo-600/20 text-indigo-200'
                  : 'mr-auto bg-[var(--cos-bg-secondary)] text-[var(--cos-text-primary)]'
              }`}
            >
              <div>{msg.body}</div>
              {msg.dateAdded && (
                <div className="text-[10px] text-[var(--cos-text-muted)] mt-1">
                  {new Date(msg.dateAdded).toLocaleString()}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Send Box */}
      <div className="border-t border-[var(--cos-border)] p-3 flex gap-2">
        <select
          value={msgType}
          onChange={(e) => setMsgType(e.target.value as 'SMS' | 'Email')}
          className="px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)]"
        >
          <option value="SMS">SMS</option>
          <option value="Email">Email</option>
        </select>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          className="flex-1 px-2 py-1.5 text-xs bg-[var(--cos-bg-secondary)] border border-[var(--cos-border)] rounded text-[var(--cos-text-primary)] placeholder:text-[var(--cos-text-muted)] focus:outline-none focus:border-indigo-500"
        />
        <Button size="sm" variant="primary" onClick={handleSend} disabled={sending || !text.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
