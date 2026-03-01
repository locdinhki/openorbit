// ============================================================================
// ext-docs — IPC Handlers
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { createLogger } from '@openorbit/core/utils/logger'
import { EXT_DOCS_IPC } from '../ipc-channels'
import { extDocsSchemas } from '../ipc-schemas'
import { DocumentsRepo } from './db/documents-repo'
import { TemplatesRepo } from './db/templates-repo'
import { SignaturesRepo } from './db/signatures-repo'

const log = createLogger('ext:docs')

let documentsRepo: DocumentsRepo | null = null
let templatesRepo: TemplatesRepo | null = null
let signaturesRepo: SignaturesRepo | null = null

export function registerExtDocsHandlers(context: ExtensionContext): void {
  const { ipc, db, services, log: ctxLog } = context

  documentsRepo = new DocumentsRepo(db)
  templatesRepo = new TemplatesRepo(db)
  signaturesRepo = new SignaturesRepo(db)

  // ---------------------------------------------------------------------------
  // Documents
  // ---------------------------------------------------------------------------

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_LIST,
    extDocsSchemas['ext-docs:documents-list'],
    async (_event, payload) => {
      try {
        const documents = documentsRepo!.list(payload)
        return { success: true, data: documents }
      } catch (err) {
        ctxLog.error('Failed to list documents', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_GET,
    extDocsSchemas['ext-docs:documents-get'],
    async (_event, { id }) => {
      try {
        const document = documentsRepo!.get(id)
        if (!document) return { success: false, error: 'Document not found' }
        return { success: true, data: document }
      } catch (err) {
        ctxLog.error('Failed to get document', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_CREATE,
    extDocsSchemas['ext-docs:documents-create'],
    async (_event, payload) => {
      try {
        const document = documentsRepo!.create(payload)
        log.info(`Document created: ${document.id} (${document.title})`)
        return { success: true, data: document }
      } catch (err) {
        ctxLog.error('Failed to create document', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_UPDATE,
    extDocsSchemas['ext-docs:documents-update'],
    async (_event, payload) => {
      try {
        const document = documentsRepo!.update(payload)
        if (!document) return { success: false, error: 'Document not found' }
        log.info(`Document updated: ${document.id}`)
        return { success: true, data: document }
      } catch (err) {
        ctxLog.error('Failed to update document', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_DELETE,
    extDocsSchemas['ext-docs:documents-delete'],
    async (_event, { id }) => {
      try {
        const deleted = documentsRepo!.delete(id)
        if (!deleted) return { success: false, error: 'Document not found' }
        log.info(`Document deleted: ${id}`)
        return { success: true }
      } catch (err) {
        ctxLog.error('Failed to delete document', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.DOCUMENTS_SEARCH,
    extDocsSchemas['ext-docs:documents-search'],
    async (_event, payload) => {
      try {
        const documents = documentsRepo!.search(payload)
        return { success: true, data: documents }
      } catch (err) {
        ctxLog.error('Failed to search documents', err)
        return errorToResponse(err)
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  ipc.handle(
    EXT_DOCS_IPC.TEMPLATES_LIST,
    extDocsSchemas['ext-docs:templates-list'],
    async (_event, payload) => {
      try {
        const templates = templatesRepo!.list(payload)
        return { success: true, data: templates }
      } catch (err) {
        ctxLog.error('Failed to list templates', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.TEMPLATES_GET,
    extDocsSchemas['ext-docs:templates-get'],
    async (_event, { id }) => {
      try {
        const template = templatesRepo!.get(id)
        if (!template) return { success: false, error: 'Template not found' }
        return { success: true, data: template }
      } catch (err) {
        ctxLog.error('Failed to get template', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.TEMPLATES_SAVE,
    extDocsSchemas['ext-docs:templates-save'],
    async (_event, payload) => {
      try {
        const template = templatesRepo!.save(payload)
        log.info(`Template saved: ${template.id} (${template.name})`)
        return { success: true, data: template }
      } catch (err) {
        ctxLog.error('Failed to save template', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.TEMPLATES_DELETE,
    extDocsSchemas['ext-docs:templates-delete'],
    async (_event, { id }) => {
      try {
        const deleted = templatesRepo!.delete(id)
        if (!deleted) return { success: false, error: 'Template not found' }
        log.info(`Template deleted: ${id}`)
        return { success: true }
      } catch (err) {
        ctxLog.error('Failed to delete template', err)
        return errorToResponse(err)
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Generation
  // ---------------------------------------------------------------------------

  ipc.handle(
    EXT_DOCS_IPC.GENERATE_FROM_TEMPLATE,
    extDocsSchemas['ext-docs:generate'],
    async (_event, payload) => {
      try {
        // Get template
        const template = templatesRepo!.get(payload.templateId)
        if (!template) {
          return { success: false, error: 'Template not found' }
        }

        // Generate document using doc-generate skill
        const result = await services.skills.execute('doc-generate', {
          template: template.content,
          data: payload.data,
          outputFormat: payload.outputFormat ?? 'pdf',
          outputPath: payload.outputPath,
          pdfOptions: payload.pdfOptions
        })

        if (!result.success) {
          return { success: false, error: result.error ?? 'Generation failed' }
        }

        const resultData = result.data as {
          filePath: string
          format: string
          sizeBytes: number
        }

        // Create document record
        const document = documentsRepo!.create({
          title: `${template.name} - ${new Date().toLocaleDateString()}`,
          filePath: resultData.filePath,
          fileType: resultData.format,
          fileSize: resultData.sizeBytes,
          templateId: template.id,
          metadata: { generatedFrom: template.name }
        })

        log.info(`Document generated from template: ${document.id}`)

        return {
          success: true,
          data: {
            documentId: document.id,
            filePath: resultData.filePath,
            format: resultData.format,
            sizeBytes: resultData.sizeBytes
          }
        }
      } catch (err) {
        ctxLog.error('Failed to generate document', err)
        return errorToResponse(err)
      }
    }
  )

  // ---------------------------------------------------------------------------
  // E-Signatures
  // ---------------------------------------------------------------------------

  ipc.handle(
    EXT_DOCS_IPC.SIGN_REQUEST,
    extDocsSchemas['ext-docs:sign-request'],
    async (_event, payload) => {
      try {
        // Verify document exists
        const document = documentsRepo!.get(payload.documentId)
        if (!document) {
          return { success: false, error: 'Document not found' }
        }

        // Check for API key
        const settings = new SettingsRepo()
        const apiKey = settings.get(`docs.${payload.provider}-key`) as string | null

        if (!apiKey) {
          return {
            success: false,
            error: `${payload.provider} API key not configured`
          }
        }

        // Create signature request record
        const signature = signaturesRepo!.create(payload, payload.expiresInDays ?? 30)

        // TODO: Call provider API to create signature request
        // For now, just mark as pending
        log.info(`Signature request created: ${signature.id} (${payload.provider})`)

        return { success: true, data: signature }
      } catch (err) {
        ctxLog.error('Failed to create signature request', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.SIGN_STATUS,
    extDocsSchemas['ext-docs:sign-status'],
    async (_event, { signatureId }) => {
      try {
        const signature = signaturesRepo!.get(signatureId)
        if (!signature) {
          return { success: false, error: 'Signature request not found' }
        }

        // TODO: If signature has externalId, poll provider API for status update

        return { success: true, data: signature }
      } catch (err) {
        ctxLog.error('Failed to get signature status', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.SIGN_CANCEL,
    extDocsSchemas['ext-docs:sign-cancel'],
    async (_event, { signatureId }) => {
      try {
        const signature = signaturesRepo!.get(signatureId)
        if (!signature) {
          return { success: false, error: 'Signature request not found' }
        }

        // TODO: Call provider API to cancel signature request

        const deleted = signaturesRepo!.delete(signatureId)
        if (!deleted) {
          return { success: false, error: 'Failed to cancel signature' }
        }

        log.info(`Signature request cancelled: ${signatureId}`)
        return { success: true }
      } catch (err) {
        ctxLog.error('Failed to cancel signature', err)
        return errorToResponse(err)
      }
    }
  )

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  ipc.handle(
    EXT_DOCS_IPC.SETTINGS_GET,
    extDocsSchemas['ext-docs:settings-get'],
    async (_event, { keys }) => {
      try {
        const settings = new SettingsRepo()

        const allKeys = keys ?? ['docs.storage-path', 'docs.docusign-key', 'docs.hellosign-key']

        const result: Record<string, unknown> = {}
        for (const key of allKeys) {
          // Mask API keys
          const value = settings.get(key)
          if (key.includes('-key') && value) {
            result[key] = '••••••••'
          } else {
            result[key] = value
          }
        }

        return { success: true, data: result }
      } catch (err) {
        ctxLog.error('Failed to get settings', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DOCS_IPC.SETTINGS_SET,
    extDocsSchemas['ext-docs:settings-set'],
    async (_event, { key, value }) => {
      try {
        // Validate key
        const validKeys = ['docs.storage-path', 'docs.docusign-key', 'docs.hellosign-key']
        if (!validKeys.includes(key)) {
          return { success: false, error: `Invalid settings key: ${key}` }
        }

        const settings = new SettingsRepo()
        settings.set(key, value as string)

        log.info(`Settings updated: ${key}`)
        return { success: true }
      } catch (err) {
        ctxLog.error('Failed to update settings', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-docs: 16 IPC handlers registered')
}
