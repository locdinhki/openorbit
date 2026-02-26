// ============================================================================
// OpenOrbit Shell — React Hooks for AI Provider Registry
// ============================================================================

import { useState, useCallback, useEffect, useRef } from 'react'
import { ipc } from './ipc-client'
import type {
  AICompletionResponse,
  AIProviderInfo,
  AIStreamChunk,
  ModelTier
} from '@openorbit/core/ai/provider-types'

// ---------------------------------------------------------------------------
// useAIProviders — list & manage providers
// ---------------------------------------------------------------------------

export function useAIProviders() {
  const [providers, setProviders] = useState<AIProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const res = await ipc.ai.providers()
    if (res.success && res.data) {
      setProviders(res.data)
    } else {
      setError(res.error ?? 'Failed to load providers')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setDefault = useCallback(
    async (providerId: string) => {
      const res = await ipc.ai.setDefault(providerId)
      if (res.success) await refresh()
      return res
    },
    [refresh]
  )

  return { providers, loading, error, refresh, setDefault }
}

// ---------------------------------------------------------------------------
// useAIComplete — single-turn completion
// ---------------------------------------------------------------------------

export function useAIComplete() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AICompletionResponse | null>(null)

  const complete = useCallback(
    async (request: {
      systemPrompt: string
      userMessage: string
      tier?: ModelTier
      maxTokens?: number
      task?: string
      providerId?: string
    }) => {
      setLoading(true)
      setError(null)
      setResult(null)
      const res = await ipc.ai.complete(request)
      if (res.success && res.data) {
        setResult(res.data)
      } else {
        setError(res.error ?? 'Completion failed')
      }
      setLoading(false)
      return res
    },
    []
  )

  return { complete, result, loading, error }
}

// ---------------------------------------------------------------------------
// useAIChat — multi-turn chat with history
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export function useAIChat(systemPrompt: string, tier: ModelTier = 'standard') {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = { role: 'user', content }
      const updated = [...messages, userMsg]
      setMessages(updated)
      setLoading(true)
      setError(null)

      const res = await ipc.ai.chat({
        systemPrompt,
        messages: updated,
        tier,
        task: 'chat'
      })

      if (res.success && res.data) {
        setMessages((prev) => [...prev, { role: 'assistant', content: res.data!.content }])
      } else {
        setError(res.error ?? 'Chat failed')
        // Remove the user message on failure
        setMessages((prev) => prev.slice(0, -1))
      }
      setLoading(false)
      return res
    },
    [messages, systemPrompt, tier]
  )

  const clearHistory = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return { messages, sendMessage, clearHistory, loading, error }
}

// ---------------------------------------------------------------------------
// useAIStream — streaming completion
// ---------------------------------------------------------------------------

export function useAIStream() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [result, setResult] = useState<AICompletionResponse | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)

  const stream = useCallback(
    async (request: {
      systemPrompt: string
      userMessage: string
      tier?: ModelTier
      maxTokens?: number
      task?: string
      providerId?: string
    }) => {
      setLoading(true)
      setError(null)
      setContent('')
      setResult(null)

      // Listen for stream chunks
      unsubRef.current?.()
      unsubRef.current = ipc.ai.onStreamChunk((chunk: AIStreamChunk) => {
        if (chunk.delta) {
          setContent((prev) => prev + chunk.delta)
        }
      })

      const res = await ipc.ai.stream(request)
      unsubRef.current?.()
      unsubRef.current = null

      if (res.success && res.data) {
        setResult(res.data)
        setContent(res.data.content)
      } else {
        setError(res.error ?? 'Stream failed')
      }
      setLoading(false)
      return res
    },
    []
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unsubRef.current?.()
    }
  }, [])

  return { stream, content, result, loading, error }
}
