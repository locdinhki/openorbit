// ============================================================================
// OpenOrbit — SMS / MMS Skill
//
// Built-in tool skill for sending SMS and MMS messages via Twilio.
// Supports E.164 phone format, merge fields, and delivery tracking.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'
import { SettingsRepo } from '../../db/settings-repo'

// Type definitions for Twilio (dynamically imported)
interface TwilioMessageInstance {
  sid: string
  status: string
  to: string
  from: string
  body: string
  dateCreated: Date
  errorCode?: number
  errorMessage?: string
}

/**
 * Resolve merge fields in a template string.
 * Replaces {{fieldName}} with values from the data object.
 */
function resolveMergeFields(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, field: string) => {
    const parts = field.split('.')
    let value: unknown = data
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = (value as Record<string, unknown>)[part]
      } else {
        return match // Keep original if field not found
      }
    }
    return value !== undefined && value !== null ? String(value) : match
  })
}

/**
 * Normalize phone number to E.164 format.
 * Handles common US formats and adds +1 if missing country code.
 */
function normalizeToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')

  // If already has country code (11+ digits starting with 1 for US)
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  // If 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`
  }

  // If already has + prefix, return as-is
  if (phone.startsWith('+')) {
    return `+${digits}`
  }

  // Return with + prefix for international numbers
  return `+${digits}`
}

/**
 * Validate E.164 phone number format.
 */
function isValidE164(phone: string): boolean {
  // E.164: + followed by 1-15 digits
  return /^\+[1-9]\d{1,14}$/.test(phone)
}

export function createSmsMmsSkill(extensionId: string): Skill {
  return {
    id: 'sms-mms',
    displayName: 'SMS / MMS',
    icon: 'message-circle',
    description:
      'Send SMS and MMS messages via Twilio. Supports E.164 phone format, merge fields, and media attachments.',
    category: 'communication',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: false,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient phone number in E.164 format (e.g., +15551234567)'
        },
        message: {
          type: 'string',
          description: 'Message body text (max 1600 characters for SMS)'
        },
        mediaUrls: {
          type: 'array',
          description: 'Array of media URLs for MMS (images, GIFs, videos)',
          items: {
            type: 'string'
          }
        },
        mergeData: {
          type: 'object',
          description: 'Data object for resolving {{merge}} fields in message (optional)'
        },
        fromNumber: {
          type: 'string',
          description:
            'Override the default Twilio phone number to send from (optional, must be verified)'
        }
      },
      required: ['to', 'message']
    },
    outputSchema: {
      type: 'object',
      description: 'Send result with message SID and delivery status',
      properties: {
        sid: {
          type: 'string',
          description: 'Unique Twilio message SID'
        },
        status: {
          type: 'string',
          description: 'Message status (queued, sending, sent, delivered, failed)'
        },
        to: {
          type: 'string',
          description: 'Recipient phone number'
        },
        from: {
          type: 'string',
          description: 'Sender phone number'
        }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const toRaw = input.to as string
      const message = input.message as string
      const mediaUrls = input.mediaUrls as string[] | undefined
      const mergeData = (input.mergeData as Record<string, unknown>) ?? {}
      const fromNumberOverride = input.fromNumber as string | undefined

      // Validate required fields
      if (!toRaw || typeof toRaw !== 'string') {
        return { success: false, error: 'Missing or invalid "to" phone number' }
      }
      if (!message || typeof message !== 'string') {
        return { success: false, error: 'Missing or invalid "message"' }
      }

      // Normalize and validate phone number
      const to = normalizeToE164(toRaw)
      if (!isValidE164(to)) {
        return {
          success: false,
          error: `Invalid phone number format: "${toRaw}". Expected E.164 format (e.g., +15551234567)`
        }
      }

      // Load Twilio settings
      const settings = new SettingsRepo()
      const accountSid = settings.get('twilio.account-sid') as string | null
      const authToken = settings.get('twilio.auth-token') as string | null
      const defaultFromNumber = settings.get('twilio.phone-number') as string | null

      if (!accountSid || !authToken) {
        return {
          success: false,
          error:
            'Twilio not configured. Please set twilio.account-sid and twilio.auth-token in settings.'
        }
      }

      const fromNumber = fromNumberOverride ?? defaultFromNumber
      if (!fromNumber) {
        return {
          success: false,
          error: 'No Twilio phone number configured. Please set twilio.phone-number in settings.'
        }
      }

      // Resolve merge fields
      const resolvedMessage = resolveMergeFields(message, mergeData)

      // Validate message length
      if (resolvedMessage.length > 1600) {
        return {
          success: false,
          error: `Message too long (${resolvedMessage.length} chars). Maximum is 1600 characters.`
        }
      }

      try {
        // Dynamic import Twilio (may not be installed)
        let twilio: typeof import('twilio')
        try {
          twilio = await import('twilio')
        } catch {
          return {
            success: false,
            error: 'twilio package not installed. Run: npm install twilio'
          }
        }

        const client = twilio.default(accountSid, authToken)

        const messageOptions: {
          to: string
          from: string
          body: string
          mediaUrl?: string[]
        } = {
          to,
          from: fromNumber,
          body: resolvedMessage
        }

        // Add media URLs for MMS
        if (mediaUrls && mediaUrls.length > 0) {
          messageOptions.mediaUrl = mediaUrls
        }

        const result = (await client.messages.create(messageOptions)) as TwilioMessageInstance

        return {
          success: true,
          data: {
            sid: result.sid,
            status: result.status,
            to: result.to,
            from: result.from
          },
          summary: `SMS sent to ${to} (SID: ${result.sid}, Status: ${result.status})`
        }
      } catch (err) {
        // Handle Twilio-specific errors
        const error = err as { code?: number; message?: string }
        if (error.code) {
          return {
            success: false,
            error: `Twilio error ${error.code}: ${error.message}`
          }
        }
        return {
          success: false,
          error: `Failed to send SMS: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    },

    validate(input: Record<string, unknown>): { valid: boolean; errors?: string[] } {
      const errors: string[] = []

      if (!input.to || typeof input.to !== 'string') {
        errors.push('Missing required field: to')
      } else {
        const normalized = normalizeToE164(input.to)
        if (!isValidE164(normalized)) {
          errors.push('Invalid phone number format. Expected E.164 format (e.g., +15551234567)')
        }
      }

      if (!input.message || typeof input.message !== 'string') {
        errors.push('Missing required field: message')
      } else if ((input.message as string).length > 1600) {
        errors.push('Message exceeds maximum length of 1600 characters')
      }

      if (input.mediaUrls && !Array.isArray(input.mediaUrls)) {
        errors.push('mediaUrls must be an array of URLs')
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
    }
  }
}
