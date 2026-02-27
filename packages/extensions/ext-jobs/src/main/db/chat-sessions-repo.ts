import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'
import type { ChatSession, ChatSessionMessage } from '../../chat-types'

interface SessionRow {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message: string | null
  message_count: number
}

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
}

function rowToSession(row: SessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_message ?? undefined,
    messageCount: row.message_count ?? 0
  }
}

function rowToMessage(row: MessageRow): ChatSessionMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    createdAt: row.created_at
  }
}

export class ChatSessionsRepo {
  constructor(private db: Database.Database) {}

  create(title: string = 'New Chat'): ChatSession {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare('INSERT INTO chat_sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(id, title, now, now)

    return { id, title, createdAt: now, updatedAt: now, messageCount: 0 }
  }

  getById(id: string): ChatSession | null {
    const row = this.db
      .prepare(
        `SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
        FROM chat_sessions s WHERE s.id = ?`
      )
      .get(id) as SessionRow | undefined

    return row ? rowToSession(row) : null
  }

  list(limit: number = 50): ChatSession[] {
    const rows = this.db
      .prepare(
        `SELECT s.*,
          (SELECT content FROM chat_messages WHERE session_id = s.id ORDER BY created_at DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM chat_messages WHERE session_id = s.id) as message_count
        FROM chat_sessions s
        ORDER BY s.updated_at DESC
        LIMIT ?`
      )
      .all(limit) as SessionRow[]

    return rows.map(rowToSession)
  }

  rename(id: string, title: string): void {
    this.db
      .prepare('UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?')
      .run(title, new Date().toISOString(), id)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(id)
  }

  touch(id: string): void {
    this.db
      .prepare('UPDATE chat_sessions SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  }

  addMessage(sessionId: string, role: 'user' | 'assistant', content: string): ChatSessionMessage {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        'INSERT INTO chat_messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, sessionId, role, content, now)

    this.touch(sessionId)

    return { id, sessionId, role, content, createdAt: now }
  }

  getMessages(sessionId: string): ChatSessionMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId) as MessageRow[]

    return rows.map(rowToMessage)
  }
}
