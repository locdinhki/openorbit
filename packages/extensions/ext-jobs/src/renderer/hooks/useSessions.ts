import { useCallback } from 'react'
import { useStore } from '../store'
import { ipc } from '../lib/ipc-client'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function useSessions() {
  const {
    sessions,
    sessionsLoading,
    activeSessionId,
    chatView,
    setSessions,
    setSessionsLoading,
    setActiveSessionId,
    setChatView,
    addSession,
    removeSession,
    setMessages,
    clearMessages
  } = useStore()

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const result = await ipc.sessions.list()
      if (result.success && result.data) {
        setSessions(result.data)
      }
    } finally {
      setSessionsLoading(false)
    }
  }, [setSessions, setSessionsLoading])

  const openSession = useCallback(
    async (sessionId: string) => {
      setSessionsLoading(true)
      try {
        const result = await ipc.sessions.load(sessionId)
        if (result.success && result.data) {
          setMessages(
            result.data.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.createdAt
            }))
          )
          setActiveSessionId(sessionId)
          setChatView('conversation')
        }
      } finally {
        setSessionsLoading(false)
      }
    },
    [setMessages, setActiveSessionId, setChatView, setSessionsLoading]
  )

  const newChat = useCallback(async () => {
    try {
      const result = await ipc.sessions.create()
      if (result.success && result.data) {
        addSession(result.data)
        setActiveSessionId(result.data.id)
        clearMessages()
        setChatView('conversation')
      }
    } catch {
      // If IPC fails, just clear locally
      clearMessages()
      setActiveSessionId(null)
      setChatView('conversation')
    }
  }, [addSession, setActiveSessionId, clearMessages, setChatView])

  const showSessionsList = useCallback(async () => {
    setChatView('list')
    await loadSessions()
  }, [setChatView, loadSessions])

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const result = await ipc.sessions.delete(sessionId)
        if (result.success) {
          removeSession(sessionId)
          if (activeSessionId === sessionId) {
            clearMessages()
            setActiveSessionId(null)
          }
        }
      } catch {
        // ignore
      }
    },
    [removeSession, activeSessionId, clearMessages, setActiveSessionId]
  )

  const renameSession = useCallback(async (sessionId: string, title: string) => {
    try {
      await ipc.sessions.rename(sessionId, title)
    } catch {
      // ignore
    }
  }, [])

  return {
    sessions,
    sessionsLoading,
    activeSessionId,
    chatView,
    loadSessions,
    openSession,
    newChat,
    showSessionsList,
    deleteSession,
    renameSession
  }
}
