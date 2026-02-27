import type { StateCreator } from 'zustand'
import type { ChatMessage } from '../lib/types'

export interface ChatSlice {
  messages: ChatMessage[]
  chatLoading: boolean
  addMessage: (msg: ChatMessage) => void
  setMessages: (msgs: ChatMessage[]) => void
  setChatLoading: (loading: boolean) => void
  clearMessages: () => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set) => ({
  messages: [],
  chatLoading: false,
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (messages) => set({ messages }),
  setChatLoading: (chatLoading) => set({ chatLoading }),
  clearMessages: () => set({ messages: [] })
})
