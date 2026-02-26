// ============================================================================
// OpenOrbit — Extension System Type Definitions
// ============================================================================

import type Database from 'better-sqlite3'
import type { ZodType, z } from 'zod'
import type { AIService } from '../ai/provider-types'

// ---------------------------------------------------------------------------
// Extension manifest (lives in package.json under "openorbit" key)
// ---------------------------------------------------------------------------

export interface SidebarContribution {
  id: string
  label: string
  icon: string
  priority: number
}

export interface WorkspaceContribution {
  id: string
  label: string
  default?: boolean
}

export interface PanelContribution {
  id: string
  label: string
  icon: string
}

export interface StatusBarContribution {
  id: string
  alignment: 'left' | 'right'
  priority: number
}

export interface ToolbarContribution {
  id: string
  priority: number
}

export interface CommandContribution {
  id: string
  label: string
}

export interface ExtensionContributes {
  sidebar?: SidebarContribution[]
  workspace?: WorkspaceContribution[]
  panel?: PanelContribution[]
  statusBar?: StatusBarContribution[]
  toolbar?: ToolbarContribution[]
  commands?: CommandContribution[]
}

export interface ExtensionManifest {
  /** Unique extension identifier, e.g. "ext-jobs" */
  id: string
  /** Human-readable name, e.g. "Job Search" */
  displayName: string
  /** Icon name for ActivityBar (lucide icon name or path to SVG) */
  icon: string
  /** When to activate: ["onStartup"] or ["onView:jobs-sidebar"] */
  activationEvents: string[]
  /** Main-process entry point relative to package root */
  main: string
  /** Renderer entry point relative to package root */
  renderer: string
  /** Contribution points this extension provides */
  contributes: ExtensionContributes
}

// ---------------------------------------------------------------------------
// Extension lifecycle (main process)
// ---------------------------------------------------------------------------

export interface ExtensionMigration {
  version: number
  description: string
  up: (db: Database.Database) => void
}

export interface ExtensionMainAPI {
  activate(ctx: ExtensionContext): Promise<void>
  deactivate?(): Promise<void>
  migrations?: ExtensionMigration[]
}

// ---------------------------------------------------------------------------
// Extension lifecycle (renderer)
// ---------------------------------------------------------------------------

export interface ExtensionRendererAPI {
  activate(ctx: ExtensionRendererContext): void
  deactivate?(): void
}

// ---------------------------------------------------------------------------
// Main-process context provided to extensions
// ---------------------------------------------------------------------------

export interface ExtensionIPCHost {
  /**
   * Register an IPC handler. Channel must start with `ext-{extensionId}:`.
   * Schema validation is automatic via Zod.
   */
  handle<TSchema extends ZodType>(
    channel: string,
    schema: TSchema,
    handler: (
      event: unknown, // Electron.IpcMainInvokeEvent
      args: z.infer<TSchema>
    ) => unknown | Promise<unknown>
  ): void

  /** Push data from main to renderer (one-way). */
  push(channel: string, data: unknown): void

  /** Remove a previously registered handler. */
  removeHandler(channel: string): void
}

export interface ExtensionEventBus {
  emit(event: string, ...args: unknown[]): boolean
  on(event: string, listener: (...args: unknown[]) => void): void
  off(event: string, listener: (...args: unknown[]) => void): void
}

export interface SharedServices {
  /** Browser session management (Patchright or relay) */
  browser: {
    getSession(): import('../automation/session-manager').SessionManager
    isInitialized(): boolean
    /** Initialize the browser session if not already running. Safe to call repeatedly. */
    ensureReady(): Promise<void>
  }
  /** AI Provider Registry — register providers, send completions/chat */
  ai: AIService
  /** Shell settings (read-only for extensions) */
  settings: {
    get(key: string): unknown
  }
  /** Scheduler (register cron jobs and task-type handlers) */
  scheduler: {
    addJob(cronExpression: string, handler: () => Promise<void>): string
    removeJob(jobId: string): void
    /** Register a handler for a task type (e.g. 'extraction'). Called by extensions on activation. */
    registerTaskType(
      taskType: string,
      handler: (config: Record<string, unknown>) => Promise<void>,
      meta: Omit<import('../automation/scheduler-types').ToolMeta, 'taskType'>
    ): void
  }
  /** Desktop notifications */
  notifications: {
    show(title: string, body: string): void
  }
}

export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}

export interface ExtensionContext {
  /** Extension's declared ID from manifest */
  extensionId: string
  /** Scoped IPC handler registration */
  ipc: ExtensionIPCHost
  /** Shared SQLite database (extension manages its own tables) */
  db: Database.Database
  /** Shared services: browser, AI, settings, scheduler, notifications */
  services: SharedServices
  /** Scoped event emitter */
  events: ExtensionEventBus
  /** Extension's data directory on disk */
  storagePath: string
  /** Logger scoped to this extension */
  log: Logger
}

// ---------------------------------------------------------------------------
// Renderer context provided to extensions
// ---------------------------------------------------------------------------

export interface ExtensionViewRegistry {
  /** Register a React component for a declared contribution point */
  register(viewId: string, component: unknown): void // React.ComponentType
}

export interface ExtensionCommandRegistry {
  /** Register a command handler */
  register(commandId: string, handler: () => void): void
  /** Execute a registered command */
  execute(commandId: string): void
}

export interface ExtensionIPCClient {
  /** Invoke an IPC channel (renderer → main → renderer) */
  invoke<T = unknown>(channel: string, args?: unknown): Promise<T>
  /** Listen for push events from main process */
  on(channel: string, callback: (...args: unknown[]) => void): () => void
}

export interface ExtensionRendererContext {
  /** Extension's declared ID from manifest */
  extensionId: string
  /** View registration */
  views: ExtensionViewRegistry
  /** Command registration */
  commands: ExtensionCommandRegistry
  /** Extension-scoped IPC client */
  ipc: ExtensionIPCClient
}

// ---------------------------------------------------------------------------
// Internal types used by ExtensionHost
// ---------------------------------------------------------------------------

export interface LoadedExtension {
  manifest: ExtensionManifest
  /** Absolute path to the extension package root */
  packagePath: string
  /** Whether activate() has been called */
  activated: boolean
  /** The main-process module after dynamic import */
  mainModule?: ExtensionMainAPI
}
