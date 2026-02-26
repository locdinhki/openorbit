import { useState, useCallback, useRef } from 'react'
import { IPC } from '@openorbit/core/ipc-channels'
import { ipc } from '@renderer/lib/ipc-client'

const STALE_TIMEOUT_MS = 10_000

interface FramePayload {
  platform?: string
  data: string
}

export function useLiveView(): {
  /** User has opened the live view UI (gallery or detail). */
  liveMode: boolean
  /** A screencast is actively streaming for the focused platform. */
  isStreaming: boolean
  /** Latest frame for the focused platform (detail view). */
  currentFrame: string | null
  /** Currently focused platform (null = gallery mode). */
  focusedPlatform: string | null
  stale: boolean
  error: string | null
  /** Last captured frame per platform (static thumbnails for gallery). */
  framesByPlatform: Record<string, string>
  /** Platforms available in live mode. */
  availablePlatforms: string[]
  enterLiveMode: (platforms: string[]) => void
  exitLiveMode: () => Promise<void>
  /** Focus a platform — starts its screencast. Pass null to return to gallery (stops screencast). */
  setFocusedPlatform: (platform: string | null) => Promise<void>
} {
  const [liveMode, setLiveMode] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentFrame, setCurrentFrame] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [framesByPlatform, setFramesByPlatform] = useState<Record<string, string>>({})
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([])
  const [focusedPlatform, setFocusedPlatformState] = useState<string | null>(null)

  const framesRef = useRef<Record<string, string>>({})
  const focusedRef = useRef<string | null>(null)
  const focusedFrameRef = useRef<string | null>(null)
  const rafRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingPlatformRef = useRef<string | null>(null)

  const resetStaleTimer = (): void => {
    if (staleTimerRef.current) clearTimeout(staleTimerRef.current)
    setStale(false)
    staleTimerRef.current = setTimeout(() => setStale(true), STALE_TIMEOUT_MS)
  }

  const setupFrameListener = (): void => {
    if (cleanupRef.current) return
    cleanupRef.current = window.api.on(IPC.SCREENCAST_FRAME, (payload: unknown) => {
      const frame = payload as FramePayload
      const platform = frame.platform ?? 'default'

      // Keep last frame per platform (for gallery thumbnails after leaving detail)
      framesRef.current = { ...framesRef.current, [platform]: frame.data }

      // Update focused frame if this matches the focused platform
      if (focusedRef.current === platform) {
        focusedFrameRef.current = frame.data
        resetStaleTimer()
      }

      // Throttle React updates via rAF
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(() => {
          setFramesByPlatform({ ...framesRef.current })
          if (focusedRef.current !== null) {
            setCurrentFrame(focusedFrameRef.current)
          }
          rafRef.current = null
        })
      }
    })
  }

  const cleanupListener = (): void => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current)
      staleTimerRef.current = null
    }
  }

  const stopCurrentScreencast = async (): Promise<void> => {
    if (streamingPlatformRef.current) {
      await ipc.screencast.stop(streamingPlatformRef.current)
      streamingPlatformRef.current = null
      setIsStreaming(false)
    }
  }

  const startScreencastFor = async (platform: string): Promise<boolean> => {
    setError(null)
    setupFrameListener()

    const result = await ipc.screencast.start({ platform })
    if (result.success) {
      streamingPlatformRef.current = platform
      setIsStreaming(true)
      resetStaleTimer()
      return true
    }
    setError(result.error ?? `Failed to start live view for ${platform}`)
    return false
  }

  const enterLiveMode = useCallback((platforms: string[]) => {
    setLiveMode(true)
    setAvailablePlatforms(platforms)
    setError(null)
  }, [])

  const exitLiveMode = useCallback(async () => {
    await stopCurrentScreencast()
    cleanupListener()
    framesRef.current = {}
    focusedFrameRef.current = null
    focusedRef.current = null
    streamingPlatformRef.current = null
    setLiveMode(false)
    setIsStreaming(false)
    setCurrentFrame(null)
    setStale(false)
    setFramesByPlatform({})
    setAvailablePlatforms([])
    setFocusedPlatformState(null)
    setError(null)
  }, [])

  const setFocusedPlatform = useCallback(async (platform: string | null) => {
    const prev = focusedRef.current

    // Update refs and state immediately for responsive UI
    focusedRef.current = platform
    setFocusedPlatformState(platform)
    setStale(false)

    if (platform) {
      // Focusing on a platform — stop previous screencast if different, start new one
      if (prev && prev !== platform) {
        await stopCurrentScreencast()
      }
      // Show last captured frame instantly while screencast starts
      if (framesRef.current[platform]) {
        focusedFrameRef.current = framesRef.current[platform]
        setCurrentFrame(framesRef.current[platform])
      } else {
        focusedFrameRef.current = null
        setCurrentFrame(null)
      }
      if (streamingPlatformRef.current !== platform) {
        await startScreencastFor(platform)
      }
    } else {
      // Back to gallery — stop active screencast
      await stopCurrentScreencast()
      focusedFrameRef.current = null
      setCurrentFrame(null)
    }
  }, [])

  return {
    liveMode,
    isStreaming,
    currentFrame,
    focusedPlatform,
    stale,
    error,
    framesByPlatform,
    availablePlatforms,
    enterLiveMode,
    exitLiveMode,
    setFocusedPlatform
  }
}
