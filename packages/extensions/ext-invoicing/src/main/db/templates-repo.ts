import type Database from 'better-sqlite3'
import { randomUUID } from 'crypto'

export interface InvoiceTemplateRow {
  id: string
  name: string
  logo_url: string | null
  primary_color: string | null
  header_text: string | null
  footer_text: string | null
  is_default: number
  created_at: string
}

export interface CreateTemplateInput {
  name: string
  logoUrl?: string
  primaryColor?: string
  headerText?: string
  footerText?: string
  isDefault?: boolean
}

export class InvoiceTemplatesRepo {
  constructor(private db: Database.Database) {}

  create(input: CreateTemplateInput): InvoiceTemplateRow {
    const id = randomUUID()

    // If this is set as default, unset other defaults
    if (input.isDefault) {
      this.db.prepare('UPDATE invoice_templates SET is_default = 0').run()
    }

    this.db
      .prepare(
        `INSERT INTO invoice_templates (id, name, logo_url, primary_color, header_text, footer_text, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name,
        input.logoUrl ?? null,
        input.primaryColor ?? '#4F46E5',
        input.headerText ?? null,
        input.footerText ?? null,
        input.isDefault ? 1 : 0
      )

    return this.getById(id)!
  }

  getById(id: string): InvoiceTemplateRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(id) as
        | InvoiceTemplateRow
        | undefined) ?? null
    )
  }

  getDefault(): InvoiceTemplateRow | null {
    return (
      (this.db.prepare('SELECT * FROM invoice_templates WHERE is_default = 1').get() as
        | InvoiceTemplateRow
        | undefined) ?? null
    )
  }

  list(): InvoiceTemplateRow[] {
    return this.db
      .prepare('SELECT * FROM invoice_templates ORDER BY is_default DESC, name ASC')
      .all() as InvoiceTemplateRow[]
  }

  update(
    id: string,
    data: Partial<{
      name: string
      logoUrl: string
      primaryColor: string
      headerText: string
      footerText: string
      isDefault: boolean
    }>
  ): void {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) {
      sets.push('name = ?')
      params.push(data.name)
    }
    if (data.logoUrl !== undefined) {
      sets.push('logo_url = ?')
      params.push(data.logoUrl)
    }
    if (data.primaryColor !== undefined) {
      sets.push('primary_color = ?')
      params.push(data.primaryColor)
    }
    if (data.headerText !== undefined) {
      sets.push('header_text = ?')
      params.push(data.headerText)
    }
    if (data.footerText !== undefined) {
      sets.push('footer_text = ?')
      params.push(data.footerText)
    }
    if (data.isDefault !== undefined) {
      if (data.isDefault) {
        // Unset other defaults first
        this.db.prepare('UPDATE invoice_templates SET is_default = 0').run()
      }
      sets.push('is_default = ?')
      params.push(data.isDefault ? 1 : 0)
    }

    if (sets.length === 0) return

    params.push(id)
    this.db.prepare(`UPDATE invoice_templates SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM invoice_templates WHERE id = ?').run(id)
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM invoice_templates').get() as {
      cnt: number
    }
    return row.cnt
  }
}
