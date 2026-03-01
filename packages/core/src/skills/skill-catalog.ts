// ============================================================================
// OpenOrbit — Skill Catalog (shipped + custom skills for browsing/install)
//
// Instruction skills inject markdown content into AI system prompts.
// Tool skills (built-in) are always installed and managed by SkillRegistry.
// ============================================================================

import type { SkillCategory } from './skill-types'
import type { SettingsRepo } from '../db/settings-repo'
import type { UserSkillsRepo } from './user-skills-repo'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'password' | 'number' | 'boolean'
  placeholder?: string
  required?: boolean
}

export interface CatalogSkill {
  id: string
  displayName: string
  description: string
  category: SkillCategory
  icon: string
  type: 'instruction' | 'tool'
  content?: string
  isBuiltIn: boolean
  configFields?: ConfigField[]
}

export interface CatalogListItem {
  id: string
  displayName: string
  description: string
  category: SkillCategory
  icon: string
  type: 'instruction' | 'tool'
  isBuiltIn: boolean
  isCustom: boolean
  isInstalled: boolean
  configFields?: ConfigField[]
}

// ---------------------------------------------------------------------------
// Shipped catalog
// ---------------------------------------------------------------------------

const SKILL_CATALOG: CatalogSkill[] = [
  // Tool skills (built-in, always installed)
  {
    id: 'voice-transcribe',
    displayName: 'Voice Transcriber',
    description: 'Transcribe audio files to text using Whisper',
    category: 'media',
    icon: 'microphone',
    type: 'tool',
    isBuiltIn: true
  },
  {
    id: 'calc-expression',
    displayName: 'Calculator',
    description: 'Evaluate mathematical expressions safely',
    category: 'data',
    icon: 'calculator',
    type: 'tool',
    isBuiltIn: true
  },
  {
    id: 'data-format',
    displayName: 'Data Formatter',
    description: 'Convert between JSON, CSV, and other formats',
    category: 'data',
    icon: 'shuffle',
    type: 'tool',
    isBuiltIn: true
  },

  // Instruction skills (installable)
  {
    id: 'pdf-generate',
    displayName: 'PDF Generator',
    description: 'Generate PDF documents from structured content blocks using pdf-lib',
    category: 'document',
    icon: 'file-text',
    type: 'tool',
    isBuiltIn: true
  },
  {
    id: 'spreadsheet',
    displayName: 'Spreadsheet',
    description: 'Create, edit, and analyze spreadsheets and CSV files',
    category: 'data',
    icon: 'list',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Determine the data source and desired output format (XLSX, CSV)
2. Structure data into rows and columns with appropriate headers
3. Apply formatting, formulas, or calculations as needed
4. Export the file for download

## Conventions
- Use clear, descriptive column headers
- Format numbers, dates, and currencies consistently
- Include summary rows for financial data (totals, averages)

## Dependencies
- xlsx or exceljs for .xlsx read/write
- CSV parsing and generation utilities

## Quality Gates
- Exported files must open correctly in Excel and Google Sheets
- Data types must be preserved (numbers as numbers, not strings)
- Large datasets should be paginated or chunked appropriately`
  },
  {
    id: 'email-smtp',
    displayName: 'Email (SMTP)',
    description:
      'Send emails programmatically via SMTP using Nodemailer with HTML templates and merge fields',
    category: 'communication',
    icon: 'send',
    type: 'tool',
    isBuiltIn: true,
    configFields: [
      {
        key: 'email.smtp-host',
        label: 'SMTP Host',
        type: 'text',
        placeholder: 'smtp.gmail.com',
        required: true
      },
      { key: 'email.smtp-port', label: 'SMTP Port', type: 'number', placeholder: '587' },
      {
        key: 'email.smtp-user',
        label: 'SMTP Username',
        type: 'text',
        placeholder: 'you@example.com',
        required: true
      },
      { key: 'email.smtp-pass', label: 'SMTP Password', type: 'password', required: true },
      {
        key: 'email.smtp-from',
        label: 'From Address',
        type: 'text',
        placeholder: 'you@example.com',
        required: true
      },
      { key: 'email.smtp-secure', label: 'Use TLS (port 465)', type: 'boolean' }
    ]
  },
  {
    id: 'sms-mms',
    displayName: 'SMS / MMS',
    description: 'Send SMS and MMS messages via Twilio with E.164 format and delivery tracking',
    category: 'communication',
    icon: 'message-circle',
    type: 'tool',
    isBuiltIn: true,
    configFields: [
      {
        key: 'twilio.account-sid',
        label: 'Account SID',
        type: 'text',
        placeholder: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true
      },
      { key: 'twilio.auth-token', label: 'Auth Token', type: 'password', required: true },
      {
        key: 'twilio.phone-number',
        label: 'Phone Number',
        type: 'text',
        placeholder: '+15551234567',
        required: true
      }
    ]
  },
  {
    id: 'chart-render',
    displayName: 'Chart Renderer',
    description: 'Generate chart images (bar, line, pie, doughnut) from data using Chart.js',
    category: 'media',
    icon: 'bar-chart-2',
    type: 'tool',
    isBuiltIn: true
  },
  {
    id: 'document-generation',
    displayName: 'Document Generation',
    description: 'Merge data into document templates for polished output',
    category: 'document',
    icon: 'sparkles',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Select a document template (lease, proposal, offer letter, contract, SOP)
2. Identify merge fields and map them to data sources
3. Merge data into the template, resolving all placeholders
4. Output as PDF, HTML, or plain text

## Conventions
- Templates use Markdown with {{field}} placeholders
- Support nested fields ({{contact.firstName}}, {{deal.value}})
- Maintain consistent formatting across all generated documents

## Dependencies
- Markdown template parser with merge field resolution
- PDF skill for final PDF output
- Template library stored in user data directory

## Quality Gates
- All merge fields must resolve (no unresolved {{field}} in output)
- Generated documents must maintain proper formatting
- Template library must be easy to browse and manage`
  },
  {
    id: 'financial-calculator',
    displayName: 'Financial Calculator',
    description: 'Real estate investment calculations (ROI, cap rate, DSCR, mortgage, etc.)',
    category: 'data',
    icon: 'calculator',
    type: 'tool',
    isBuiltIn: true
  },
  {
    id: 'ocr-extraction',
    displayName: 'OCR / Text Extraction',
    description: 'Extract text from images and scanned documents using Tesseract.js',
    category: 'media',
    icon: 'sparkles',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Accept an image file (receipt, business card, scanned document)
2. Preprocess the image for better accuracy (contrast, rotation)
3. Run OCR to extract raw text
4. Use AI to structure the extracted text into useful fields

## Conventions
- Support common image formats (PNG, JPG, PDF pages)
- Return both raw text and structured data where applicable
- For receipts: extract date, vendor, total, line items
- For business cards: extract name, title, company, phone, email

## Dependencies
- tesseract.js for local OCR (no API key needed)
- AI-assisted extraction for structured data parsing

## Quality Gates
- OCR accuracy should be reasonable for clear, well-lit images
- Structured extraction should handle common formats correctly
- Gracefully handle low-quality images with appropriate error messages`
  },
  {
    id: 'web-scraper',
    displayName: 'Web Scraper',
    description: 'Configurable browser automation for data extraction',
    category: 'utility',
    icon: 'sparkles',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Define the target URL pattern and data selectors
2. Navigate to the page using browser automation
3. Extract data using CSS selectors or XPath
4. Store results in database or export to CSV

## Conventions
- Respect robots.txt and rate limits
- Use random delays between requests to avoid detection
- Cache results to minimize repeated requests
- Support pagination for multi-page results

## Dependencies
- Patchright/SessionManager pattern (already available in core)
- User-configurable scrape jobs: URL pattern, selectors, schedule
- Output to DB table or CSV export

## Quality Gates
- Scraping jobs must handle page load failures gracefully
- Data extraction must validate expected structure
- Change detection should alert on significant data changes`
  }
]

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getCatalogSkills(): CatalogSkill[] {
  return SKILL_CATALOG
}

