// ============================================================================
// ext-docs — Signatures Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { randomUUID } from 'crypto'
import type { Signature, SignRequest } from '../../ipc-schemas'

interface SignatureRow {
  id: string
  document_id: string
  provider: 'docusign' | 'hellosign'
  external_id: string | null
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined'
  signers: string
  sent_at: string | null
  signed_at: string | null
  expires_at: string | null
  created_at: string
}

function rowToSignature(row: SignatureRow): Signature {
  return {
    id: row.id,
    documentId: row.document_id,
    provider: row.provider,
    externalId: row.external_id ?? undefined,
    status: row.status,
    signers: JSON.parse(row.signers),
    sentAt: row.sent_at ?? undefined,
    signedAt: row.signed_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at
  }
}

export class SignaturesRepo {
  constructor(private db: Database) {}

  getByDocument(documentId: string): Signature[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM docs_signatures
      WHERE document_id = ?
      ORDER BY created_at DESC
    `
      )
      .all(documentId) as SignatureRow[]

    return rows.map(rowToSignature)
  }

  get(id: string): Signature | null {
    const row = this.db.prepare('SELECT * FROM docs_signatures WHERE id = ?').get(id) as
      | SignatureRow
      | undefined

    return row ? rowToSignature(row) : null
  }

  create(request: SignRequest, expiresInDays: number = 30): Signature {
    const id = randomUUID()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)

    this.db
      .prepare(
        `
      INSERT INTO docs_signatures (
        id, document_id, provider, status, signers, expires_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        id,
        request.documentId,
        request.provider,
        'pending',
        JSON.stringify(request.signers),
        expiresAt.toISOString(),
        now.toISOString()
      )

    return this.get(id)!
  }

  updateStatus(id: string, status: Signature['status'], externalId?: string): Signature | null {
    const existing = this.get(id)
    if (!existing) return null

    const updates: string[] = ['status = ?']
    const params: (string | null)[] = [status]

    if (externalId !== undefined) {
      updates.push('external_id = ?')
      params.push(externalId)
    }

    if (status === 'sent') {
      updates.push('sent_at = ?')
      params.push(new Date().toISOString())
    }

    if (status === 'signed') {
      updates.push('signed_at = ?')
      params.push(new Date().toISOString())
    }

    params.push(id)

    this.db.prepare(`UPDATE docs_signatures SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    return this.get(id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM docs_signatures WHERE id = ?').run(id)
    return result.changes > 0
  }

  getPending(): Signature[] {
    const rows = this.db
      .prepare(
        `
      SELECT * FROM docs_signatures
      WHERE status IN ('pending', 'sent', 'viewed')
      ORDER BY created_at DESC
    `
      )
      .all() as SignatureRow[]

    return rows.map(rowToSignature)
  }

  getExpired(): Signature[] {
    const now = new Date().toISOString()
    const rows = this.db
      .prepare(
        `
      SELECT * FROM docs_signatures
      WHERE status IN ('pending', 'sent', 'viewed')
        AND expires_at < ?
      ORDER BY expires_at ASC
    `
      )
      .all(now) as SignatureRow[]

    return rows.map(rowToSignature)
  }
}
