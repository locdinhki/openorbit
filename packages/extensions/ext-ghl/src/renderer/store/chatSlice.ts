import type { StateCreator } from 'zustand'
import { ipc } from '../lib/ipc-client'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSlice {
  chatMessages: ChatMessage[]
  chatLoading: boolean
  sendChatMessage: (message: string) => Promise<void>
  clearChat: () => void
}

export const createChatSlice: StateCreator<ChatSlice> = (set, _get) => ({
  chatMessages: [],
  chatLoading: false,

  sendChatMessage: async (message) => {
    set((s) => ({
      chatMessages: [...s.chatMessages, { role: 'user', content: message }],
      chatLoading: true
    }))
    const res = await ipc.chat.send(message)
    if (res.success && res.data) {
      set((s) => ({
        chatMessages: [...s.chatMessages, { role: 'assistant', content: res.data as string }],
        chatLoading: false
      }))
    } else {
      set((s) => ({
        chatMessages: [
          ...s.chatMessages,
          { role: 'assistant', content: res.error ?? 'Failed to get response' }
        ],
        chatLoading: false
      }))
    }
  },

  clearChat: () => {
    ipc.chat.clear()
    set({ chatMessages: [] })
  }
})
