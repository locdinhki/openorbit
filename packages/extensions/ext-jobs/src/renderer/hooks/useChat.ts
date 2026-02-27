import { useCallback } from 'react'
import { v4 as uuid } from 'uuid'
import { useStore } from '../store'
import { ipc } from '../lib/ipc-client'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useChat() {
  const {
    messages,
    chatLoading,
    addMessage,
    setChatLoading,
    clearMessages,
    activeSessionId,
    setActiveSessionId,
    addSession
  } = useStore()
  const { selectedJobId, jobs, updateJob } = useStore()

  const selectedJob = selectedJobId ? (jobs.find((j) => j.id === selectedJobId) ?? null) : null

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || chatLoading) return

      // Auto-create session if none active
      if (!activeSessionId) {
        try {
          const result = await ipc.sessions.create()
          if (result.success && result.data) {
            setActiveSessionId(result.data.id)
            addSession(result.data)
          }
        } catch {
          // Continue without session persistence
        }
      }

      // Add user message to store
      addMessage({
        id: uuid(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString()
      })

      setChatLoading(true)
      try {
        const result = await ipc.chat.send(content.trim(), selectedJobId ?? undefined)

        if (result.success && result.data) {
          addMessage({
            id: uuid(),
            role: 'assistant',
            content: result.data,
            timestamp: new Date().toISOString()
          })
        } else {
          addMessage({
            id: uuid(),
            role: 'assistant',
            content: `Error: ${result.error ?? 'Failed to get response'}`,
            timestamp: new Date().toISOString()
          })
        }
      } catch (err) {
        addMessage({
          id: uuid(),
          role: 'assistant',
          content: `Error: ${String(err)}`,
          timestamp: new Date().toISOString()
        })
      } finally {
        setChatLoading(false)
      }
    },
    [
      chatLoading,
      selectedJobId,
      activeSessionId,
      addMessage,
      setChatLoading,
      setActiveSessionId,
      addSession
    ]
  )

  const analyzeJob = useCallback(
    async (jobId: string) => {
      setChatLoading(true)
      try {
        const result = await ipc.chat.analyzeJob(jobId)

        if (result.success && result.data) {
          updateJob(jobId, result.data)
          return result.data
        } else {
          throw new Error(result.error ?? 'Analysis failed')
        }
      } finally {
        setChatLoading(false)
      }
    },
    [setChatLoading, updateJob]
  )

  return {
    messages,
    chatLoading,
    selectedJob,
    sendMessage,
    analyzeJob,
    clearMessages
  }
}
