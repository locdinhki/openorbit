import type { StateCreator } from 'zustand'

export interface MemoryFact {
  id: string
  category: string
  content: string
  source: string
  confidence: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  accessedAt: string
  accessCount: number
}

export interface MemorySlice {
  memoryFacts: MemoryFact[]
  memoryLoading: boolean

  setMemoryFacts: (facts: MemoryFact[]) => void
  addMemoryFact: (fact: MemoryFact) => void
  removeMemoryFact: (id: string) => void
  setMemoryLoading: (loading: boolean) => void
}

export const createMemorySlice: StateCreator<MemorySlice> = (set) => ({
  memoryFacts: [],
  memoryLoading: false,

  setMemoryFacts: (memoryFacts) => set({ memoryFacts }),
  addMemoryFact: (fact) => set((state) => ({ memoryFacts: [fact, ...state.memoryFacts] })),
  removeMemoryFact: (id) =>
    set((state) => ({ memoryFacts: state.memoryFacts.filter((f) => f.id !== id) })),
  setMemoryLoading: (loading) => set({ memoryLoading: loading })
})
