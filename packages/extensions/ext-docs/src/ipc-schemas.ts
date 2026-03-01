// ============================================================================
// ext-docs — IPC Zod Schemas
// ============================================================================

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Document Schemas
// ---------------------------------------------------------------------------

export const DocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  filePath: z.string(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
  templateId: z.string().optional(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type Document = z.infer<typeof DocumentSchema>

export const DocumentListRequestSchema = z.object({
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
  fileType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional()
})

export type DocumentListRequest = z.infer<typeof DocumentListRequestSchema>

export const DocumentCreateRequestSchema = z.object({
  title: z.string(),
  filePath: z.string(),
  fileType: z.string(),
  fileSize: z.number().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
  templateId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export type DocumentCreateRequest = z.infer<typeof DocumentCreateRequestSchema>

export const DocumentUpdateRequestSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  propertyId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export type DocumentUpdateRequest = z.infer<typeof DocumentUpdateRequestSchema>

export const DocumentSearchRequestSchema = z.object({
  query: z.string(),
  fileTypes: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(500).optional()
})

export type DocumentSearchRequest = z.infer<typeof DocumentSearchRequestSchema>

// ---------------------------------------------------------------------------
// Template Schemas
// ---------------------------------------------------------------------------

export const TemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string(),
  mergeFields: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type Template = z.infer<typeof TemplateSchema>

export const TemplateListRequestSchema = z.object({
  category: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional()
})

export type TemplateListRequest = z.infer<typeof TemplateListRequestSchema>

export const TemplateSaveRequestSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  content: z.string()
})

export type TemplateSaveRequest = z.infer<typeof TemplateSaveRequestSchema>

// ---------------------------------------------------------------------------
// Signature Schemas
// ---------------------------------------------------------------------------

export const SignerSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.string().optional()
})

export type Signer = z.infer<typeof SignerSchema>

export const SignatureSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  provider: z.enum(['docusign', 'hellosign']),
  externalId: z.string().optional(),
  status: z.enum(['pending', 'sent', 'viewed', 'signed', 'declined']),
  signers: z.array(SignerSchema),
  sentAt: z.string().optional(),
  signedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  createdAt: z.string()
})

export type Signature = z.infer<typeof SignatureSchema>

export const SignRequestSchema = z.object({
  documentId: z.string(),
  provider: z.enum(['docusign', 'hellosign']),
  signers: z.array(SignerSchema),
  subject: z.string().optional(),
  message: z.string().optional(),
  expiresInDays: z.number().int().min(1).max(365).optional()
})

export type SignRequest = z.infer<typeof SignRequestSchema>

// ---------------------------------------------------------------------------
// IPC Request Schemas (used by ipc.handle)
// ---------------------------------------------------------------------------

export const extDocsSchemas = {
  // Documents
  'ext-docs:documents-list': DocumentListRequestSchema,
  'ext-docs:documents-get': z.object({ id: z.string().min(1) }),
  'ext-docs:documents-create': DocumentCreateRequestSchema,
  'ext-docs:documents-update': DocumentUpdateRequestSchema,
  'ext-docs:documents-delete': z.object({ id: z.string().min(1) }),
  'ext-docs:documents-search': DocumentSearchRequestSchema,

  // Templates
  'ext-docs:templates-list': TemplateListRequestSchema,
  'ext-docs:templates-get': z.object({ id: z.string().min(1) }),
  'ext-docs:templates-save': TemplateSaveRequestSchema,
  'ext-docs:templates-delete': z.object({ id: z.string().min(1) }),

  // Generation
  'ext-docs:generate': z.object({
    templateId: z.string(),
    data: z.record(z.string(), z.unknown()),
    outputFormat: z.enum(['pdf', 'html', 'text']).optional(),
    outputPath: z.string().optional(),
    pdfOptions: z
      .object({
        title: z.string().optional(),
        author: z.string().optional(),
        pageSize: z.enum(['letter', 'a4']).optional(),
        header: z.string().optional(),
        footer: z.string().optional()
      })
      .optional()
  }),

  // E-signatures
  'ext-docs:sign-request': SignRequestSchema,
  'ext-docs:sign-status': z.object({ signatureId: z.string().min(1) }),
  'ext-docs:sign-cancel': z.object({ signatureId: z.string().min(1) }),

  // Settings
  'ext-docs:settings-get': z.object({ keys: z.array(z.string()).optional() }),
  'ext-docs:settings-set': z.object({
    key: z.string(),
    value: z.unknown()
  })
} as const
