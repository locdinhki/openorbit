import type { StateCreator } from 'zustand'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface ChatSlice {
  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (message: ChatMessage) => void
  setChatLoading: (loading: boolean) => void
  clearMessages: () => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  messages: [],
  chatLoading: false,
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  clearMessages: () => set({ messages: [] })
})
