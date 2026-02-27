// ============================================================================
// OpenOrbit — Voice Transcribe Skill
//
// Wraps the existing VoiceTranscriber class as a Skill. Supports local
// Whisper CLI (primary) and OpenAI Whisper API (fallback).
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'
import { VoiceTranscriber } from '../../audio/voice-transcriber'

export function createVoiceTranscribeSkill(extensionId: string): Skill {
  return {
    id: 'voice-transcribe',
    displayName: 'Voice Transcriber',
    icon: 'microphone',
    description:
      'Transcribe an audio file to text using local Whisper CLI or OpenAI Whisper API. Accepts a file path and returns the transcript.',
    category: 'media',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true, // local Whisper CLI works offline
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        audioPath: {
          type: 'string',
          description: 'Absolute path to the audio file to transcribe'
        },
        model: {
          type: 'string',
          description: 'Whisper model size',
          enum: ['tiny', 'base', 'small', 'medium']
        },
        openaiApiKey: {
          type: 'string',
          description: 'OpenAI API key for API fallback (optional)'
        }
      },
      required: ['audioPath']
    },
    outputSchema: {
      type: 'object',
      description: 'Transcription result',
      properties: {
        transcript: {
          type: 'string',
          description: 'The transcribed text'
        },
        durationSeconds: {
          type: 'number',
          description: 'Audio duration in seconds'
        },
        model: {
          type: 'string',
          description: 'Model used for transcription'
        }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const audioPath = input.audioPath as string
      if (!audioPath || typeof audioPath !== 'string') {
        return { success: false, error: 'Missing or invalid audioPath' }
      }

      const model = (input.model as string) ?? undefined
      const openaiApiKey = (input.openaiApiKey as string) ?? undefined

      try {
        const transcriber = new VoiceTranscriber({ model, openaiApiKey })
        const result = await transcriber.transcribe(audioPath)

        return {
          success: true,
          data: result,
          summary: `Transcribed ${result.durationSeconds.toFixed(1)}s of audio using ${result.model}: "${result.transcript.slice(0, 100)}${result.transcript.length > 100 ? '...' : ''}"`
        }
      } catch (err) {
        return {
          success: false,
          error: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
