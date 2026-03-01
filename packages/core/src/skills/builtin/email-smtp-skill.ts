// ============================================================================
// OpenOrbit — Email SMTP Skill
//
// Built-in tool skill for sending emails via SMTP using nodemailer.
// Supports HTML templates with {{merge}} fields and attachment support.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'
import { SettingsRepo } from '../../db/settings-repo'

// Type definitions for nodemailer (dynamically imported)
interface SmtpTransportOptions {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

interface MailOptions {
  from: string
  to: string
  cc?: string
  bcc?: string
  subject: string
  text: string
  html?: string
  attachments?: Array<{
    filename: string
    path?: string
    content?: string | Buffer
    contentType?: string
  }>
}

interface SendMailResult {
  messageId: string
  accepted: string[]
  rejected: string[]
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
 * Create plain text version from HTML by stripping tags.
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function createEmailSmtpSkill(extensionId: string): Skill {
  return {
    id: 'email-smtp',
    displayName: 'Email (SMTP)',
    icon: 'send',
    description:
      'Send emails via SMTP with HTML templates, merge fields, and attachments. Configure SMTP settings in the settings panel.',
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
          description: 'Recipient email address (required)'
        },
        subject: {
          type: 'string',
          description: 'Email subject line (required)'
        },
        body: {
          type: 'string',
          description: 'Plain text email body (required)'
        },
        html: {
          type: 'string',
          description: 'HTML email body (optional, plain text fallback auto-generated)'
        },
        cc: {
          type: 'string',
          description: 'CC recipients (comma-separated, optional)'
        },
        bcc: {
          type: 'string',
          description: 'BCC recipients (comma-separated, optional)'
        },
        mergeData: {
          type: 'object',
          description:
            'Data object for resolving {{merge}} fields in subject, body, and html (optional)'
        },
        attachments: {
          type: 'array',
          description:
            'Array of attachments with filename and either path (file path) or content (base64 string)',
          items: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              path: { type: 'string' },
              content: { type: 'string' },
              contentType: { type: 'string' }
            }
          }
        }
      },
      required: ['to', 'subject', 'body']
    },
    outputSchema: {
      type: 'object',
      description: 'Send result with message ID and delivery status',
      properties: {
        messageId: {
          type: 'string',
          description: 'Unique message ID from SMTP server'
        },
        accepted: {
          type: 'array',
          description: 'List of accepted recipient addresses'
        },
        rejected: {
          type: 'array',
          description: 'List of rejected recipient addresses'
        }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const to = input.to as string
      const subject = input.subject as string
      const body = input.body as string
      const html = input.html as string | undefined
      const cc = input.cc as string | undefined
      const bcc = input.bcc as string | undefined
      const mergeData = (input.mergeData as Record<string, unknown>) ?? {}
      const attachments = input.attachments as
        | Array<{
            filename: string
            path?: string
            content?: string
            contentType?: string
          }>
        | undefined

      // Validate required fields
      if (!to || typeof to !== 'string') {
        return { success: false, error: 'Missing or invalid "to" email address' }
      }
      if (!subject || typeof subject !== 'string') {
        return { success: false, error: 'Missing or invalid "subject"' }
      }
      if (!body || typeof body !== 'string') {
        return { success: false, error: 'Missing or invalid "body"' }
      }

      // Load SMTP settings
      const settings = new SettingsRepo()
      const smtpHost = settings.get('email.smtp-host') as string | null
      const smtpPort = parseInt(settings.get('email.smtp-port') as string, 10) || 587
      const smtpUser = settings.get('email.smtp-user') as string | null
      const smtpPass = settings.get('email.smtp-pass') as string | null
      const smtpFrom = settings.get('email.smtp-from') as string | null
      const smtpSecure = settings.get('email.smtp-secure') === 'true'

      if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
        return {
          success: false,
          error:
            'SMTP not configured. Please set email.smtp-host, email.smtp-user, email.smtp-pass, and email.smtp-from in settings.'
        }
      }

      // Resolve merge fields
      const resolvedSubject = resolveMergeFields(subject, mergeData)
      const resolvedBody = resolveMergeFields(body, mergeData)
      const resolvedHtml = html ? resolveMergeFields(html, mergeData) : undefined

      // Build mail options
      const mailOptions: MailOptions = {
        from: smtpFrom,
        to,
        subject: resolvedSubject,
        text: resolvedHtml ? htmlToPlainText(resolvedHtml) : resolvedBody,
        html: resolvedHtml,
        ...(cc && { cc }),
        ...(bcc && { bcc }),
        ...(attachments && {
          attachments: attachments.map((att) => ({
            filename: att.filename,
            ...(att.path && { path: att.path }),
            ...(att.content && { content: Buffer.from(att.content, 'base64') }),
            ...(att.contentType && { contentType: att.contentType })
          }))
        })
      }

      try {
        // Dynamic import nodemailer (may not be installed)
        let nodemailer: typeof import('nodemailer')
        try {
          nodemailer = await import('nodemailer')
        } catch {
          return {
            success: false,
            error: 'nodemailer package not installed. Run: npm install nodemailer'
          }
        }

        const transportOptions: SmtpTransportOptions = {
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        }

        const transporter = nodemailer.createTransport(transportOptions)
        const result = (await transporter.sendMail(mailOptions)) as SendMailResult

        return {
          success: true,
          data: {
            messageId: result.messageId,
            accepted: result.accepted,
            rejected: result.rejected
          },
          summary: `Email sent to ${to} (ID: ${result.messageId})`
        }
      } catch (err) {
        return {
          success: false,
          error: `Failed to send email: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    },

    validate(input: Record<string, unknown>): { valid: boolean; errors?: string[] } {
      const errors: string[] = []

      if (!input.to || typeof input.to !== 'string') {
        errors.push('Missing required field: to')
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) {
        errors.push('Invalid email address format for "to"')
      }

      if (!input.subject || typeof input.subject !== 'string') {
        errors.push('Missing required field: subject')
      }

      if (!input.body || typeof input.body !== 'string') {
        errors.push('Missing required field: body')
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
    }
  }
}
