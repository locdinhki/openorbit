// ============================================================================
// ext-db-viewer — Renderer IPC Client
// ============================================================================

import { EXT_DB_VIEWER_IPC } from '../../ipc-channels'
import type { TableInfo, ColumnInfo, IndexInfo } from '../../main/db/schema-introspector'
import type { TableDataResult, SqlExecuteResult } from '../../main/db/query-executor'
import type { ImportPreviewResult, ImportExecuteResult } from '../../main/db/data-import'
import type { ExportResult } from '../../main/db/data-export'

interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

const api = window.api

export const ipc = {
  schema: {
    tables: (): Promise<IPCResult<TableInfo[]>> =>
      api.invoke(EXT_DB_VIEWER_IPC.SCHEMA_TABLES) as Promise<IPCResult<TableInfo[]>>,

    columns: (table: string): Promise<IPCResult<{ columns: ColumnInfo[]; primaryKey: string[] }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.SCHEMA_COLUMNS, { table }) as Promise<
        IPCResult<{ columns: ColumnInfo[]; primaryKey: string[] }>
      >,

    indexes: (table: string): Promise<IPCResult<IndexInfo[]>> =>
      api.invoke(EXT_DB_VIEWER_IPC.SCHEMA_INDEXES, { table }) as Promise<IPCResult<IndexInfo[]>>
  },

  data: {
    query: (params: {
      table: string
      page?: number
      pageSize?: number
      sortColumn?: string
      sortDirection?: 'asc' | 'desc'
      filters?: Array<{ column: string; operator: string; value?: string }>
    }): Promise<IPCResult<TableDataResult>> =>
      api.invoke(EXT_DB_VIEWER_IPC.TABLE_DATA, params) as Promise<IPCResult<TableDataResult>>
  },

  records: {
    update: (
      table: string,
      primaryKey: Record<string, unknown>,
      changes: Record<string, unknown>
    ): Promise<IPCResult<{ affected: number }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.RECORD_UPDATE, {
        table,
        primaryKey,
        changes
      }) as Promise<IPCResult<{ affected: number }>>,

    insert: (
      table: string,
      values: Record<string, unknown>
    ): Promise<IPCResult<{ lastId: unknown }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.RECORD_INSERT, { table, values }) as Promise<
        IPCResult<{ lastId: unknown }>
      >,

    delete: (
      table: string,
      primaryKey: Record<string, unknown>
    ): Promise<IPCResult<{ affected: number }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.RECORD_DELETE, { table, primaryKey }) as Promise<
        IPCResult<{ affected: number }>
      >
  },

  sql: {
    execute: (sql: string, params?: unknown[]): Promise<IPCResult<SqlExecuteResult>> =>
      api.invoke(EXT_DB_VIEWER_IPC.SQL_EXECUTE, { sql, params }) as Promise<
        IPCResult<SqlExecuteResult>
      >,

    devMode: (action: 'get' | 'set', enabled?: boolean): Promise<IPCResult<{ enabled: boolean }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.DEV_MODE, { action, enabled }) as Promise<
        IPCResult<{ enabled: boolean }>
      >
  },

  io: {
    exportTable: (
      table: string,
      format: 'csv' | 'json',
      limit?: number
    ): Promise<IPCResult<ExportResult>> =>
      api.invoke(EXT_DB_VIEWER_IPC.EXPORT_TABLE, { table, format, limit }) as Promise<
        IPCResult<ExportResult>
      >,

    importSelect: (format: 'csv' | 'json'): Promise<IPCResult<{ filePath: string }>> =>
      api.invoke(EXT_DB_VIEWER_IPC.IMPORT_SELECT, { format }) as Promise<
        IPCResult<{ filePath: string }>
      >,

    importPreview: (
      table: string,
      filePath: string,
      format: 'csv' | 'json'
    ): Promise<IPCResult<ImportPreviewResult>> =>
      api.invoke(EXT_DB_VIEWER_IPC.IMPORT_PREVIEW, { table, filePath, format }) as Promise<
        IPCResult<ImportPreviewResult>
      >,

    importExecute: (
      table: string,
      filePath: string,
      format: 'csv' | 'json',
      columnMapping?: Record<string, string>
    ): Promise<IPCResult<ImportExecuteResult>> =>
      api.invoke(EXT_DB_VIEWER_IPC.IMPORT_EXECUTE, {
        table,
        filePath,
        format,
        columnMapping
      }) as Promise<IPCResult<ImportExecuteResult>>
  }
}

export type { IPCResult }
