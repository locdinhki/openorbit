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

export interface CatalogSkill {
  id: string
  displayName: string
  description: string
  category: SkillCategory
  icon: string
  type: 'instruction' | 'tool'
  content?: string
  isBuiltIn: boolean
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
    id: 'pdf-generation',
    displayName: 'PDF Generation',
    description: 'Create, edit, and review PDFs programmatically',
    category: 'document',
    icon: 'sparkles',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Collect data from the user's request (contact info, deal data, property details, etc.)
2. Select or build a PDF template (invoice, report, comp package, cover letter)
3. Merge data into the template using placeholder fields
4. Generate the PDF and present a download link or preview

## Conventions
- Use clean, professional layouts with consistent fonts and spacing
- Include headers, footers, and page numbers for multi-page documents
- Support merge fields from any extension's data (contacts, deals, properties)

## Dependencies
- pdf-lib or pdfkit for TypeScript-native PDF generation
- Template system with {{field}} placeholders

## Quality Gates
- Generated PDFs must open correctly in standard PDF readers
- All merge fields must be resolved (no raw {{field}} in output)
- File size should be reasonable (compress images if needed)`
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
    description: 'Send emails programmatically via SMTP',
    category: 'communication',
    icon: 'send',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Compose the email with recipient, subject, and body
2. Apply merge fields from contact or deal data
3. Attach files if needed (PDFs, spreadsheets)
4. Send via configured SMTP server and track delivery status

## Conventions
- Always include plain text fallback for HTML emails
- Use merge fields for personalization ({{firstName}}, {{company}})
- Respect opt-out preferences and include unsubscribe links for marketing emails

## Dependencies
- nodemailer with SMTP config (Gmail, Outlook, custom)
- HTML template engine with merge field support

## Quality Gates
- Emails must be deliverable (valid SMTP config, proper FROM address)
- Attachments must be properly encoded and sized appropriately
- Track sent/failed status for every email`
  },
  {
    id: 'sms-mms',
    displayName: 'SMS / MMS',
    description: 'Send text messages programmatically',
    category: 'communication',
    icon: 'message-circle',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Compose the message with recipient phone number and body
2. Apply merge fields from contact data
3. Attach media for MMS if needed
4. Send via SMS gateway and track delivery status

## Conventions
- Keep SMS under 160 characters when possible
- Include opt-out instructions for marketing messages
- Use E.164 phone number format (+1XXXXXXXXXX)

## Dependencies
- Twilio API or generic SMS gateway
- Template system with merge fields

## Quality Gates
- Messages must be deliverable (valid phone numbers, proper formatting)
- Track delivery status (sent, delivered, failed)
- Respect opt-in/opt-out preferences`
  },
  {
    id: 'charts-visualization',
    displayName: 'Charts & Visualization',
    description: 'Generate charts and data visualizations',
    category: 'data',
    icon: 'sparkles',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Collect data points from the user's request or extension data
2. Determine the appropriate chart type (bar, line, pie, funnel, etc.)
3. Configure chart options (colors, labels, axes, legends)
4. Render the chart for display or export (PNG/SVG for PDF embedding)

## Conventions
- Use consistent color palettes aligned with the app theme
- Always include axis labels, titles, and legends
- Support responsive sizing for different container widths

## Dependencies
- chart.js for interactive charts in the renderer
- Server-side rendering to PNG/SVG for PDF embedding

## Quality Gates
- Charts must accurately represent the underlying data
- Labels must be readable (no overlapping text)
- Export images must be high-resolution for print`
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
    description: 'Business and real estate financial formulas',
    category: 'data',
    icon: 'calculator',
    type: 'instruction',
    isBuiltIn: false,
    content: `## Workflow
1. Identify the financial calculation needed (ROI, cap rate, DSCR, etc.)
2. Collect required inputs (purchase price, rental income, expenses, etc.)
3. Run the calculation using standard financial formulas
4. Present results with clear labels and formatting

## Conventions
- Use standard financial formulas (ROI, cap rate, cash-on-cash, DSCR, mortgage amortization)
- Format currency values with commas and 2 decimal places
- Show formula breakdown so users can verify calculations

## Dependencies
- Pure TypeScript calculation library (no external APIs)
- Support for: ROI, cap rate, cash-on-cash return, DSCR, mortgage amortization, rental yield, break-even analysis

## Quality Gates
- Calculations must be mathematically correct
- Handle edge cases (division by zero, negative values)
- Results should match industry-standard calculators`
  },
  {
    id: 'ocr-extraction',
    displayName: 'OCR / Text Extraction',
    description: 'Extract text from images and scanned documents',
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
      isInstalled: skill.isBuiltIn || settings.get(`skill.${skill.id}.installed`) === '1'
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
