// ============================================================================
// OpenOrbit — Document Generation Skill
//
// Generate documents from Markdown templates with merge field substitution.
// Outputs PDF (via pdf-generate skill), HTML, or plain text.
// ============================================================================

import { writeFile, mkdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import type { Skill, SkillResult, SkillService } from '../skill-types'
import type { PdfBlock, PdfBuildOptions } from './pdf-builder'

// ---------------------------------------------------------------------------
// Merge Field Parser
// ---------------------------------------------------------------------------

/** Regex to match merge fields: {{field}} or {{nested.field}} */
const MERGE_FIELD_REGEX = /\{\{([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g

/**
 * Get a nested value from an object using dot notation.
 * E.g., getNestedValue({ contact: { name: 'John' } }, 'contact.name') => 'John'
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Replace all merge fields in a string with values from the data object.
 */
function mergeFields(template: string, data: Record<string, unknown>): string {
  return template.replace(MERGE_FIELD_REGEX, (_match, fieldPath) => {
    const value = getNestedValue(data, fieldPath)
    if (value === undefined || value === null) return ''
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  })
}

/**
 * Extract all merge field names from a template.
 */
export function extractMergeFields(template: string): string[] {
  const fields = new Set<string>()
  let match: RegExpExecArray | null

  while ((match = MERGE_FIELD_REGEX.exec(template)) !== null) {
    fields.add(match[1])
  }

  // Reset regex lastIndex
  MERGE_FIELD_REGEX.lastIndex = 0

  return [...fields]
}

// ---------------------------------------------------------------------------
// Markdown to PDF Blocks Converter
// ---------------------------------------------------------------------------

interface MarkdownLine {
  type: 'heading' | 'paragraph' | 'list-item' | 'hr' | 'blank' | 'table-row' | 'code'
  level?: number
  content: string
}

function parseMarkdownLine(line: string): MarkdownLine {
  const trimmed = line.trim()

  // Blank line
  if (!trimmed) {
    return { type: 'blank', content: '' }
  }

  // Headings
  const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (headingMatch) {
    return {
      type: 'heading',
      level: Math.min(headingMatch[1].length, 3),
      content: headingMatch[2]
    }
  }

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(trimmed)) {
    return { type: 'hr', content: '' }
  }

  // List items
  const listMatch = trimmed.match(/^[-*+]\s+(.+)$/)
  if (listMatch) {
    return { type: 'list-item', content: listMatch[1] }
  }

  // Numbered list
  const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
  if (numberedMatch) {
    return { type: 'list-item', content: numberedMatch[1] }
  }

  // Table row
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    return { type: 'table-row', content: trimmed }
  }

  // Code block markers
  if (trimmed.startsWith('```')) {
    return { type: 'code', content: trimmed }
  }

  // Regular paragraph
  return { type: 'paragraph', content: trimmed }
}

function markdownToPdfBlocks(markdown: string): PdfBlock[] {
  const lines = markdown.split('\n')
  const blocks: PdfBlock[] = []
  let tableRows: string[][] = []
  let tableHeaders: string[] = []
  let inTable = false
  let inCodeBlock = false
  let codeContent: string[] = []
  let paragraphBuffer: string[] = []

  const flushParagraph = (): void => {
    if (paragraphBuffer.length > 0) {
      // Remove markdown formatting from inline text
      const text = paragraphBuffer
        .join(' ')
        .replace(/\*\*(.+?)\*\*/g, '$1') // bold
        .replace(/\*(.+?)\*/g, '$1') // italic
        .replace(/__(.+?)__/g, '$1') // bold
        .replace(/_(.+?)_/g, '$1') // italic
        .replace(/`(.+?)`/g, '$1') // inline code

      blocks.push({ type: 'text', content: text, marginBottom: 10 })
      paragraphBuffer = []
    }
  }

  const flushTable = (): void => {
    if (tableHeaders.length > 0 || tableRows.length > 0) {
      blocks.push({
        type: 'table',
        headers: tableHeaders,
        rows: tableRows,
        marginBottom: 15
      })
      tableHeaders = []
      tableRows = []
      inTable = false
    }
  }

  const parseTableRow = (line: string): string[] => {
    return line
      .slice(1, -1) // Remove leading/trailing |
      .split('|')
      .map((cell) => cell.trim())
  }

  const isTableSeparator = (line: string): boolean => {
    const cells = parseTableRow(line)
    return cells.every((cell) => /^:?-+:?$/.test(cell))
  }

  for (const line of lines) {
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        blocks.push({
          type: 'text',
          content: codeContent.join('\n'),
          fontSize: 10,
          marginBottom: 10
        })
        codeContent = []
        inCodeBlock = false
      } else {
        // Start code block
        flushParagraph()
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeContent.push(line)
      continue
    }

    const parsed = parseMarkdownLine(line)

    switch (parsed.type) {
      case 'heading':
        flushParagraph()
        flushTable()
        blocks.push({
          type: 'heading',
          level: (parsed.level as 1 | 2 | 3) ?? 1,
          content: parsed.content,
          marginBottom: 15
        })
        break

      case 'hr':
        flushParagraph()
        flushTable()
        blocks.push({ type: 'divider', marginBottom: 15 })
        break

      case 'list-item':
        flushParagraph()
        flushTable()
        blocks.push({
          type: 'text',
          content: `  \u2022 ${parsed.content}`,
          marginBottom: 5
        })
        break

      case 'table-row':
        flushParagraph()
        if (!inTable) {
          // First table row = headers
          tableHeaders = parseTableRow(line)
          inTable = true
        } else if (isTableSeparator(line)) {
          // Skip separator line
        } else {
          tableRows.push(parseTableRow(line))
        }
        break

      case 'blank':
        flushParagraph()
        if (inTable) {
          flushTable()
        }
        break

      case 'paragraph':
      default:
        if (inTable) {
          flushTable()
        }
        paragraphBuffer.push(parsed.content)
        break
    }
  }

  // Flush remaining content
  flushParagraph()
  flushTable()

  if (codeContent.length > 0) {
    blocks.push({
      type: 'text',
      content: codeContent.join('\n'),
      fontSize: 10,
      marginBottom: 10
    })
  }

  return blocks
}

// ---------------------------------------------------------------------------
// Markdown to HTML Converter
// ---------------------------------------------------------------------------

function markdownToHtml(markdown: string): string {
  const html = markdown
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Headings
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')

    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')

    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')

    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '<hr>')

    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')

    // Line breaks to paragraphs
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim()
      if (!trimmed) return ''
      if (trimmed.startsWith('<h')) return trimmed
      if (trimmed.startsWith('<hr')) return trimmed
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { margin-top: 24px; margin-bottom: 16px; }
    p { margin-bottom: 16px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: monospace; }
    hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f4f4f4; }
  </style>
</head>
<body>
${html}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Document Generation Skill
// ---------------------------------------------------------------------------

// Reference to skill service for calling pdf-generate
let skillServiceRef: SkillService | null = null

export function setDocGenerateSkillService(service: SkillService): void {
  skillServiceRef = service
}

export function createDocGenerateSkill(extensionId: string): Skill {
  return {
    id: 'doc-generate',
    displayName: 'Document Generator',
    icon: 'file-plus',
    description:
      'Generate documents from Markdown templates with merge field substitution ({{field}} or {{nested.field}}). Outputs PDF, HTML, or plain text.',
    category: 'document',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description:
            'Markdown template content with {{field}} placeholders, or path to a .md template file'
        },
        templatePath: {
          type: 'string',
          description: 'Path to a Markdown template file (alternative to inline template)'
        },
        data: {
          type: 'object',
          description:
            'Data object for merge field substitution. Supports nested fields (e.g., data.contact.name for {{contact.name}})'
        },
        outputFormat: {
          type: 'string',
          description: 'Output format',
          enum: ['pdf', 'html', 'text']
        },
        outputPath: {
          type: 'string',
          description: 'Output file path. If omitted, generates a temp file.'
        },
        pdfOptions: {
          type: 'object',
          description: 'PDF-specific options (only for pdf output)',
          properties: {
            title: { type: 'string', description: 'Document title metadata' },
            author: { type: 'string', description: 'Document author metadata' },
            pageSize: { type: 'string', description: 'letter or a4' },
            header: { type: 'string', description: 'Header text' },
            footer: { type: 'string', description: 'Footer text ({{page}} for page number)' }
          }
        }
      },
      required: ['data']
    },
    outputSchema: {
      type: 'object',
      description: 'Generated document result',
      properties: {
        filePath: { type: 'string', description: 'Path to generated file' },
        format: { type: 'string', description: 'Output format used' },
        sizeBytes: { type: 'number', description: 'File size in bytes' },
        mergeFieldsUsed: {
          type: 'array',
          description: 'List of merge fields found in template',
          items: { type: 'string' }
        }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      let template = input.template as string | undefined
      const templatePath = input.templatePath as string | undefined
      const data = (input.data as Record<string, unknown>) ?? {}
      const outputFormat = (input.outputFormat as 'pdf' | 'html' | 'text') ?? 'pdf'
      let outputPath = input.outputPath as string | undefined
      const pdfOptions = (input.pdfOptions as PdfBuildOptions) ?? {}

      // Load template from file if path provided
      if (templatePath) {
        if (!existsSync(templatePath)) {
          return { success: false, error: `Template file not found: ${templatePath}` }
        }
        try {
          template = await readFile(templatePath, 'utf-8')
        } catch (err) {
          return {
            success: false,
            error: `Failed to read template: ${err instanceof Error ? err.message : String(err)}`
          }
        }
      }

      if (!template) {
        return {
          success: false,
          error: 'Either "template" (string) or "templatePath" (file path) is required'
        }
      }

      // Extract and apply merge fields
      const mergeFieldsUsed = extractMergeFields(template)
      const mergedContent = mergeFields(template, data)

      try {
        let buffer: Buffer
        let ext: string

        switch (outputFormat) {
          case 'html':
            buffer = Buffer.from(markdownToHtml(mergedContent), 'utf-8')
            ext = 'html'
            break

          case 'text': {
            // Strip markdown formatting for plain text
            const plainText = mergedContent
              .replace(/^#{1,6}\s+/gm, '') // Remove heading markers
              .replace(/\*\*(.+?)\*\*/g, '$1') // bold
              .replace(/\*(.+?)\*/g, '$1') // italic
              .replace(/__(.+?)__/g, '$1') // bold
              .replace(/_(.+?)_/g, '$1') // italic
              .replace(/`(.+?)`/g, '$1') // inline code
              .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links (keep text)
              .replace(/^[-*_]{3,}$/gm, '---') // hr
            buffer = Buffer.from(plainText, 'utf-8')
            ext = 'txt'
            break
          }

          case 'pdf':
          default: {
            // Convert markdown to PDF blocks and generate PDF
            const pdfBlocks = markdownToPdfBlocks(mergedContent)

            // Use the pdf-generate skill if available
            if (skillServiceRef) {
              const result = await skillServiceRef.execute('pdf-generate', {
                blocks: pdfBlocks,
                options: pdfOptions,
                outputPath
              })

              if (!result.success) {
                return { success: false, error: result.error ?? 'PDF generation failed' }
              }

              const resultData = result.data as {
                filePath: string
                sizeBytes: number
              }

              return {
                success: true,
                data: {
                  filePath: resultData.filePath,
                  format: 'pdf',
                  sizeBytes: resultData.sizeBytes,
                  mergeFieldsUsed
                },
                summary: `Generated PDF with ${mergeFieldsUsed.length} merge fields`
              }
            }

            // Fallback: use PdfBuilder directly
            const { PdfBuilder } = await import('./pdf-builder')
            const builder = new PdfBuilder(pdfOptions)
            const pdfResult = await builder.build(pdfBlocks)
            buffer = pdfResult.buffer
            ext = 'pdf'
            break
          }
        }

        // Determine output path
        if (!outputPath) {
          outputPath = resolve(tmpdir(), `openorbit-doc-${randomUUID()}.${ext}`)
        }

        // Ensure directory exists
        await mkdir(dirname(outputPath), { recursive: true })

        // Write file
        await writeFile(outputPath, buffer)

        return {
          success: true,
          data: {
            filePath: outputPath,
            format: outputFormat,
            sizeBytes: buffer.length,
            mergeFieldsUsed
          },
          summary: `Generated ${outputFormat.toUpperCase()} document with ${mergeFieldsUsed.length} merge fields`
        }
      } catch (err) {
        return {
          success: false,
          error: `Document generation failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
