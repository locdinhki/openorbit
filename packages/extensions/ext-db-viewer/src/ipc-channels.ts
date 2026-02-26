// ============================================================================
// ext-db-viewer — IPC Channel Constants
//
// All channels are prefixed with "ext-db-viewer:" and match /^[a-z-]+:[a-z-]+$/
// ============================================================================

export const EXT_DB_VIEWER_IPC = {
  // Schema
  SCHEMA_TABLES: 'ext-db-viewer:schema-tables',
  SCHEMA_COLUMNS: 'ext-db-viewer:schema-columns',
  SCHEMA_INDEXES: 'ext-db-viewer:schema-indexes',

  // Data
  TABLE_DATA: 'ext-db-viewer:table-data',

  // CRUD
  RECORD_UPDATE: 'ext-db-viewer:record-update',
  RECORD_INSERT: 'ext-db-viewer:record-insert',
  RECORD_DELETE: 'ext-db-viewer:record-delete',

  // SQL Console
  SQL_EXECUTE: 'ext-db-viewer:sql-execute',
  DEV_MODE: 'ext-db-viewer:dev-mode',

  // Export/Import
  EXPORT_TABLE: 'ext-db-viewer:export-table',
  IMPORT_SELECT: 'ext-db-viewer:import-select',
  IMPORT_PREVIEW: 'ext-db-viewer:import-preview',
  IMPORT_EXECUTE: 'ext-db-viewer:import-execute'
} as const

export type ExtDbViewerIPCChannel = (typeof EXT_DB_VIEWER_IPC)[keyof typeof EXT_DB_VIEWER_IPC]
