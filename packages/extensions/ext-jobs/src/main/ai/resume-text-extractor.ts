import { readFileSync } from 'fs'
import { extname } from 'path'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('ResumeTextExtractor')

const MAX_TEXT_LENGTH = 8000

export class ResumeTextExtractor {
  async extractText(filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase()

    switch (ext) {
      case '.pdf':
        return this.extractFromPdf(filePath)
      case '.txt':
        return readFileSync(filePath, 'utf-8').substring(0, MAX_TEXT_LENGTH)
      default:
        throw new Error(`Unsupported resume format: ${ext}. Please upload a PDF or TXT file.`)
    }
  }

  private async extractFromPdf(filePath: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const buffer = readFileSync(filePath)
    const data = await pdfParse(buffer)
    const text: string = data.text || ''
    log.info(`Extracted ${text.length} chars from PDF: ${filePath}`)
    return text.substring(0, MAX_TEXT_LENGTH)
  }
}
