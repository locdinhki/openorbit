// ============================================================================
// ext-voip — Calls Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface VoipCall {
  id: string
  twilio_sid: string | null
  from_number: string
  to_number: string
  contact_id: string | null
  contact_name: string | null
  direction: 'outbound' | 'inbound'
  status:
    | 'initiated'
    | 'ringing'
    | 'in-progress'
    | 'completed'
    | 'failed'
    | 'busy'
    | 'no-answer'
    | 'canceled'
  duration_seconds: number
  start_time: string
  end_time: string | null
  answered_at: string | null
  price: string | null
  price_unit: string | null
  notes: string | null
  tags: string | null
  outcome: string | null
  created_at: string
  updated_at: string
}

export interface VoipRecording {
  id: string
  call_id: string
  twilio_sid: string | null
  recording_url: string | null
  duration_seconds: number
  file_size_bytes: number | null
  status: 'recording' | 'completed' | 'failed' | 'deleted'
  transcript: string | null
  transcript_status: 'pending' | 'processing' | 'completed' | 'failed' | null
  transcript_model: string | null
  transcript_duration_ms: number | null
  created_at: string
  updated_at: string
}

export interface CreateCallInput {
  fromNumber: string
  toNumber: string
  contactId?: string
  contactName?: string
  direction?: 'outbound' | 'inbound'
  twilioSid?: string
}

export interface UpdateCallInput {
  twilioSid?: string
  status?: VoipCall['status']
  durationSeconds?: number
  endTime?: string
  answeredAt?: string
  price?: string
  priceUnit?: string
  notes?: string
  tags?: string
  outcome?: string
}

export interface CreateRecordingInput {
  callId: string
  twilioSid?: string
  recordingUrl?: string
}

export interface UpdateRecordingInput {
  twilioSid?: string
  recordingUrl?: string
  durationSeconds?: number
  fileSizeBytes?: number
  status?: VoipRecording['status']
  transcript?: string
  transcriptStatus?: VoipRecording['transcript_status']
  transcriptModel?: string
  transcriptDurationMs?: number
}

export class VoipCallsRepo {
  constructor(private db: Database) {}

  // -------------------------------------------------------------------------
  // Calls
  // -------------------------------------------------------------------------

  createCall(input: CreateCallInput): VoipCall {
    const id = randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO voip_calls (
          id, twilio_sid, from_number, to_number, contact_id, contact_name,
          direction, status, duration_seconds, start_time, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'initiated', 0, ?, ?, ?)`
      )
      .run(
        id,
        input.twilioSid ?? null,
        input.fromNumber,
        input.toNumber,
        input.contactId ?? null,
        input.contactName ?? null,
        input.direction ?? 'outbound',
        now,
        now,
        now
      )

    return this.getCall(id)!
  }

  updateCall(id: string, input: UpdateCallInput): VoipCall | null {
    const updates: string[] = ['updated_at = datetime("now")']
    const values: unknown[] = []

    if (input.twilioSid !== undefined) {
      updates.push('twilio_sid = ?')
      values.push(input.twilioSid)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      values.push(input.status)
    }
    if (input.durationSeconds !== undefined) {
      updates.push('duration_seconds = ?')
      values.push(input.durationSeconds)
    }
    if (input.endTime !== undefined) {
      updates.push('end_time = ?')
      values.push(input.endTime)
    }
    if (input.answeredAt !== undefined) {
      updates.push('answered_at = ?')
      values.push(input.answeredAt)
    }
    if (input.price !== undefined) {
      updates.push('price = ?')
      values.push(input.price)
    }
    if (input.priceUnit !== undefined) {
      updates.push('price_unit = ?')
      values.push(input.priceUnit)
    }
    if (input.notes !== undefined) {
      updates.push('notes = ?')
      values.push(input.notes)
    }
    if (input.tags !== undefined) {
      updates.push('tags = ?')
      values.push(input.tags)
    }
    if (input.outcome !== undefined) {
      updates.push('outcome = ?')
      values.push(input.outcome)
    }

    values.push(id)

    this.db.prepare(`UPDATE voip_calls SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.getCall(id)
  }

  getCall(id: string): VoipCall | null {
    return this.db.prepare('SELECT * FROM voip_calls WHERE id = ?').get(id) as VoipCall | null
  }

  getCallByTwilioSid(sid: string): VoipCall | null {
    return this.db
      .prepare('SELECT * FROM voip_calls WHERE twilio_sid = ?')
      .get(sid) as VoipCall | null
  }

  listCalls(options: {
    limit?: number
    offset?: number
    contactId?: string
    status?: VoipCall['status']
    startDate?: string
    endDate?: string
  }): VoipCall[] {
    const conditions: string[] = ['1=1']
    const values: unknown[] = []

    if (options.contactId) {
      conditions.push('contact_id = ?')
      values.push(options.contactId)
    }
    if (options.status) {
      conditions.push('status = ?')
      values.push(options.status)
    }
    if (options.startDate) {
      conditions.push('start_time >= ?')
      values.push(options.startDate)
    }
    if (options.endDate) {
      conditions.push('start_time <= ?')
      values.push(options.endDate)
    }

    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    return this.db
      .prepare(
        `SELECT * FROM voip_calls
         WHERE ${conditions.join(' AND ')}
         ORDER BY start_time DESC
         LIMIT ? OFFSET ?`
      )
      .all(...values, limit, offset) as VoipCall[]
  }

  deleteCall(id: string): boolean {
    const result = this.db.prepare('DELETE FROM voip_calls WHERE id = ?').run(id)
    return result.changes > 0
  }

  // -------------------------------------------------------------------------
  // Recordings
  // -------------------------------------------------------------------------

