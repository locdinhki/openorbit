// ============================================================================
// ext-docs — Database Migrations
// ============================================================================

import type { ExtensionMigration } from '@openorbit/core/extensions/types'

export const extDocsMigrations: ExtensionMigration[] = [
  {
    version: 1,
    description: 'Create documents, templates, and signatures tables',
    up: (db) => {
      db.exec(`
        -- Document storage
        CREATE TABLE IF NOT EXISTS docs_documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER,
          contact_id TEXT,
          deal_id TEXT,
          property_id TEXT,
          template_id TEXT,
          tags TEXT DEFAULT '[]',
          metadata TEXT DEFAULT '{}',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- Document templates
        CREATE TABLE IF NOT EXISTS docs_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          category TEXT,
          content TEXT NOT NULL,
          merge_fields TEXT DEFAULT '[]',
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );

        -- E-signature requests
        CREATE TABLE IF NOT EXISTS docs_signatures (
          id TEXT PRIMARY KEY,
          document_id TEXT NOT NULL,
          provider TEXT NOT NULL,
          external_id TEXT,
          status TEXT DEFAULT 'pending',
          signers TEXT DEFAULT '[]',
          sent_at TEXT,
          signed_at TEXT,
          expires_at TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (document_id) REFERENCES docs_documents(id) ON DELETE CASCADE
        );

        -- Indexes
        CREATE INDEX IF NOT EXISTS idx_docs_documents_contact ON docs_documents(contact_id);
        CREATE INDEX IF NOT EXISTS idx_docs_documents_deal ON docs_documents(deal_id);
        CREATE INDEX IF NOT EXISTS idx_docs_documents_property ON docs_documents(property_id);
        CREATE INDEX IF NOT EXISTS idx_docs_documents_type ON docs_documents(file_type);
        CREATE INDEX IF NOT EXISTS idx_docs_templates_category ON docs_templates(category);
        CREATE INDEX IF NOT EXISTS idx_docs_signatures_document ON docs_signatures(document_id);
        CREATE INDEX IF NOT EXISTS idx_docs_signatures_status ON docs_signatures(status);
      `)
    }
  }
]
