// ============================================================================
// OpenOrbit — PDF Generation Skill
//
// Generate PDF documents from structured content blocks. Supports text,
// headings, tables, images, dividers, and page configuration.
// ============================================================================

import { writeFile, mkdir } from 'fs/promises'
import { dirname, resolve } from 'path'
import { randomUUID } from 'crypto'
import { tmpdir } from 'os'
import type { Skill, SkillResult } from '../skill-types'
import { PdfBuilder, type PdfBlock, type PdfBuildOptions } from './pdf-builder'

export function createPdfGenerateSkill(extensionId: string): Skill {
  return {
    id: 'pdf-generate',
    displayName: 'PDF Generator',
    icon: 'file-text',
    description:
      'Generate a PDF document from structured content blocks. Supports text, headings, tables, images, and dividers with configurable page size, margins, and headers/footers.',
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
        blocks: {
          type: 'array',
          description:
            'Array of content blocks. Each block has a "type" (text, heading, key-value, table, image, divider, spacer) and type-specific properties.',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                description: 'Block type: text, heading, key-value, table, image, divider, spacer'
              },
              content: {
                type: 'string',
                description: 'Text content (for text/heading blocks)'
              },
              level: {
                type: 'number',
                description: 'Heading level 1-3 (for heading blocks)'
              },
              items: {
                type: 'array',
                description: 'Key-value pairs (for key-value blocks)',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string' },
                    value: { type: 'string' }
                  }
                }
              },
              columns: {
                type: 'number',
                description: 'Number of columns for key-value display (1-3)'
              },
              headers: {
                type: 'array',
                description: 'Table column headers (for table blocks)',
                items: { type: 'string' }
              },
              rows: {
                type: 'array',
                description: 'Table data rows (for table blocks)',
                items: { type: 'array', items: { type: 'string' } }
              },
              path: {
                type: 'string',
                description: 'Image file path (for image blocks)'
              },
              base64: {
                type: 'string',
                description: 'Base64-encoded image data (for image blocks)'
              },
              mimeType: {
                type: 'string',
                description: 'Image MIME type: image/png or image/jpeg'
              },
              caption: {
                type: 'string',
                description: 'Image caption text'
              },
              fontSize: { type: 'number', description: 'Font size in points' },
              bold: { type: 'boolean', description: 'Use bold font' },
              align: {
                type: 'string',
                description: 'Text alignment: left, center, right'
              },
              height: {
                type: 'number',
                description: 'Spacer height in points'
              }
            }
          }
        },
        options: {
          type: 'object',
          description: 'PDF configuration options',
          properties: {
            title: { type: 'string', description: 'Document title (metadata)' },
            author: {
              type: 'string',
              description: 'Document author (metadata)'
            },
            pageSize: {
              type: 'string',
              description: 'Page size: letter or a4',
              enum: ['letter', 'a4']
            },
            header: { type: 'string', description: 'Header text for each page' },
            footer: {
              type: 'string',
              description: 'Footer text for each page. Use {{page}} for page number.'
            },
            mergeFields: {
              type: 'object',
              description: 'Key-value pairs to replace {{fieldName}} placeholders in content'
            }
          }
        },
        outputPath: {
          type: 'string',
          description: 'Output file path. If not provided, generates a temp file.'
        }
      },
      required: ['blocks']
    },
    outputSchema: {
      type: 'object',
      description: 'Generated PDF result',
      properties: {
        filePath: { type: 'string', description: 'Path to the generated PDF' },
        pageCount: { type: 'number', description: 'Number of pages' },
        sizeBytes: { type: 'number', description: 'File size in bytes' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const blocks = input.blocks as PdfBlock[]
      const options = (input.options as PdfBuildOptions) ?? {}
      let outputPath = input.outputPath as string | undefined

      if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
        return { success: false, error: 'Missing or empty blocks array' }
      }

      // Validate block types
      const validTypes = ['text', 'heading', 'key-value', 'table', 'image', 'divider', 'spacer']
      for (const block of blocks) {
        if (!block.type || !validTypes.includes(block.type)) {
          return {
            success: false,
            error: `Invalid block type: ${block.type}. Expected one of: ${validTypes.join(', ')}`
          }
        }
      }

      try {
        const builder = new PdfBuilder(options)
        const result = await builder.build(blocks)

        // Determine output path
        if (!outputPath) {
          outputPath = resolve(tmpdir(), `openorbit-pdf-${randomUUID()}.pdf`)
        }

        // Ensure directory exists
        await mkdir(dirname(outputPath), { recursive: true })

        // Write file
        await writeFile(outputPath, result.buffer)

        return {
          success: true,
          data: {
            filePath: outputPath,
            pageCount: result.pageCount,
            sizeBytes: result.buffer.length
          },
          summary: `Generated ${result.pageCount}-page PDF (${Math.round(result.buffer.length / 1024)}KB)`
        }
      } catch (err) {
        return {
          success: false,
          error: `PDF generation failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
