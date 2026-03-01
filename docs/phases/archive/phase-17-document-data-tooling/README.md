# Phase 17: Document & Data Tooling

**Theme:** Complete the document pipeline with Spreadsheet/CSV, Document Generation (templates), and OCR skills, plus a full Document & Contract Management extension with e-signatures. Unlocks data export for every extension and structured document workflows.

**Effort:** High | **Depends on:** Phase 15 (PDF skill) | **Status:** Complete

## Why This Phase

Every extension produces data that users want to export (contacts, deals, transactions, properties). The Spreadsheet skill is the universal export format. Document Generation builds on the Phase 15 PDF skill to produce contracts, proposals, and lease agreements from templates. OCR captures paper documents into the digital workflow. ext-docs ties it all together with organized storage, version tracking, and e-signatures.

## Components

### 17.1: Spreadsheet / CSV Skill

Built-in tool skill using `exceljs` for .xlsx read/write.

- Export tabular data to Excel (.xlsx) or CSV format
- Auto-detect headers from data keys
- Number/date formatting with custom format strings
- Multi-sheet workbooks support
- Auto-filter and freeze header row options
- Skill id: `spreadsheet-export`, category: `data`

**File:** `packages/core/src/skills/builtin/spreadsheet-skill.ts`

### 17.2: Document Generation (Templates) Skill

Built-in tool skill for merging data into Markdown templates.

- Template format: Markdown with `{{field}}` placeholders (nested: `{{contact.firstName}}`)
- Data source: any extension's IPC data
- Output: PDF (via pdf-generate skill), HTML, or plain text
- Markdown-to-PDF conversion with tables, headings, lists, code blocks
- Skill id: `doc-generate`, category: `document`

**Files:**
- `packages/core/src/skills/builtin/doc-generate-skill.ts`
- `packages/core/src/skills/builtin/pdf-builder.ts` (pdf-lib wrapper)
- `packages/core/src/skills/builtin/pdf-generate-skill.ts` (structured PDF generation)

### 17.3: OCR / Text Extraction Skill

Built-in tool skill using `tesseract.js` for local OCR.

- No API key needed — runs entirely local
- Structured extraction types: receipt (items, total, date), business_card (name, email, phone), general
- Configurable language and page segmentation mode
- Base64 or file path input
- Skill id: `ocr-extract`, category: `media`

**File:** `packages/core/src/skills/builtin/ocr-skill.ts`

### 17.4: ext-docs — Document & Contract Management

Full extension for document storage, generation, and signing.

- File storage organized by contact/deal/property with tags
- Template-based generation with merge fields from CRM data
- E-signature integration (DocuSign or HelloSign API) - pending API implementation
- Search across all stored documents
- **IPC channels:** 16 (document CRUD, template management, generation, signatures, settings)
- **DB tables:** `docs_documents`, `docs_templates`, `docs_signatures`
- **UI:** Sidebar (document browser with tabs), Workspace (document list + detail view), Panel (document viewer + template generator)

**Files:**
```
packages/extensions/ext-docs/
├── package.json
├── tsconfig.json
├── src/
│   ├── ipc-channels.ts
│   ├── ipc-schemas.ts
│   ├── main/
│   │   ├── index.ts
│   │   ├── ipc-handlers.ts
│   │   └── db/
│   │       ├── migrations.ts
│   │       ├── documents-repo.ts
│   │       ├── templates-repo.ts
│   │       └── signatures-repo.ts
│   └── renderer/
│       ├── index.ts
│       ├── store/
│       │   ├── index.ts
│       │   └── documentsSlice.ts
│       └── components/
│           ├── DocsSidebar.tsx
│           ├── DocsWorkspace.tsx
│           └── DocsViewer.tsx
```

## New Dependencies

| Package | Purpose |
|---------|---------|
| `exceljs` | .xlsx read/write |
| `tesseract.js` | Local OCR engine |
| `pdf-lib` | PDF generation |

## Database Schema

```sql
-- Document storage
CREATE TABLE docs_documents (
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
CREATE TABLE docs_templates (
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
CREATE TABLE docs_signatures (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT,
  status TEXT DEFAULT 'pending',
  signers TEXT DEFAULT '[]',
  sent_at TEXT,
  signed_at TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

## Skills Registered

| Skill ID | Display Name | Category | Description |
|----------|--------------|----------|-------------|
| `pdf-generate` | PDF Generator | document | Generate PDFs from structured blocks |
| `spreadsheet-export` | Spreadsheet Export | data | Export data to xlsx/csv |
| `doc-generate` | Document Generator | document | Template merging with output to PDF/HTML/text |
| `ocr-extract` | OCR Text Extraction | media | Extract text from images using local OCR |

## After Phase 17, OpenOrbit Is...

A platform with a complete document pipeline — spreadsheet export, template-based document generation, OCR text extraction, and managed document storage with e-signatures — enabling any extension's data to flow into polished, signable business documents.
