// ============================================================================
// ext-docs — Document Viewer Panel
// ============================================================================

import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { EXT_DOCS_IPC } from '../../ipc-channels'
import type { Document, Template } from '../../ipc-schemas'

interface RootState {
  'ext-docs': {
    documents: Document[]
    templates: Template[]
    selectedDocumentId: string | null
    selectedTemplateId: string | null
  }
}

export default function DocsViewer(): React.JSX.Element {
  const { documents, templates, selectedDocumentId, selectedTemplateId } = useSelector(
    (state: RootState) => state['ext-docs']
  )

  const [templateContent, setTemplateContent] = useState<string>('')
  const [generateData, setGenerateData] = useState<string>('{}')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedDocument = selectedDocumentId
    ? documents.find((d) => d.id === selectedDocumentId)
    : null

  const selectedTemplate = selectedTemplateId
    ? templates.find((t) => t.id === selectedTemplateId)
    : null

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateContent(selectedTemplate.content)
      // Create sample data from merge fields
      const sampleData: Record<string, string> = {}
      for (const field of selectedTemplate.mergeFields) {
        sampleData[field] = `[${field}]`
      }
      setGenerateData(JSON.stringify(sampleData, null, 2))
    }
  }, [selectedTemplate])

  const handleGenerate = async (): Promise<void> => {
    if (!selectedTemplate) return

    try {
      setGenerating(true)
      setError(null)

      const data = JSON.parse(generateData)

      const result = await window.api.invoke(EXT_DOCS_IPC.GENERATE_FROM_TEMPLATE, {
        templateId: selectedTemplate.id,
        data,
        outputFormat: 'pdf'
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      // Open the generated file
      await window.api.invoke('shell:open-path', { path: result.data.filePath })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  if (selectedDocument) {
    return (
      <div className="flex h-full flex-col p-4">
        <h3 className="mb-4 text-lg font-semibold dark:text-white">{selectedDocument.title}</h3>

        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm text-gray-500">
            File type:{' '}
            <span className="font-medium">{selectedDocument.fileType.toUpperCase()}</span>
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Location: <code className="text-xs">{selectedDocument.filePath}</code>
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() =>
              window.api.invoke('shell:open-path', { path: selectedDocument.filePath })
            }
            className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600"
          >
            Open File
          </button>
          <button
            onClick={() =>
              window.api.invoke('shell:show-item-in-folder', { path: selectedDocument.filePath })
            }
            className="rounded bg-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200"
          >
            Show in Folder
          </button>
        </div>
      </div>
    )
  }

  if (selectedTemplate) {
    return (
      <div className="flex h-full flex-col p-4">
        <h3 className="mb-4 text-lg font-semibold dark:text-white">{selectedTemplate.name}</h3>

        {selectedTemplate.description && (
          <p className="mb-4 text-sm text-gray-500">{selectedTemplate.description}</p>
        )}

        {/* Merge fields */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Merge Fields</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedTemplate.mergeFields.length > 0 ? (
              selectedTemplate.mergeFields.map((field) => (
                <span
                  key={field}
                  className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                >
                  {`{{${field}}}`}
                </span>
              ))
            ) : (
              <span className="text-sm text-gray-400">No merge fields</span>
            )}
          </div>
        </div>

        {/* Template preview */}
        <div className="mb-4">
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Template Content
          </h4>
          <pre className="max-h-48 overflow-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-800">
            {templateContent}
          </pre>
        </div>

        {/* Data input */}
        <div className="mb-4 flex-1">
          <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Merge Data (JSON)
          </h4>
          <textarea
            value={generateData}
            onChange={(e) => setGenerateData(e.target.value)}
            className="h-32 w-full rounded border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {error && (
          <div className="mb-4 rounded bg-red-100 p-2 text-sm text-red-700 dark:bg-red-900 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:bg-gray-400"
        >
          {generating ? 'Generating...' : 'Generate Document'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-400">
      <div className="text-center">
        <p className="text-lg">Document Viewer</p>
        <p className="mt-2 text-sm">
          Select a document or template from the sidebar to view details
        </p>
      </div>
    </div>
  )
}
