// ============================================================================
// OpenOrbit — OCR Text Extraction Skill
//
// Extract text from images using tesseract.js (local OCR, no API key needed).
// Supports structured extraction for receipts, business cards, and general.
// ============================================================================

import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import type { Skill, SkillResult } from '../skill-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReceiptData {
  vendor?: string
  date?: string
  total?: string
  subtotal?: string
  tax?: string
  items: Array<{
    description: string
    quantity?: string
    price?: string
  }>
  paymentMethod?: string
}

interface BusinessCardData {
  name?: string
  title?: string
  company?: string
  email?: string
  phone?: string
  address?: string
  website?: string
}

interface GeneralStructuredData {
  paragraphs: string[]
  lines: string[]
  words: string[]
}

export type StructuredExtractionType = 'receipt' | 'business_card' | 'general'

// ---------------------------------------------------------------------------
// Tesseract Dynamic Import
// ---------------------------------------------------------------------------

async function getTesseract(): Promise<typeof import('tesseract.js')> {
  const mod = await import('tesseract.js')
  return mod.default ?? mod
}

// ---------------------------------------------------------------------------
// Structured Extractors
// ---------------------------------------------------------------------------

function extractReceiptData(text: string): ReceiptData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const result: ReceiptData = { items: [] }

  // Common patterns
  const totalPattern = /(?:total|amount due|grand total)[\s:]*\$?([\d,.]+)/i
  const subtotalPattern = /(?:subtotal|sub-total)[\s:]*\$?([\d,.]+)/i
  const taxPattern = /(?:tax|gst|hst|vat)[\s:]*\$?([\d,.]+)/i
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/
  const pricePattern = /\$?([\d]+\.[\d]{2})\s*$/

  // First non-empty line is often the vendor
  if (lines.length > 0) {
    result.vendor = lines[0]
  }

  for (const line of lines) {
    // Date
    const dateMatch = line.match(datePattern)
    if (dateMatch && !result.date) {
      result.date = dateMatch[1]
    }

    // Total
    const totalMatch = line.match(totalPattern)
    if (totalMatch) {
      result.total = totalMatch[1]
    }

    // Subtotal
    const subtotalMatch = line.match(subtotalPattern)
    if (subtotalMatch) {
      result.subtotal = subtotalMatch[1]
    }

    // Tax
    const taxMatch = line.match(taxPattern)
    if (taxMatch) {
      result.tax = taxMatch[1]
    }

    // Payment method
    if (/(?:visa|mastercard|amex|debit|credit|cash)/i.test(line)) {
      result.paymentMethod = line
    }

    // Line items (lines with prices that aren't totals/subtotals/tax)
    const priceMatch = line.match(pricePattern)
    if (
      priceMatch &&
      !totalPattern.test(line) &&
      !subtotalPattern.test(line) &&
      !taxPattern.test(line)
    ) {
      const description = line.replace(pricePattern, '').trim()
      if (description) {
        result.items.push({
          description,
          price: priceMatch[1]
        })
      }
    }
  }

  return result
}

function extractBusinessCardData(text: string): BusinessCardData {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const result: BusinessCardData = {}

  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  const phonePattern = /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/
  const websitePattern = /(?:www\.|https?:\/\/)?[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/

  for (const line of lines) {
    // Email
    const emailMatch = line.match(emailPattern)
    if (emailMatch && !result.email) {
      result.email = emailMatch[0]
    }

    // Phone
    const phoneMatch = line.match(phonePattern)
    if (phoneMatch && !result.phone) {
      result.phone = phoneMatch[0]
    }

    // Website
    const websiteMatch = line.match(websitePattern)
    if (
      websiteMatch &&
      !result.website &&
      !emailPattern.test(line) // Exclude email domains
    ) {
      result.website = websiteMatch[0]
    }
  }

  // Name is typically the first or most prominent line
  // Title often follows name or contains keywords
  const titleKeywords = [
    'ceo',
    'cto',
    'cfo',
    'president',
    'director',
    'manager',
    'engineer',
    'developer',
    'designer',
    'consultant',
    'founder',
    'partner',
    'vp',
    'vice president',
    'specialist',
    'analyst'
  ]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip lines that are email/phone/website
    if (emailPattern.test(line) || phonePattern.test(line) || /(?:www\.|https?:\/\/)/.test(line)) {
      continue
    }

    // Check for title keywords
    const lowerLine = line.toLowerCase()
    const hasTitle = titleKeywords.some((kw) => lowerLine.includes(kw))

    if (hasTitle && !result.title) {
      result.title = line
    } else if (!result.name && line.length < 50) {
      // First short line without title keywords is likely the name
      result.name = line
    } else if (!result.company && line.length < 100 && !hasTitle) {
      // Company name is usually another short line
      if (result.name && result.name !== line) {
        result.company = line
      }
    }
  }

  // Address heuristic: look for street numbers, zip codes
  for (const line of lines) {
    if (/\d+\s+[a-zA-Z]+\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane)/i.test(line)) {
      result.address = line
      break
    }
    if (/\d{5}(-\d{4})?/.test(line) && /[a-zA-Z]/.test(line)) {
      result.address = line
      break
    }
  }

  return result
}

