// ============================================================================
// OpenOrbit — Voice Transcriber
//
// Transcribes audio files to text using local Whisper CLI (primary) or
// OpenAI Whisper API (fallback). No new npm dependencies required.
// ============================================================================

import { spawn } from 'child_process'
import { readFileSync, statSync, existsSync, mkdirSync, rmSync } from 'fs'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptionResult {
  transcript: string
  durationSeconds: number
  model: string
}

export interface VoiceTranscriberOptions {
  model?: string // whisper model: 'tiny' | 'base' | 'small' | 'medium'
  maxFileSize?: number // bytes, default 20MB
  timeoutMs?: number // default 60s
  openaiApiKey?: string // fallback to API if CLI unavailable
}

// ---------------------------------------------------------------------------
// VoiceTranscriber
// ---------------------------------------------------------------------------

export class VoiceTranscriber {
  private model: string
  private maxFileSize: number
  private timeoutMs: number
  private openaiApiKey: string | null
  private cliAvailable: boolean | null = null

  constructor(options?: VoiceTranscriberOptions) {
    this.model = options?.model ?? 'tiny'
    this.maxFileSize = options?.maxFileSize ?? 20 * 1024 * 1024 // 20MB
    this.timeoutMs = options?.timeoutMs ?? 60_000
    this.openaiApiKey = options?.openaiApiKey ?? null
  }

  /**
   * Check if the Whisper CLI is available in PATH.
   */
  async isAvailable(): Promise<boolean> {
    if (this.cliAvailable !== null) return this.cliAvailable

    try {
      const available = await new Promise<boolean>((resolve) => {
        const proc = spawn('whisper', ['--help'], { stdio: 'ignore' })
        proc.on('error', () => resolve(false))
        proc.on('close', (code) => resolve(code === 0))
      })
      this.cliAvailable = available
      return available
    } catch {
      this.cliAvailable = false
      return false
    }
  }

  /**
   * Check if any transcription method is available (CLI or API).
   */
  async isEnabled(): Promise<boolean> {
    if (await this.isAvailable()) return true
    return this.openaiApiKey !== null
  }

  /**
   * Transcribe an audio file to text.
   */
  async transcribe(audioPath: string): Promise<TranscriptionResult> {
    // Validate file exists and size
    const stat = statSync(audioPath)
    if (stat.size > this.maxFileSize) {
      throw new Error(`Audio file too large: ${stat.size} bytes (max: ${this.maxFileSize})`)
    }

    // Try local Whisper CLI first
    if (await this.isAvailable()) {
      return this.transcribeWithCLI(audioPath)
    }

    // Fallback to OpenAI API
    if (this.openaiApiKey) {
      return this.transcribeWithAPI(audioPath)
    }

    throw new Error(
      'No transcription method available. Install Whisper CLI or provide an OpenAI API key.'
    )
  }

  // -------------------------------------------------------------------------
  // Local Whisper CLI
  // -------------------------------------------------------------------------

  private transcribeWithCLI(audioPath: string): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      const outputDir = join(tmpdir(), `whisper-${randomUUID()}`)
      mkdirSync(outputDir, { recursive: true })

      const startTime = Date.now()
      const proc = spawn('whisper', [
        audioPath,
        '--model',
        this.model,
        '--output_format',
        'txt',
        '--output_dir',
        outputDir
      ])

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL')
        cleanup(outputDir)
        reject(new Error(`Whisper transcription timed out after ${this.timeoutMs}ms`))
      }, this.timeoutMs)

      let stderr = ''
      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      proc.on('error', (err) => {
        clearTimeout(timeout)
        cleanup(outputDir)
        reject(new Error(`Whisper CLI error: ${err.message}`))
      })

      proc.on('close', (code) => {
        clearTimeout(timeout)
        const durationSeconds = (Date.now() - startTime) / 1000

        if (code !== 0) {
          cleanup(outputDir)
          reject(new Error(`Whisper exited with code ${code}: ${stderr.slice(0, 200)}`))
          return
        }

        try {
          // Whisper outputs <filename>.txt in the output directory
          const baseName = basename(audioPath).replace(/\.[^.]+$/, '')
          const txtPath = join(outputDir, `${baseName}.txt`)

          if (!existsSync(txtPath)) {
            cleanup(outputDir)
            reject(new Error('Whisper output file not found'))
            return
          }

          const transcript = readFileSync(txtPath, 'utf-8').trim()
          cleanup(outputDir)

          resolve({
            transcript,
            durationSeconds,
            model: `whisper-${this.model}`
          })
        } catch (err) {
          cleanup(outputDir)
          reject(err)
        }
      })
    })
  }

  // -------------------------------------------------------------------------
  // OpenAI Whisper API fallback
  // -------------------------------------------------------------------------

  private async transcribeWithAPI(audioPath: string): Promise<TranscriptionResult> {
    const startTime = Date.now()
    const fileBuffer = readFileSync(audioPath)
    const fileName = basename(audioPath)

    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), fileName)
    formData.append('model', 'whisper-1')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openaiApiKey}`
      },
      body: formData,
      signal: AbortSignal.timeout(this.timeoutMs)
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`OpenAI Whisper API error (${response.status}): ${body.slice(0, 200)}`)
    }

    const data = (await response.json()) as { text: string }
    const durationSeconds = (Date.now() - startTime) / 1000

    return {
      transcript: data.text.trim(),
      durationSeconds,
      model: 'whisper-1-api'
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanup(dir: string): void {
  try {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true })
    }
  } catch {
    // Best-effort cleanup
  }
}
