// ============================================================================
// OpenOrbit — BlueBubbles REST Client
//
// Outbound REST client for BlueBubbles server API. Sends iMessage responses
// via the BlueBubbles HTTP API.
// ============================================================================

import type { Logger } from '@openorbit/core/extensions/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BlueBubblesConfig {
  serverUrl: string
  password: string
}

// ---------------------------------------------------------------------------
// BlueBubblesClient
// ---------------------------------------------------------------------------

export class BlueBubblesClient {
  private serverUrl: string
  private password: string
  private log: Logger

  constructor(config: BlueBubblesConfig, log: Logger) {
    this.serverUrl = config.serverUrl.replace(/\/$/, '')
    this.password = config.password
    this.log = log
  }

  async ping(): Promise<boolean> {
    try {
      await this.apiCall('GET', '/api/v1/ping')
      return true
    } catch {
      return false
    }
  }

  async sendMessage(chatGuid: string, text: string): Promise<void> {
    const chunks = chunkMessage(text)
    for (const chunk of chunks) {
      await this.apiCall('POST', '/api/v1/message/text', {
        chatGuid,
        message: chunk
      })
    }
  }

  async downloadAttachment(guid: string): Promise<Buffer> {
    const separator = '?'
    const url = `${this.serverUrl}/api/v1/attachment/${encodeURIComponent(guid)}/download${separator}password=${encodeURIComponent(this.password)}`

    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`BlueBubbles download error ${response.status}: ${text}`)
    }

    return Buffer.from(await response.arrayBuffer())
  }

  async sendTypingIndicator(chatGuid: string): Promise<void> {
    try {
      await this.apiCall('PUT', `/api/v1/chat/${encodeURIComponent(chatGuid)}/typing`)
    } catch (err) {
      // Non-critical — log and continue
      this.log.debug('Failed to send typing indicator:', err)
    }
  }

  // -------------------------------------------------------------------------
  // API helpers
  // -------------------------------------------------------------------------

  private async apiCall(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<unknown> {
    const separator = path.includes('?') ? '&' : '?'
    const url = `${this.serverUrl}${path}${separator}password=${encodeURIComponent(this.password)}`

    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`BlueBubbles API error ${response.status}: ${text}`)
    }

    const contentType = response.headers.get('content-type')
    if (contentType?.includes('application/json')) {
      return response.json()
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into chunks respecting iMessage's practical message limit. */
export function chunkMessage(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining)
      break
    }

    // Try to split on a paragraph boundary
    let splitAt = remaining.lastIndexOf('\n\n', maxLen)
    if (splitAt < maxLen / 2) {
      // No good paragraph break — try a line break
      splitAt = remaining.lastIndexOf('\n', maxLen)
    }
    if (splitAt < maxLen / 2) {
      // No good break — hard split
      splitAt = maxLen
    }

    chunks.push(remaining.slice(0, splitAt))
    remaining = remaining.slice(splitAt).replace(/^\n+/, '')
  }

  return chunks
}
