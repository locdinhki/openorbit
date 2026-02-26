import { useSchema } from '../hooks/useSchema'
import { useTableData } from '../hooks/useTableData'
import { useDevMode } from '../hooks/useDevMode'
import DataTable from './DataViewer/DataTable'
import DataToolbar from './DataViewer/DataToolbar'
import PaginationBar from './DataViewer/PaginationBar'
import RecordModal from './RecordEditor/RecordModal'
import { useState } from 'react'
import { ipc } from '../lib/ipc-client'

export default function DbViewerWorkspace(): React.JSX.Element {
  const schema = useSchema()
  const data = useTableData(schema.selectedTable)
  const devMode = useDevMode()
  const [editRecord, setEditRecord] = useState<Record<string, unknown> | null>(null)
  const [isInserting, setIsInserting] = useState(false)

  if (!schema.selectedTable) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--cos-text-muted)] text-sm">
        Select a table from the sidebar
      </div>
    )
  }

  const isVirtual = schema.tables.find((t) => t.name === schema.selectedTable)?.type === 'virtual'
  const isReadOnly = isVirtual

  const handleCellEdit = async (
    row: Record<string, unknown>,
    column: string,
    value: unknown
  ): Promise<void> => {
    const pk: Record<string, unknown> = {}
    for (const k of schema.primaryKey) pk[k] = row[k]
    const result = await ipc.records.update(schema.selectedTable!, pk, { [column]: value })
    if (result.success) data.refresh()
  }

  const handleDelete = async (row: Record<string, unknown>): Promise<void> => {
    const pk: Record<string, unknown> = {}
    for (const k of schema.primaryKey) pk[k] = row[k]
    const result = await ipc.records.delete(schema.selectedTable!, pk)
    if (result.success) data.refresh()
  }

  const handleInsert = async (values: Record<string, unknown>): Promise<void> => {
    const result = await ipc.records.insert(schema.selectedTable!, values)
    if (result.success) {
      setIsInserting(false)
      data.refresh()
    }
  }

  const handleSaveEdit = async (values: Record<string, unknown>): Promise<void> => {
    if (!editRecord) return
    const pk: Record<string, unknown> = {}
    for (const k of schema.primaryKey) pk[k] = editRecord[k]

    const changes: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v !== editRecord[k]) changes[k] = v
    }
    if (Object.keys(changes).length === 0) {
      setEditRecord(null)
      return
    }
    const result = await ipc.records.update(schema.selectedTable!, pk, changes)
    if (result.success) {
      setEditRecord(null)
      data.refresh()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <DataToolbar
        table={schema.selectedTable}
        totalCount={data.totalCount}
        page={data.page}
        pageSize={data.pageSize}
        filters={data.filters}
        onSetFilters={data.setFilters}
        onRefresh={data.refresh}
        onInsert={isReadOnly ? undefined : () => setIsInserting(true)}
        columns={schema.columns.map((c) => c.name)}
      />

      <div className="flex-1 overflow-auto">
        <DataTable
          rows={data.rows}
          columns={schema.columns}
          primaryKey={schema.primaryKey}
          sortColumn={data.sortColumn}
          sortDirection={data.sortDirection}
          onToggleSort={data.toggleSort}
          onCellEdit={isReadOnly ? undefined : handleCellEdit}
          onDelete={!isReadOnly && devMode.enabled ? handleDelete : undefined}
          onRowClick={isReadOnly ? undefined : setEditRecord}
          loading={data.loading}
        />
      </div>

      <PaginationBar
        page={data.page}
        totalPages={data.totalPages}
        pageSize={data.pageSize}
        totalCount={data.totalCount}
        onSetPage={data.setPage}
        onSetPageSize={data.setPageSize}
      />

      {(isInserting || editRecord) && (
        <RecordModal
          table={schema.selectedTable}
          columns={schema.columns}
          record={editRecord}
          onSave={editRecord ? handleSaveEdit : handleInsert}
          onClose={() => {
            setIsInserting(false)
            setEditRecord(null)
          }}
        />
      )}
    </div>
  )
}
