// ============================================================================
// ext-docs — Documents Workspace
// ============================================================================

import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchDocuments, deleteDocument, setSelectedDocument } from '../store/documentsSlice'
import type { Document } from '../../ipc-schemas'

interface RootState {
  'ext-docs': {
    documents: Document[]
    selectedDocumentId: string | null
    loading: boolean
    error: string | null
  }
}

export default function DocsWorkspace(): React.JSX.Element {
  const dispatch = useDispatch()
  const { documents, selectedDocumentId, loading, error } = useSelector(
    (state: RootState) => state['ext-docs']
  )
  const selectedDocument = selectedDocumentId
    ? (documents.find((d) => d.id === selectedDocumentId) ?? null)
    : null

  useEffect(() => {
    dispatch(fetchDocuments({}) as never)
  }, [dispatch])

  const handleDelete = async (id: string): Promise<void> => {
    if (confirm('Are you sure you want to delete this document?')) {
      dispatch(deleteDocument(id) as never)
    }
  }

  const handleOpenFile = async (filePath: string): Promise<void> => {
    try {
      await window.api.invoke('shell:open-path', { path: filePath })
    } catch (err) {
      console.error('Failed to open file:', err)
    }
  }

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
          <button
            onClick={() => dispatch(fetchDocuments({}) as never)}
            className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Document List */}
      <div className="w-1/2 border-r border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold dark:text-white">Documents</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ height: 'calc(100% - 80px)' }}>
            {documents.length === 0 ? (
              <p className="py-8 text-center text-gray-500 dark:text-gray-400">No documents yet</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Title
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Size
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {documents.map((doc) => (
                    <tr
                      key={doc.id}
                      onClick={() => dispatch(setSelectedDocument(doc.id))}
                      className={`cursor-pointer ${
                        selectedDocumentId === doc.id
                          ? 'bg-blue-50 dark:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <td className="px-4 py-3 text-sm dark:text-white">{doc.title}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        <span className="rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-600">
                          {doc.fileType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatFileSize(doc.fileSize)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(doc.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Document Detail */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedDocument ? (
          <div>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold dark:text-white">{selectedDocument.title}</h2>
                <p className="text-sm text-gray-500">
                  {selectedDocument.fileType.toUpperCase()} ·{' '}
                  {formatFileSize(selectedDocument.fileSize)}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenFile(selectedDocument.filePath)}
                  className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
                >
                  Open File
                </button>
                <button
                  onClick={() => handleDelete(selectedDocument.id)}
                  className="rounded bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <h3 className="mb-2 text-sm font-medium text-gray-500">Details</h3>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Created</dt>
                    <dd className="dark:text-white">{formatDate(selectedDocument.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Updated</dt>
                    <dd className="dark:text-white">{formatDate(selectedDocument.updatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">File Path</dt>
                    <dd className="truncate font-mono text-xs dark:text-white">
                      {selectedDocument.filePath}
                    </dd>
                  </div>
                  {selectedDocument.templateId && (
                    <div>
                      <dt className="text-gray-500">Template</dt>
                      <dd className="dark:text-white">{selectedDocument.templateId}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {selectedDocument.tags.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-medium text-gray-500">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedDocument.contactId && (
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <h3 className="mb-2 text-sm font-medium text-gray-500">Linked To</h3>
                  <p className="text-sm dark:text-white">Contact: {selectedDocument.contactId}</p>
                  {selectedDocument.dealId && (
                    <p className="text-sm dark:text-white">Deal: {selectedDocument.dealId}</p>
                  )}
                  {selectedDocument.propertyId && (
                    <p className="text-sm dark:text-white">
                      Property: {selectedDocument.propertyId}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
            Select a document to view details
          </div>
        )}
      </div>
    </div>
  )
}
