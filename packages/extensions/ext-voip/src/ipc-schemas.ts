// ============================================================================
// ext-voip — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

// Phone number in E.164 format
const e164Phone = z.string().regex(/^\+[1-9]\d{1,14}$/, 'Invalid E.164 phone number format')

export const extVoipSchemas = {
  // Settings
  'ext-voip:settings-get': z.object({}),
  'ext-voip:settings-set': z.object({
    accountSid: z.string().optional(),
    authToken: z.string().optional(),
    phoneNumber: z.string().optional(),
    recordingEnabled: z.boolean().optional(),
    transcriptionEnabled: z.boolean().optional()
  }),
  'ext-voip:connection-test': z.object({}),

  // Calls
  'ext-voip:call-start': z.object({
    to: e164Phone,
    from: e164Phone.optional(),
    contactId: z.string().optional(),
    contactName: z.string().optional(),
    record: z.boolean().optional()
  }),
  'ext-voip:call-end': z.object({
    callId: z.string().min(1)
  }),
  'ext-voip:call-status': z.object({
    callId: z.string().min(1)
  }),
  'ext-voip:calls-list': z.object({
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional(),
    contactId: z.string().optional(),
    status: z
      .enum(['initiated', 'ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer'])
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }),
  'ext-voip:call-get': z.object({
    callId: z.string().min(1)
  }),
  'ext-voip:call-delete': z.object({
    callId: z.string().min(1)
  }),

  // Recordings
  'ext-voip:recording-start': z.object({
    callId: z.string().min(1)
  }),
  'ext-voip:recording-stop': z.object({
    callId: z.string().min(1)
  }),
  'ext-voip:recording-get': z.object({
    recordingId: z.string().min(1)
  }),
  'ext-voip:recording-delete': z.object({
    recordingId: z.string().min(1)
  }),
  'ext-voip:recordings-list': z.object({
    callId: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
    offset: z.number().int().min(0).optional()
  }),

  // Transcription
  'ext-voip:transcription-start': z.object({
    recordingId: z.string().min(1)
  }),
  'ext-voip:transcription-get': z.object({
    recordingId: z.string().min(1)
  }),
  'ext-voip:transcription-status': z.object({
    recordingId: z.string().min(1)
  }),

  // Analytics
  'ext-voip:analytics-summary': z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional()
  }),
  'ext-voip:analytics-by-contact': z.object({
    contactId: z.string().min(1)
  })
} as const
