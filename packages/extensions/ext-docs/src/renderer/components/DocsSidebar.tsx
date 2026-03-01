// ============================================================================
// ext-docs — Documents Sidebar
// ============================================================================

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchDocuments,
  fetchTemplates,
  setSelectedDocument,
  setSelectedTemplate,
  setSearchQuery,
  searchDocuments
} from '../store/documentsSlice'
import type { Document, Template } from '../../ipc-schemas'

interface RootState {
  'ext-docs': {
    documents: Document[]
    templates: Template[]
    selectedDocumentId: string | null
    selectedTemplateId: string | null
    searchQuery: string
    loading: boolean
    error: string | null
  }
}

type TabType = 'documents' | 'templates'

export default function DocsSidebar(): React.JSX.Element {
  const dispatch = useDispatch()
  const [activeTab, setActiveTab] = useState<TabType>('documents')
  const { documents, templates, selectedDocumentId, selectedTemplateId, searchQuery, loading } =
    useSelector((state: RootState) => state['ext-docs'])

  useEffect(() => {
    dispatch(fetchDocuments({}) as never)
    dispatch(fetchTemplates() as never)
  }, [dispatch])

  const handleSearch = (query: string): void => {
    dispatch(setSearchQuery(query))
    if (query.trim()) {
      dispatch(searchDocuments({ query }) as never)
    } else {
      dispatch(fetchDocuments({}) as never)
    }
  }

  const getFileIcon = (fileType: string): string => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return 'file-text'
      case 'xlsx':
      case 'csv':
        return 'table'
      case 'html':
        return 'code'
      default:
        return 'file'
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Search */}
      <div className="border-b border-gray-200 p-3 dark:border-gray-700">
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'documents'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Documents
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex-1 px-4 py-2 text-sm font-medium ${
            activeTab === 'templates'
              ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
          }`}
        >
          Templates
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}

        {!loading && activeTab === 'documents' && (
          <div className="p-2">
            {documents.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No documents found
              </p>
            ) : (
              <ul className="space-y-1">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => dispatch(setSelectedDocument(doc.id))}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                        selectedDocumentId === doc.id
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="flex-shrink-0 text-gray-400">
                        [{getFileIcon(doc.fileType)}]
                      </span>
                      <span className="flex-1 truncate">{doc.title}</span>
                      <span className="text-xs text-gray-400">{doc.fileType}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!loading && activeTab === 'templates' && (
          <div className="p-2">
            {templates.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No templates found
              </p>
            ) : (
              <ul className="space-y-1">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      onClick={() => dispatch(setSelectedTemplate(template.id))}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                        selectedTemplateId === template.id
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span className="flex-shrink-0 text-gray-400">[file-plus]</span>
                      <span className="flex-1 truncate">{template.name}</span>
                      {template.category && (
                        <span className="rounded bg-gray-200 px-1 text-xs text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                          {template.category}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {documents.length} documents · {templates.length} templates
      </div>
    </div>
  )
}