function extractGeneralData(text: string): GeneralStructuredData {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/[^\w'-]/g, ''))
    .filter((w) => w.length > 0)

  return { paragraphs, lines, words }
}

// ---------------------------------------------------------------------------
// OCR Skill
// ---------------------------------------------------------------------------

export function createOcrSkill(extensionId: string): Skill {
  return {
    id: 'ocr-extract',
    displayName: 'OCR Text Extraction',
    icon: 'scan',
    description:
      'Extract text from images using local OCR (tesseract.js). No API key needed. Supports structured extraction for receipts, business cards, and general documents.',
    category: 'media',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        imagePath: {
          type: 'string',
          description: 'Path to the image file (PNG, JPEG, TIFF, BMP, GIF, WebP)'
        },
        imageBase64: {
          type: 'string',
          description: 'Base64-encoded image data (alternative to imagePath)'
        },
        language: {
          type: 'string',
          description:
            'OCR language code (default: "eng"). Common: eng, spa, fra, deu, chi_sim, jpn, kor'
        },
        structured: {
          type: 'boolean',
          description: 'Enable structured data extraction (default: false)'
        },
        structuredType: {
          type: 'string',
          description: 'Type of structured extraction',
          enum: ['receipt', 'business_card', 'general']
        },
        psm: {
          type: 'number',
          description:
            'Page segmentation mode (0-13). Default 3 (auto). Use 6 for single block, 7 for single line.'
        }
      },
      required: []
    },
    outputSchema: {
      type: 'object',
      description: 'OCR extraction result',
      properties: {
        text: { type: 'string', description: 'Extracted raw text' },
        confidence: {
          type: 'number',
          description: 'Overall confidence score (0-100)'
        },
        structured: {
          type: 'object',
          description: 'Structured data if enabled'
        },
        wordCount: { type: 'number', description: 'Number of words detected' },
        lineCount: { type: 'number', description: 'Number of lines detected' }
      }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const imagePath = input.imagePath as string | undefined
      const imageBase64 = input.imageBase64 as string | undefined
      const language = (input.language as string) ?? 'eng'
      const structured = input.structured === true
      const structuredType = (input.structuredType as StructuredExtractionType) ?? 'general'
      const psm = input.psm as number | undefined

      // Validate input
      if (!imagePath && !imageBase64) {
        return {
          success: false,
          error: 'Either "imagePath" or "imageBase64" is required'
        }
      }

      if (imagePath && !existsSync(imagePath)) {
        return { success: false, error: `Image file not found: ${imagePath}` }
      }

      try {
        const Tesseract = await getTesseract()

        // Create worker
        const worker = await Tesseract.createWorker(language)

        // Set page segmentation mode if specified
        if (psm !== undefined) {
          await worker.setParameters({
            tessedit_pageseg_mode: String(psm)
          })
        }

        // Get image data
        let imageData: string | Buffer
        if (imageBase64) {
          imageData = Buffer.from(imageBase64, 'base64')
        } else {
          imageData = await readFile(imagePath!)
        }

        // Recognize text
        const result = await worker.recognize(imageData)

        // Terminate worker
        await worker.terminate()

        const text = result.data.text
        const confidence = result.data.confidence
        const words = result.data.words?.length ?? text.split(/\s+/).filter(Boolean).length
        const lines = text.split('\n').filter((l) => l.trim()).length

        // Build response
        const response: Record<string, unknown> = {
          text,
          confidence: Math.round(confidence * 100) / 100,
          wordCount: words,
          lineCount: lines
        }

        // Add structured data if requested
        if (structured) {
          switch (structuredType) {
            case 'receipt':
              response.structured = extractReceiptData(text)
              break
            case 'business_card':
              response.structured = extractBusinessCardData(text)
              break
            case 'general':
            default:
              response.structured = extractGeneralData(text)
              break
          }
        }

        return {
          success: true,
          data: response,
          summary: `Extracted ${words} words from image (${Math.round(confidence)}% confidence)`
        }
      } catch (err) {
        return {
          success: false,
          error: `OCR extraction failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
