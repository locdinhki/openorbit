// Shared types for chat sessions — importable from both main and renderer

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  lastMessage?: string
  messageCount?: number
}

export interface ChatSessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}
