// ============================================================================
// OpenOrbit — Scheduler Tool Types
//
// Types for tool metadata and config schemas registered by extensions.
// ============================================================================

/** Field types supported in dynamic config forms */
export type ConfigFieldType = 'text' | 'number' | 'select' | 'multiselect' | 'toggle'

/** Describes a single configurable field on a tool's config form */
export interface ToolConfigField {
  /** Key in the config Record that this field populates */
  key: string
  /** Field type for rendering */
  type: ConfigFieldType
  /** Human-readable label */
  label: string
  /** Optional help text */
  description?: string
  /** Placeholder text (for text/number inputs) */
  placeholder?: string
  /** Whether this field is required */
  required?: boolean
  /** Default value */
  defaultValue?: unknown

  // --- For select / multiselect ---

  /** Static options (alternative to source) */
  options?: { label: string; value: string }[]
  /** IPC channel to invoke at runtime to fetch options dynamically */
  source?: string
  /** Which field on the returned objects to use as the option label */
  labelField?: string
  /** Which field on the returned objects to use as the option value */
  valueField?: string

  // --- For number ---

  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
}

/** Metadata registered alongside a task handler */
export interface ToolMeta {
  /** Task type key (e.g. 'extraction') */
  taskType: string
  /** Human-readable label */
  label: string
  /** Description of what this tool does */
  description: string
  /** Which extension registered this tool */
  extensionId: string
  /** Schema for the config form */
  configSchema: ToolConfigField[]
}