export function isSkillInstalled(id: string, settings: SettingsRepo): boolean {
  const skill = SKILL_CATALOG.find((s) => s.id === id)
  if (!skill) return false
  if (skill.isBuiltIn) return true
  return settings.get(`skill.${id}.installed`) === '1'
}

export function getMergedCatalogList(
  settings: SettingsRepo,
  userSkills: UserSkillsRepo
): CatalogListItem[] {
  const items: CatalogListItem[] = []

  // Shipped catalog skills
  for (const skill of SKILL_CATALOG) {
    items.push({
      id: skill.id,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      icon: skill.icon,
      type: skill.type,
      isBuiltIn: skill.isBuiltIn,
      isCustom: false,
      isInstalled: skill.isBuiltIn || settings.get(`skill.${skill.id}.installed`) === '1',
      configFields: skill.configFields
    })
  }

  // Custom user-created skills (always installed)
  for (const custom of userSkills.list()) {
    items.push({
      id: custom.id,
      displayName: custom.display_name,
      description: custom.description,
      category: custom.category as SkillCategory,
      icon: custom.icon,
      type: 'instruction',
      isBuiltIn: false,
      isCustom: true,
      isInstalled: true
    })
  }

  return items
}

export function getInstalledInstructionContent(
  settings: SettingsRepo,
  userSkills: UserSkillsRepo
): string {
  const sections: string[] = []

  // Shipped instruction skills that are installed
  for (const skill of SKILL_CATALOG) {
    if (skill.type !== 'instruction' || !skill.content) continue
    if (settings.get(`skill.${skill.id}.installed`) !== '1') continue
    sections.push(`### ${skill.displayName}\n\n${skill.content}`)
  }

  // Custom user-created skills (always active)
  for (const custom of userSkills.list()) {
    if (custom.content) {
      sections.push(`### ${custom.display_name}\n\n${custom.content}`)
    }
  }

  return sections.join('\n\n---\n\n')
}