  createRecording(input: CreateRecordingInput): VoipRecording {
    const id = randomUUID()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `INSERT INTO voip_recordings (
          id, call_id, twilio_sid, recording_url, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'recording', ?, ?)`
      )
      .run(id, input.callId, input.twilioSid ?? null, input.recordingUrl ?? null, now, now)

    return this.getRecording(id)!
  }

  updateRecording(id: string, input: UpdateRecordingInput): VoipRecording | null {
    const updates: string[] = ['updated_at = datetime("now")']
    const values: unknown[] = []

    if (input.twilioSid !== undefined) {
      updates.push('twilio_sid = ?')
      values.push(input.twilioSid)
    }
    if (input.recordingUrl !== undefined) {
      updates.push('recording_url = ?')
      values.push(input.recordingUrl)
    }
    if (input.durationSeconds !== undefined) {
      updates.push('duration_seconds = ?')
      values.push(input.durationSeconds)
    }
    if (input.fileSizeBytes !== undefined) {
      updates.push('file_size_bytes = ?')
      values.push(input.fileSizeBytes)
    }
    if (input.status !== undefined) {
      updates.push('status = ?')
      values.push(input.status)
    }
    if (input.transcript !== undefined) {
      updates.push('transcript = ?')
      values.push(input.transcript)
    }
    if (input.transcriptStatus !== undefined) {
      updates.push('transcript_status = ?')
      values.push(input.transcriptStatus)
    }
    if (input.transcriptModel !== undefined) {
      updates.push('transcript_model = ?')
      values.push(input.transcriptModel)
    }
    if (input.transcriptDurationMs !== undefined) {
      updates.push('transcript_duration_ms = ?')
      values.push(input.transcriptDurationMs)
    }

    values.push(id)

    this.db.prepare(`UPDATE voip_recordings SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.getRecording(id)
  }

  getRecording(id: string): VoipRecording | null {
    return this.db
      .prepare('SELECT * FROM voip_recordings WHERE id = ?')
      .get(id) as VoipRecording | null
  }

  getRecordingByCallId(callId: string): VoipRecording | null {
    return this.db
      .prepare('SELECT * FROM voip_recordings WHERE call_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(callId) as VoipRecording | null
  }

  listRecordings(options: { callId?: string; limit?: number; offset?: number }): VoipRecording[] {
    const conditions: string[] = ['1=1']
    const values: unknown[] = []

    if (options.callId) {
      conditions.push('call_id = ?')
      values.push(options.callId)
    }

    const limit = options.limit ?? 100
    const offset = options.offset ?? 0

    return this.db
      .prepare(
        `SELECT * FROM voip_recordings
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`
      )
      .all(...values, limit, offset) as VoipRecording[]
  }

  deleteRecording(id: string): boolean {
    const result = this.db.prepare('DELETE FROM voip_recordings WHERE id = ?').run(id)
    return result.changes > 0
  }

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  getAnalyticsSummary(options: { startDate?: string; endDate?: string }): {
    totalCalls: number
    completedCalls: number
    failedCalls: number
    totalDurationSeconds: number
    avgDurationSeconds: number
    recordedCalls: number
    transcribedCalls: number
  } {
    const conditions: string[] = ['1=1']
    const values: unknown[] = []

    if (options.startDate) {
      conditions.push('start_time >= ?')
      values.push(options.startDate)
    }
    if (options.endDate) {
      conditions.push('start_time <= ?')
      values.push(options.endDate)
    }

    const result = this.db
      .prepare(
        `SELECT
          COUNT(*) as totalCalls,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completedCalls,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failedCalls,
          COALESCE(SUM(duration_seconds), 0) as totalDurationSeconds,
          COALESCE(AVG(CASE WHEN duration_seconds > 0 THEN duration_seconds END), 0) as avgDurationSeconds
        FROM voip_calls
        WHERE ${conditions.join(' AND ')}`
      )
      .get(...values) as {
      totalCalls: number
      completedCalls: number
      failedCalls: number
      totalDurationSeconds: number
      avgDurationSeconds: number
    }

    const recordingStats = this.db
      .prepare(
        `SELECT
          COUNT(DISTINCT r.call_id) as recordedCalls,
          SUM(CASE WHEN r.transcript_status = 'completed' THEN 1 ELSE 0 END) as transcribedCalls
        FROM voip_recordings r
        JOIN voip_calls c ON r.call_id = c.id
        WHERE ${conditions.join(' AND ')}`
      )
      .get(...values) as { recordedCalls: number; transcribedCalls: number }

    return {
      ...result,
      avgDurationSeconds: Math.round(result.avgDurationSeconds),
      recordedCalls: recordingStats.recordedCalls ?? 0,
      transcribedCalls: recordingStats.transcribedCalls ?? 0
    }
  }

  getAnalyticsByContact(contactId: string): {
    totalCalls: number
    totalDurationSeconds: number
    lastCallAt: string | null
    outcomes: Record<string, number>
  } {
    const stats = this.db
      .prepare(
        `SELECT
          COUNT(*) as totalCalls,
          COALESCE(SUM(duration_seconds), 0) as totalDurationSeconds,
          MAX(start_time) as lastCallAt
        FROM voip_calls
        WHERE contact_id = ?`
      )
      .get(contactId) as {
      totalCalls: number
      totalDurationSeconds: number
      lastCallAt: string | null
    }

    const outcomeRows = this.db
      .prepare(
        `SELECT outcome, COUNT(*) as count
         FROM voip_calls
         WHERE contact_id = ? AND outcome IS NOT NULL
         GROUP BY outcome`
      )
      .all(contactId) as { outcome: string; count: number }[]

    const outcomes: Record<string, number> = {}
    for (const row of outcomeRows) {
      outcomes[row.outcome] = row.count
    }

    return {
      ...stats,
      outcomes
    }
  }
}
