// ============================================================================
// OpenOrbit — PDF Builder
//
// Wrapper around pdf-lib for generating PDFs from structured content.
// Supports text blocks, tables, images, headers/footers.
// ============================================================================

import { PDFDocument, StandardFonts, rgb, PageSizes } from 'pdf-lib'
import { readFile } from 'fs/promises'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfTextBlock {
  type: 'text'
  content: string
  fontSize?: number
  bold?: boolean
  color?: { r: number; g: number; b: number }
  align?: 'left' | 'center' | 'right'
  marginBottom?: number
}

export interface PdfKeyValueBlock {
  type: 'key-value'
  items: Array<{ key: string; value: string }>
  columns?: 1 | 2 | 3
  marginBottom?: number
}

export interface PdfHeadingBlock {
  type: 'heading'
  level: 1 | 2 | 3
  content: string
  marginBottom?: number
}

export interface PdfTableBlock {
  type: 'table'
  headers: string[]
  rows: string[][]
  columnWidths?: number[] // percentages, should sum to 100
  marginBottom?: number
}

export interface PdfImageBlock {
  type: 'image'
  path?: string
  base64?: string
  mimeType?: 'image/png' | 'image/jpeg'
  width?: number
  height?: number
  align?: 'left' | 'center' | 'right'
  caption?: string
  marginBottom?: number
}

export interface PdfDividerBlock {
  type: 'divider'
  marginBottom?: number
}

export interface PdfSpacerBlock {
  type: 'spacer'
  height: number
}

export type PdfBlock =
  | PdfTextBlock
  | PdfHeadingBlock
  | PdfKeyValueBlock
  | PdfTableBlock
  | PdfImageBlock
  | PdfDividerBlock
  | PdfSpacerBlock

export interface PdfBuildOptions {
  title?: string
  author?: string
  pageSize?: 'letter' | 'a4'
  margins?: { top: number; right: number; bottom: number; left: number }
  header?: string
  footer?: string
  mergeFields?: Record<string, string>
}

export interface PdfBuildResult {
  buffer: Buffer
  pageCount: number
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_MARGINS = { top: 72, right: 72, bottom: 72, left: 72 }
const DEFAULT_FONT_SIZE = 12
const HEADING_SIZES: Record<1 | 2 | 3, number> = { 1: 24, 2: 18, 3: 14 }
const LINE_HEIGHT_FACTOR = 1.4

// ---------------------------------------------------------------------------
// PDF Builder
// ---------------------------------------------------------------------------

export class PdfBuilder {
  private doc: PDFDocument | null = null
  private options: Required<PdfBuildOptions>
  private currentY: number = 0
  private pageWidth: number = 0
  private pageHeight: number = 0
  private contentWidth: number = 0

  constructor(options: PdfBuildOptions = {}) {
    const pageSize = options.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter
    this.pageWidth = pageSize[0]
    this.pageHeight = pageSize[1]

    this.options = {
      title: options.title ?? '',
      author: options.author ?? 'OpenOrbit',
      pageSize: options.pageSize ?? 'letter',
      margins: options.margins ?? DEFAULT_MARGINS,
      header: options.header ?? '',
      footer: options.footer ?? '',
      mergeFields: options.mergeFields ?? {}
    }

    this.contentWidth = this.pageWidth - this.options.margins.left - this.options.margins.right
  }

  async build(blocks: PdfBlock[]): Promise<PdfBuildResult> {
    this.doc = await PDFDocument.create()

    if (this.options.title) {
      this.doc.setTitle(this.options.title)
    }
    if (this.options.author) {
      this.doc.setAuthor(this.options.author)
    }

    // Start first page
    this.addPage()

    const font = await this.doc.embedFont(StandardFonts.Helvetica)
    const boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold)

    for (const block of blocks) {
      await this.renderBlock(block, font, boldFont)
    }

    // Add headers/footers to all pages
    if (this.options.header || this.options.footer) {
      const pages = this.doc.getPages()
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i]

