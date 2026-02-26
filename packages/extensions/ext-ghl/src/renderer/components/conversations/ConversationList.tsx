import { useState, useEffect } from 'react'
import { ipc } from '../../lib/ipc-client'
import type { Conversation } from '../../../main/sdk/types'
import Badge from '@renderer/components/shared/Badge'

export default function ConversationList(): React.JSX.Element {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    async function loadConversations(): Promise<void> {
      setLoading(true)
      const res = await ipc.conversations.list({ limit: 50 })
      if (res.success && res.data) {
        setConversations(res.data)
      }
      setLoading(false)
    }
    loadConversations()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
        Loading conversations...
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-[var(--cos-text-muted)]">
        No conversations found
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          onClick={() => setSelectedId(conv.id)}
          className={`w-full px-3 py-2 text-left hover:bg-[var(--cos-bg-hover)] cursor-pointer transition-colors border-b border-[var(--cos-border)] ${
            selectedId === conv.id ? 'bg-[var(--cos-bg-hover)]' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--cos-text-primary)] truncate">
              {conv.contactId}
            </span>
            {conv.unreadCount != null && conv.unreadCount > 0 && (
              <Badge variant="info">{conv.unreadCount}</Badge>
            )}
          </div>
          {conv.lastMessageBody && (
            <div className="text-[10px] text-[var(--cos-text-muted)] truncate mt-0.5">
              {conv.lastMessageBody.slice(0, 60)}
            </div>
          )}
          {conv.lastMessageDate && (
            <div className="text-[10px] text-[var(--cos-text-muted)] mt-0.5">
              {new Date(conv.lastMessageDate).toLocaleString()}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
