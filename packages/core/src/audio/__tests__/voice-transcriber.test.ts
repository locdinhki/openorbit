// ============================================================================
// OpenOrbit — VoiceTranscriber Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock child_process
const mockSpawn = vi.fn()
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args)
}))

// Mock fs
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('Transcribed text content'),
  statSync: vi.fn().mockReturnValue({ size: 1024 }),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readdirSync: vi.fn().mockReturnValue([]),
  rmSync: vi.fn()
}))

// Mock fetch for API fallback
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { VoiceTranscriber } from '../voice-transcriber'
import { readFileSync, statSync, existsSync } from 'fs'

describe('VoiceTranscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(statSync).mockReturnValue({ size: 1024 } as unknown as ReturnType<typeof statSync>)
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('Transcribed text content')
  })

  // -------------------------------------------------------------------------
  // isAvailable
  // -------------------------------------------------------------------------

  describe('isAvailable', () => {
    it('returns true when whisper CLI is in PATH', async () => {
      mockSpawn.mockReturnValue(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.isAvailable()

      expect(result).toBe(true)
      expect(mockSpawn).toHaveBeenCalledWith('whisper', ['--help'], { stdio: 'ignore' })
    })

    it('returns false when whisper CLI is not found', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.isAvailable()

      expect(result).toBe(false)
    })

    it('returns false when whisper CLI exits with non-zero', async () => {
      mockSpawn.mockReturnValue(makeProcess({ exitCode: 1 }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.isAvailable()

      expect(result).toBe(false)
    })

    it('caches the result on subsequent calls', async () => {
      mockSpawn.mockReturnValue(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber()
      await transcriber.isAvailable()
      await transcriber.isAvailable()

      // spawn should only be called once (cached)
      expect(mockSpawn).toHaveBeenCalledTimes(1)
    })
  })

  // -------------------------------------------------------------------------
  // isEnabled
  // -------------------------------------------------------------------------

  describe('isEnabled', () => {
    it('returns true when CLI is available', async () => {
      mockSpawn.mockReturnValue(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.isEnabled()

      expect(result).toBe(true)
    })

    it('returns true when API key is provided', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))

      const transcriber = new VoiceTranscriber({ openaiApiKey: 'sk-test' })
      const result = await transcriber.isEnabled()

      expect(result).toBe(true)
    })

    it('returns false when neither CLI nor API key available', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.isEnabled()

      expect(result).toBe(false)
    })
  })

  // -------------------------------------------------------------------------
  // transcribe — CLI
  // -------------------------------------------------------------------------

  describe('transcribe (CLI)', () => {
    it('transcribes audio file and returns result', async () => {
      // First call: isAvailable check
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))
      // Second call: actual transcription
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber({ model: 'tiny' })
      const result = await transcriber.transcribe('/tmp/test.wav')

      expect(result.transcript).toBe('Transcribed text content')
      expect(result.model).toBe('whisper-tiny')
      expect(result.durationSeconds).toBeGreaterThanOrEqual(0)

      // Verify whisper was called with correct args
      const whisperCall = mockSpawn.mock.calls[1]
      expect(whisperCall[0]).toBe('whisper')
      expect(whisperCall[1]).toContain('/tmp/test.wav')
      expect(whisperCall[1]).toContain('--model')
      expect(whisperCall[1]).toContain('tiny')
      expect(whisperCall[1]).toContain('--output_format')
      expect(whisperCall[1]).toContain('txt')
    })

    it('rejects files that are too large', async () => {
      vi.mocked(statSync).mockReturnValue({ size: 30 * 1024 * 1024 } as unknown as ReturnType<
        typeof statSync
      >) // 30MB

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/huge.wav')).rejects.toThrow('Audio file too large')
    })

    it('throws on Whisper CLI error exit', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // isAvailable
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 1, stderr: 'Model not found' })) // transcribe

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow(
        'Whisper exited with code 1'
      )
    })

    it('throws on Whisper spawn error', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // isAvailable
      mockSpawn.mockReturnValueOnce(makeProcess({ error: new Error('spawn failed') })) // transcribe

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow(
        'Whisper CLI error: spawn failed'
      )
    })

    it('throws when output file not found', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // isAvailable
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // transcribe

      // existsSync returns false for the output .txt file check
      vi.mocked(existsSync).mockReturnValue(false)

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow(
        'Whisper output file not found'
      )
    })

    it('times out and kills process', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // isAvailable

      const killFn = vi.fn()
      mockSpawn.mockReturnValueOnce(makeProcess({ hang: true, kill: killFn })) // transcribe — never resolves

      const transcriber = new VoiceTranscriber({ timeoutMs: 50 })
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow('timed out')
      expect(killFn).toHaveBeenCalledWith('SIGKILL')
    })

    it('uses configurable model', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // isAvailable
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 })) // transcribe

      const transcriber = new VoiceTranscriber({ model: 'medium' })
      const result = await transcriber.transcribe('/tmp/test.wav')

      expect(result.model).toBe('whisper-medium')
      const whisperCall = mockSpawn.mock.calls[1]
      expect(whisperCall[1]).toContain('medium')
    })
  })

  // -------------------------------------------------------------------------
  // transcribe — API fallback
  // -------------------------------------------------------------------------

  describe('transcribe (API fallback)', () => {
    it('falls back to API when CLI is unavailable', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ text: 'API transcribed text' })
      })

      const transcriber = new VoiceTranscriber({ openaiApiKey: 'sk-test-key' })
      const result = await transcriber.transcribe('/tmp/test.wav')

      expect(result.transcript).toBe('API transcribed text')
      expect(result.model).toBe('whisper-1-api')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/transcriptions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test-key'
          })
        })
      )
    })

    it('throws on API error', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid API key')
      })

      const transcriber = new VoiceTranscriber({ openaiApiKey: 'sk-bad' })
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow(
        'OpenAI Whisper API error (401)'
      )
    })

    it('throws when no transcription method available', async () => {
      mockSpawn.mockReturnValue(makeProcess({ error: new Error('ENOENT') }))

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow(
        'No transcription method available'
      )
    })
  })

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  describe('defaults', () => {
    it('uses tiny model by default', async () => {
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber()
      const result = await transcriber.transcribe('/tmp/test.wav')
      expect(result.model).toBe('whisper-tiny')
    })

    it('uses 20MB max file size by default', async () => {
      vi.mocked(statSync).mockReturnValue({ size: 21 * 1024 * 1024 } as unknown as ReturnType<
        typeof statSync
      >)

      const transcriber = new VoiceTranscriber()
      await expect(transcriber.transcribe('/tmp/test.wav')).rejects.toThrow('Audio file too large')
    })

    it('allows custom max file size', async () => {
      vi.mocked(statSync).mockReturnValue({ size: 5 * 1024 * 1024 } as unknown as ReturnType<
        typeof statSync
      >) // 5MB
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))
      mockSpawn.mockReturnValueOnce(makeProcess({ exitCode: 0 }))

      const transcriber = new VoiceTranscriber({ maxFileSize: 10 * 1024 * 1024 })
      const result = await transcriber.transcribe('/tmp/test.wav')
      expect(result.transcript).toBe('Transcribed text content')
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockProcessOptions {
  exitCode?: number
  error?: Error
  stderr?: string
  hang?: boolean
  kill?: ReturnType<typeof vi.fn>
}

type EventCallback = (...args: unknown[]) => void

function makeProcess(opts: MockProcessOptions): unknown {
  const listeners: Record<string, EventCallback[]> = {}
  const stderrListeners: Record<string, EventCallback[]> = {}

  const process = {
    on: (event: string, cb: EventCallback) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(cb)

      // Trigger events asynchronously
      if (!opts.hang) {
        queueMicrotask(() => {
          if (event === 'error' && opts.error) {
            cb(opts.error)
          }
          if (event === 'close' && opts.exitCode !== undefined && !opts.error) {
            // Send stderr first
            if (opts.stderr && stderrListeners['data']) {
              for (const fn of stderrListeners['data']) {
                fn(Buffer.from(opts.stderr))
              }
            }
            cb(opts.exitCode)
          }
        })
      }
      return process
    },
    stderr: {
      on: (event: string, cb: EventCallback) => {
        if (!stderrListeners[event]) stderrListeners[event] = []
        stderrListeners[event].push(cb)
        return process.stderr
      }
    },
    kill: opts.kill ?? vi.fn(),
    pid: 12345
  }

  return process
}