        if (this.options.header) {
          page.drawText(this.options.header, {
            x: this.options.margins.left,
            y: this.pageHeight - 40,
            size: 10,
            font,
            color: rgb(0.5, 0.5, 0.5)
          })
        }

        if (this.options.footer) {
          const footerText = this.options.footer.replace('{{page}}', String(i + 1))
          const footerWidth = font.widthOfTextAtSize(footerText, 10)
          page.drawText(footerText, {
            x: (this.pageWidth - footerWidth) / 2,
            y: 30,
            size: 10,
            font,
            color: rgb(0.5, 0.5, 0.5)
          })
        }
      }
    }

    const buffer = Buffer.from(await this.doc.save())
    return {
      buffer,
      pageCount: this.doc.getPageCount()
    }
  }

  private addPage(): void {
    if (!this.doc) return

    const pageSize = this.options.pageSize === 'a4' ? PageSizes.A4 : PageSizes.Letter
    this.doc.addPage(pageSize)
    this.currentY = this.pageHeight - this.options.margins.top
  }

  private getCurrentPage(): ReturnType<PDFDocument['getPages']>[number] | null {
    if (!this.doc) return null
    const pages = this.doc.getPages()
    return pages[pages.length - 1]
  }

  private checkPageBreak(neededHeight: number): void {
    if (this.currentY - neededHeight < this.options.margins.bottom) {
      this.addPage()
    }
  }

  private async renderBlock(
    block: PdfBlock,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
  ): Promise<void> {
    const page = this.getCurrentPage()
    if (!page) return

    // Apply merge fields to the block
    const processedBlock = this.applyMergeFields(block)

    switch (processedBlock.type) {
      case 'text':
        await this.renderText(processedBlock, font, boldFont)
        break
      case 'heading':
        await this.renderHeading(processedBlock, boldFont)
        break
      case 'key-value':
        await this.renderKeyValue(processedBlock, font, boldFont)
        break
      case 'table':
        await this.renderTable(processedBlock, font, boldFont)
        break
      case 'image':
        await this.renderImage(processedBlock)
        break
      case 'divider':
        this.renderDivider(processedBlock)
        break
      case 'spacer':
        this.renderSpacer(processedBlock)
        break
    }
  }

  private applyMergeFields(block: PdfBlock): PdfBlock {
    const fields = this.options.mergeFields
    if (!fields || Object.keys(fields).length === 0) return block

    const replaceMerge = (text: string): string =>
      text.replace(/\{\{(\w+)\}\}/g, (_, key) => fields[key] ?? `{{${key}}}`)

    switch (block.type) {
      case 'text':
        return { ...block, content: replaceMerge(block.content) }
      case 'heading':
        return { ...block, content: replaceMerge(block.content) }
      case 'key-value':
        return {
          ...block,
          items: block.items.map((item) => ({
            key: replaceMerge(item.key),
            value: replaceMerge(item.value)
          }))
        }
      case 'table':
        return {
          ...block,
          headers: block.headers.map(replaceMerge),
          rows: block.rows.map((row) => row.map(replaceMerge))
        }
      case 'image':
        return {
          ...block,
          caption: block.caption ? replaceMerge(block.caption) : undefined
        }
      default:
        return block
    }
  }

  private async renderText(
    block: PdfTextBlock,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
  ): Promise<void> {
    const page = this.getCurrentPage()
    if (!page) return

    const fontSize = block.fontSize ?? DEFAULT_FONT_SIZE
    const lineHeight = fontSize * LINE_HEIGHT_FACTOR
    const textFont = block.bold ? boldFont : font
    const color = block.color
      ? rgb(block.color.r / 255, block.color.g / 255, block.color.b / 255)
      : rgb(0, 0, 0)

    // Word wrap the text
    const lines = this.wrapText(block.content, textFont, fontSize)

    for (const line of lines) {
      this.checkPageBreak(lineHeight)

      let x = this.options.margins.left
      if (block.align === 'center') {
        const textWidth = textFont.widthOfTextAtSize(line, fontSize)
        x = (this.pageWidth - textWidth) / 2
      } else if (block.align === 'right') {
        const textWidth = textFont.widthOfTextAtSize(line, fontSize)
        x = this.pageWidth - this.options.margins.right - textWidth
      }

      this.getCurrentPage()?.drawText(line, {
        x,
        y: this.currentY - fontSize,
        size: fontSize,
        font: textFont,
        color
      })

      this.currentY -= lineHeight
    }

    this.currentY -= block.marginBottom ?? 10
  }

  private async renderHeading(
    block: PdfHeadingBlock,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
  ): Promise<void> {
    const page = this.getCurrentPage()
    if (!page) return

    const fontSize = HEADING_SIZES[block.level]
    const lineHeight = fontSize * LINE_HEIGHT_FACTOR

    this.checkPageBreak(lineHeight)

    page.drawText(block.content, {
      x: this.options.margins.left,
      y: this.currentY - fontSize,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0)
    })

    this.currentY -= lineHeight + (block.marginBottom ?? 15)
  }

  private async renderKeyValue(
    block: PdfKeyValueBlock,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
  ): Promise<void> {
    const columns = block.columns ?? 2
    const columnWidth = this.contentWidth / columns
    const fontSize = DEFAULT_FONT_SIZE
    const rowHeight = fontSize * LINE_HEIGHT_FACTOR * 1.3

    let currentColumn = 0

    for (const item of block.items) {
      if (currentColumn === 0) {
        this.checkPageBreak(rowHeight)
      }

      const x = this.options.margins.left + currentColumn * columnWidth

      // Key (bold)
      const keyText = `${item.key}: `
      this.getCurrentPage()?.drawText(keyText, {
        x,
        y: this.currentY - fontSize,
        size: fontSize,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3)
      })

      // Value
      const keyWidth = boldFont.widthOfTextAtSize(keyText, fontSize)
      const maxValueWidth = columnWidth - keyWidth - 10
      const truncatedValue = this.truncateText(item.value, font, fontSize, maxValueWidth)

      this.getCurrentPage()?.drawText(truncatedValue, {
        x: x + keyWidth,
        y: this.currentY - fontSize,
        size: fontSize,
        font,
        color: rgb(0, 0, 0)
      })

      currentColumn++
      if (currentColumn >= columns) {
        currentColumn = 0
        this.currentY -= rowHeight
      }
    }

    // If we ended mid-row, move to next row
    if (currentColumn !== 0) {
      this.currentY -= rowHeight
    }

    this.currentY -= block.marginBottom ?? 10
  }

  private async renderTable(
    block: PdfTableBlock,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    boldFont: Awaited<ReturnType<PDFDocument['embedFont']>>
  ): Promise<void> {
    const fontSize = 10
    const cellPadding = 5
    const rowHeight = fontSize + cellPadding * 2

    const colCount = block.headers.length
    const defaultWidth = this.contentWidth / colCount
    const columnWidths =
      block.columnWidths?.map((pct) => (this.contentWidth * pct) / 100) ??
      Array(colCount).fill(defaultWidth)

    // Draw header row
    this.checkPageBreak(rowHeight)
    let x = this.options.margins.left

    // Header background
    this.getCurrentPage()?.drawRectangle({
      x,
      y: this.currentY - rowHeight,
      width: this.contentWidth,
      height: rowHeight,
      color: rgb(0.9, 0.9, 0.9)
    })

    // Header text
    for (let i = 0; i < block.headers.length; i++) {
      const truncated = this.truncateText(
        block.headers[i],
        boldFont,
        fontSize,
        columnWidths[i] - cellPadding * 2
      )
      this.getCurrentPage()?.drawText(truncated, {
        x: x + cellPadding,
        y: this.currentY - rowHeight + cellPadding,
        size: fontSize,
        font: boldFont,
        color: rgb(0, 0, 0)
      })
      x += columnWidths[i]
    }
    this.currentY -= rowHeight

    // Draw data rows
    for (const row of block.rows) {
      this.checkPageBreak(rowHeight)
      x = this.options.margins.left

      // Row border
      this.getCurrentPage()?.drawLine({
        start: { x, y: this.currentY },
        end: { x: x + this.contentWidth, y: this.currentY },
        thickness: 0.5,
        color: rgb(0.8, 0.8, 0.8)
      })

      for (let i = 0; i < row.length && i < columnWidths.length; i++) {
        const truncated = this.truncateText(
          row[i] ?? '',
          font,
          fontSize,
          columnWidths[i] - cellPadding * 2
        )
        this.getCurrentPage()?.drawText(truncated, {
          x: x + cellPadding,
          y: this.currentY - rowHeight + cellPadding,
          size: fontSize,
          font,
          color: rgb(0, 0, 0)
        })
        x += columnWidths[i]
      }
      this.currentY -= rowHeight
    }

    this.currentY -= block.marginBottom ?? 15
  }

  private async renderImage(block: PdfImageBlock): Promise<void> {
    if (!this.doc) return

    try {
      let imageData: Uint8Array
      let isPng: boolean

      if (block.base64) {
        // Base64 image
        const base64Data = block.base64.replace(/^data:image\/\w+;base64,/, '')
        imageData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0))
        isPng = block.mimeType === 'image/png'
      } else if (block.path) {
        // File path image
        imageData = await readFile(block.path)
        isPng = block.path.toLowerCase().endsWith('.png')
      } else {
        return // No image source provided
      }

      const image = isPng ? await this.doc.embedPng(imageData) : await this.doc.embedJpg(imageData)

      let width = block.width ?? image.width
      let height = block.height ?? image.height

      // Scale to fit content width if needed
      if (width > this.contentWidth) {
        const scale = this.contentWidth / width
        width = this.contentWidth
        height = height * scale
      }

      const totalHeight = height + (block.caption ? 18 : 0)
      this.checkPageBreak(totalHeight)

      let x = this.options.margins.left
      if (block.align === 'center') {
        x = (this.pageWidth - width) / 2
      } else if (block.align === 'right') {
        x = this.pageWidth - this.options.margins.right - width
      }

      this.getCurrentPage()?.drawImage(image, {
        x,
        y: this.currentY - height,
        width,
        height
      })

      this.currentY -= height

      // Render caption if provided
      if (block.caption) {
        const captionSize = 9
        const font = await this.doc.embedFont(StandardFonts.Helvetica)
        const captionWidth = font.widthOfTextAtSize(block.caption, captionSize)
        const captionX = (this.pageWidth - captionWidth) / 2

        this.currentY -= 4
        this.getCurrentPage()?.drawText(block.caption, {
          x: captionX,
          y: this.currentY - captionSize,
          size: captionSize,
          font,
          color: rgb(0.4, 0.4, 0.4)
        })
        this.currentY -= captionSize + 4
      }

      this.currentY -= block.marginBottom ?? 15
    } catch {
      // Image failed to load, skip silently
    }
  }

  private renderDivider(block: PdfDividerBlock): void {
    this.checkPageBreak(10)

    this.getCurrentPage()?.drawLine({
      start: { x: this.options.margins.left, y: this.currentY - 5 },
      end: {
        x: this.pageWidth - this.options.margins.right,
        y: this.currentY - 5
      },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7)
    })

    this.currentY -= 10 + (block.marginBottom ?? 10)
  }

  private renderSpacer(block: PdfSpacerBlock): void {
    this.currentY -= block.height
    if (this.currentY < this.options.margins.bottom) {
      this.addPage()
    }
  }

  private wrapText(
    text: string,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    fontSize: number
  ): string[] {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = font.widthOfTextAtSize(testLine, fontSize)

      if (testWidth > this.contentWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    return lines.length > 0 ? lines : ['']
  }

  private truncateText(
    text: string,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    fontSize: number,
    maxWidth: number
  ): string {
    if (font.widthOfTextAtSize(text, fontSize) <= maxWidth) {
      return text
    }

    let truncated = text
    while (truncated.length > 0 && font.widthOfTextAtSize(truncated + '...', fontSize) > maxWidth) {
      truncated = truncated.slice(0, -1)
    }

    return truncated + '...'
  }
}
