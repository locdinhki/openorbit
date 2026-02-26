// ============================================================================
// ext-db-viewer — IPC Handler Registration
//
// All handlers are registered through the extension's scoped IPC host,
// which enforces the `ext-db-viewer:` channel prefix.
// ============================================================================

import { dialog } from 'electron'
import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { EXT_DB_VIEWER_IPC } from '../ipc-channels'
import { extDbViewerSchemas } from '../ipc-schemas'
import { listTables, getColumns, getIndexes } from './db/schema-introspector'
import {
  queryTableData,
  updateRecord,
  insertRecord,
  deleteRecord,
  executeSql,
  getPrimaryKey
} from './db/query-executor'
import { exportTable } from './db/data-export'
import { previewImport, executeImport } from './db/data-import'

export function registerExtDbViewerHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx

  // ---- Schema ----

  ipc.handle(
    EXT_DB_VIEWER_IPC.SCHEMA_TABLES,
    extDbViewerSchemas['ext-db-viewer:schema-tables'],
    () => {
      try {
        return { success: true, data: listTables(db) }
      } catch (err) {
        log.error('Failed to list tables', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.SCHEMA_COLUMNS,
    extDbViewerSchemas['ext-db-viewer:schema-columns'],
    (_event, { table }) => {
      try {
        const columns = getColumns(db, table)
        const pk = getPrimaryKey(db, table)
        return { success: true, data: { columns, primaryKey: pk } }
      } catch (err) {
        log.error('Failed to get columns', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.SCHEMA_INDEXES,
    extDbViewerSchemas['ext-db-viewer:schema-indexes'],
    (_event, { table }) => {
      try {
        return { success: true, data: getIndexes(db, table) }
      } catch (err) {
        log.error('Failed to get indexes', err)
        return errorToResponse(err)
      }
    }
  )

  // ---- Data ----

  ipc.handle(
    EXT_DB_VIEWER_IPC.TABLE_DATA,
    extDbViewerSchemas['ext-db-viewer:table-data'],
    (_event, params) => {
      try {
        return { success: true, data: queryTableData(db, params) }
      } catch (err) {
        log.error('Failed to query table data', err)
        return errorToResponse(err)
      }
    }
  )

  // ---- CRUD ----

  ipc.handle(
    EXT_DB_VIEWER_IPC.RECORD_UPDATE,
    extDbViewerSchemas['ext-db-viewer:record-update'],
    (_event, { table, primaryKey, changes }) => {
      try {
        const affected = updateRecord(db, table, primaryKey, changes)
        return { success: true, data: { affected } }
      } catch (err) {
        log.error('Failed to update record', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.RECORD_INSERT,
    extDbViewerSchemas['ext-db-viewer:record-insert'],
    (_event, { table, values }) => {
      try {
        const lastId = insertRecord(db, table, values)
        return { success: true, data: { lastId } }
      } catch (err) {
        log.error('Failed to insert record', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.RECORD_DELETE,
    extDbViewerSchemas['ext-db-viewer:record-delete'],
    (_event, { table, primaryKey }) => {
      try {
        // Dev mode check
        if (!isDevModeEnabled(db)) {
          return {
            success: false,
            error: 'Developer mode required for delete operations',
            code: 'DEV_MODE_REQUIRED'
          }
        }
        const affected = deleteRecord(db, table, primaryKey)
        return { success: true, data: { affected } }
      } catch (err) {
        log.error('Failed to delete record', err)
        return errorToResponse(err)
      }
    }
  )

  // ---- SQL Console ----

  ipc.handle(
    EXT_DB_VIEWER_IPC.DEV_MODE,
    extDbViewerSchemas['ext-db-viewer:dev-mode'],
    (_event, { action, enabled }) => {
      try {
        if (action === 'get') {
          return { success: true, data: { enabled: isDevModeEnabled(db) } }
        }
        // set
        db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(
          'ext-db-viewer:dev-mode',
          enabled ? 'true' : 'false'
        )
        return { success: true, data: { enabled: !!enabled } }
      } catch (err) {
        log.error('Failed to get/set dev mode', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.SQL_EXECUTE,
    extDbViewerSchemas['ext-db-viewer:sql-execute'],
    (_event, { sql, params }) => {
      try {
        if (!isDevModeEnabled(db)) {
          return {
            success: false,
            error: 'Developer mode required for SQL execution',
            code: 'DEV_MODE_REQUIRED'
          }
        }
        const result = executeSql(db, sql, params)
        return { success: true, data: result }
      } catch (err) {
        log.error('SQL execution failed', err)
        return errorToResponse(err)
      }
    }
  )

  // ---- Export/Import ----

  ipc.handle(
    EXT_DB_VIEWER_IPC.EXPORT_TABLE,
    extDbViewerSchemas['ext-db-viewer:export-table'],
    async (_event, { table, format, limit }) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
        const defaultName = `${table}_${timestamp}.${format}`
        const result = await dialog.showSaveDialog({
          title: 'Export Table',
          defaultPath: defaultName,
          filters:
            format === 'csv'
              ? [{ name: 'CSV Files', extensions: ['csv'] }]
              : [{ name: 'JSON Files', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: 'Export cancelled', code: 'CANCELLED' }
        }
        const exportResult = exportTable(db, table, format, result.filePath, limit)
        return { success: true, data: exportResult }
      } catch (err) {
        log.error('Failed to export table', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.IMPORT_SELECT,
    extDbViewerSchemas['ext-db-viewer:import-select'],
    async (_event, { format }) => {
      try {
        const result = await dialog.showOpenDialog({
          title: 'Import Data',
          filters:
            format === 'csv'
              ? [{ name: 'CSV Files', extensions: ['csv'] }]
              : [{ name: 'JSON Files', extensions: ['json'] }],
          properties: ['openFile']
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, error: 'Import cancelled', code: 'CANCELLED' }
        }
        return { success: true, data: { filePath: result.filePaths[0] } }
      } catch (err) {
        log.error('Failed to open import file picker', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.IMPORT_PREVIEW,
    extDbViewerSchemas['ext-db-viewer:import-preview'],
    (_event, { table, filePath, format }) => {
      try {
        const preview = previewImport(db, table, filePath, format)
        return { success: true, data: preview }
      } catch (err) {
        log.error('Failed to preview import', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_DB_VIEWER_IPC.IMPORT_EXECUTE,
    extDbViewerSchemas['ext-db-viewer:import-execute'],
    (_event, { table, filePath, format, columnMapping }) => {
      try {
        const result = executeImport(db, table, filePath, format, columnMapping)
        return { success: true, data: result }
      } catch (err) {
        log.error('Failed to execute import', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-db-viewer IPC handlers registered (13 channels)')
}

function isDevModeEnabled(db: import('better-sqlite3').Database): boolean {
  try {
    const row = db
      .prepare(`SELECT value FROM settings WHERE key = ?`)
      .get('ext-db-viewer:dev-mode') as { value: string } | undefined
    return row?.value === 'true'
  } catch {
    return false
  }
}
