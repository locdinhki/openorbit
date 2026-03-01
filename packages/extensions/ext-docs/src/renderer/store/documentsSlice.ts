// ============================================================================
// ext-docs — Documents Slice
// ============================================================================

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { EXT_DOCS_IPC } from '../../ipc-channels'
import type {
  Document,
  Template,
  DocumentListRequest,
  DocumentSearchRequest,
  TemplateSaveRequest,
  GenerateRequest
} from '../../ipc-schemas'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface DocumentsState {
  documents: Document[]
  templates: Template[]
  selectedDocumentId: string | null
  selectedTemplateId: string | null
  searchQuery: string
  loading: boolean
  error: string | null
  documentTypeFilter: string | null
  tagFilter: string[]
}

const initialState: DocumentsState = {
  documents: [],
  templates: [],
  selectedDocumentId: null,
  selectedTemplateId: null,
  searchQuery: '',
  loading: false,
  error: null,
  documentTypeFilter: null,
  tagFilter: []
}

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchDocuments = createAsyncThunk(
  'ext-docs/fetchDocuments',
  async (request: DocumentListRequest = {}) => {
    const result = await window.api.invoke(EXT_DOCS_IPC.DOCUMENTS_LIST, request)
    if (!result.success) throw new Error(result.error)
    return result.data as Document[]
  }
)

export const searchDocuments = createAsyncThunk(
  'ext-docs/searchDocuments',
  async (request: DocumentSearchRequest) => {
    const result = await window.api.invoke(EXT_DOCS_IPC.DOCUMENTS_SEARCH, request)
    if (!result.success) throw new Error(result.error)
    return result.data as Document[]
  }
)

export const deleteDocument = createAsyncThunk('ext-docs/deleteDocument', async (id: string) => {
  const result = await window.api.invoke(EXT_DOCS_IPC.DOCUMENTS_DELETE, { id })
  if (!result.success) throw new Error(result.error)
  return id
})

export const fetchTemplates = createAsyncThunk(
  'ext-docs/fetchTemplates',
  async (category?: string) => {
    const result = await window.api.invoke(EXT_DOCS_IPC.TEMPLATES_LIST, { category })
    if (!result.success) throw new Error(result.error)
    return result.data as Template[]
  }
)

export const saveTemplate = createAsyncThunk(
  'ext-docs/saveTemplate',
  async (request: TemplateSaveRequest) => {
    const result = await window.api.invoke(EXT_DOCS_IPC.TEMPLATES_SAVE, request)
    if (!result.success) throw new Error(result.error)
    return result.data as Template
  }
)

export const deleteTemplate = createAsyncThunk('ext-docs/deleteTemplate', async (id: string) => {
  const result = await window.api.invoke(EXT_DOCS_IPC.TEMPLATES_DELETE, { id })
  if (!result.success) throw new Error(result.error)
  return id
})

export const generateFromTemplate = createAsyncThunk(
  'ext-docs/generateFromTemplate',
  async (request: GenerateRequest) => {
    const result = await window.api.invoke(EXT_DOCS_IPC.GENERATE_FROM_TEMPLATE, request)
    if (!result.success) throw new Error(result.error)
    return result.data as {
      documentId: string
      filePath: string
      format: string
      sizeBytes: number
    }
  }
)

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const documentsSlice = createSlice({
  name: 'ext-docs',
  initialState,
  reducers: {
    setSelectedDocument: (state, action: PayloadAction<string | null>) => {
      state.selectedDocumentId = action.payload
    },
    setSelectedTemplate: (state, action: PayloadAction<string | null>) => {
      state.selectedTemplateId = action.payload
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
    },
    setDocumentTypeFilter: (state, action: PayloadAction<string | null>) => {
      state.documentTypeFilter = action.payload
    },
    setTagFilter: (state, action: PayloadAction<string[]>) => {
      state.tagFilter = action.payload
    },
    clearError: (state) => {
      state.error = null
    }
  },
  extraReducers: (builder) => {
    // Fetch documents
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false
        state.documents = action.payload
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch documents'
      })

    // Search documents
    builder
      .addCase(searchDocuments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(searchDocuments.fulfilled, (state, action) => {
        state.loading = false
        state.documents = action.payload
      })
      .addCase(searchDocuments.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Search failed'
      })

    // Delete document
    builder.addCase(deleteDocument.fulfilled, (state, action) => {
      state.documents = state.documents.filter((d) => d.id !== action.payload)
      if (state.selectedDocumentId === action.payload) {
        state.selectedDocumentId = null
      }
    })

    // Fetch templates
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTemplates.fulfilled, (state, action) => {
        state.loading = false
        state.templates = action.payload
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Failed to fetch templates'
      })

    // Save template
    builder.addCase(saveTemplate.fulfilled, (state, action) => {
      const index = state.templates.findIndex((t) => t.id === action.payload.id)
      if (index >= 0) {
        state.templates[index] = action.payload
      } else {
        state.templates.push(action.payload)
      }
    })

    // Delete template
    builder.addCase(deleteTemplate.fulfilled, (state, action) => {
      state.templates = state.templates.filter((t) => t.id !== action.payload)
      if (state.selectedTemplateId === action.payload) {
        state.selectedTemplateId = null
      }
    })

    // Generate from template
    builder
      .addCase(generateFromTemplate.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(generateFromTemplate.fulfilled, (state) => {
        state.loading = false
        // Document will be fetched separately
      })
      .addCase(generateFromTemplate.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? 'Generation failed'
      })
  }
})

export const {
  setSelectedDocument,
  setSelectedTemplate,
  setSearchQuery,
  setDocumentTypeFilter,
  setTagFilter,
  clearError
} = documentsSlice.actions

export default documentsSlice.reducer
