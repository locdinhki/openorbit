import type { StateCreator } from 'zustand'
import type { ChatSession } from '../../chat-types'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSlice {
  messages: ChatMessage[]
  chatLoading: boolean
  chatView: 'list' | 'conversation'
  sessions: ChatSession[]
  activeSessionId: string | null
  sessionsLoading: boolean
  addMessage: (message: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearMessages: () => void
  setChatView: (view: 'list' | 'conversation') => void
  setSessions: (sessions: ChatSession[]) => void
  setActiveSessionId: (id: string | null) => void
  setSessionsLoading: (loading: boolean) => void
  addSession: (session: ChatSession) => void
  removeSession: (id: string) => void
  updateSessionTitle: (id: string, title: string) => void
  setMessages: (messages: ChatMessage[]) => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  messages: [],
  chatLoading: false,
  chatView: 'conversation',
  sessions: [],
  activeSessionId: null,
  sessionsLoading: false,
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  clearMessages: () => set({ messages: [] }),
  setChatView: (view) => set({ chatView: view }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (id) => set({ activeSessionId: id }),
  setSessionsLoading: (loading) => set({ sessionsLoading: loading }),
  addSession: (session) => set((state) => ({ sessions: [session, ...state.sessions] })),
  removeSession: (id) => set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) })),
  updateSessionTitle: (id, title) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s))
    })),
  setMessages: (messages) => set({ messages })
})
