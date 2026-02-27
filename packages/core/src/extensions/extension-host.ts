// ============================================================================
// OpenOrbit — Extension Host (Main Process Lifecycle Manager)
// ============================================================================

import { readdirSync, existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { mkdirSync } from 'fs'
import type {
  ExtensionManifest,
  ExtensionMainAPI,
  ExtensionContext,
  LoadedExtension,
  SharedServices,
  ExtensionEventBus
} from './types'
import { safeParseManifest } from './manifest'
import { createExtensionIPCHost } from './extension-ipc'
import { runExtensionMigrations, ensureExtMigrationsTable } from './extension-db'
import { createLogger } from '../utils/logger'
import { EventEmitter } from 'events'
import type Database from 'better-sqlite3'

const log = createLogger('ExtensionHost')

/** Extensions that are enabled by default (no explicit user opt-in needed). */
const CORE_EXTENSION_IDS = new Set(['ext-db-viewer'])

export interface ExtensionHostDeps {
  /** Electron ipcMain module */
  ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
    removeHandler(channel: string): void
  }
  /** Get the main BrowserWindow (for push events) */
  getMainWindow: () => {
    webContents: { send(channel: string, ...args: unknown[]): void }
  } | null
  /** The shared SQLite database */
  db: Database.Database
  /** Shared services exposed to extensions */
  services: SharedServices
  /** Absolute path to the project root (where packages/ lives) */
  projectRoot: string
  /** Storage root for extension data (e.g. ~/Library/Application Support/openorbit/extensions/) */
  extensionDataRoot: string
  /**
   * Pre-loaded extension main modules keyed by extension ID.
   * Used for built-in extensions that are statically imported and bundled
   * by the build system (electron-vite). This avoids runtime dynamic imports
   * of .ts files which don't work in bundled Electron apps.
   */
  preloadedModules?: Map<string, ExtensionMainAPI>
}

export class ExtensionHost {
  private extensions = new Map<string, LoadedExtension>()
  private deps: ExtensionHostDeps

  constructor(deps: ExtensionHostDeps) {
    this.deps = deps
  }

  /**
   * Discover all extensions from workspace packages and activate those
   * with "onStartup" in their activationEvents.
   */
  async discoverAndLoadAll(): Promise<void> {
    ensureExtMigrationsTable(this.deps.db)

    const manifests = this.discoverExtensions()
    log.info(`Discovered ${manifests.length} extension(s)`)

    for (const { manifest, packagePath } of manifests) {
      this.extensions.set(manifest.id, {
        manifest,
        packagePath,
        activated: false
      })
    }

    // Activate extensions with "onStartup" event (skip disabled ones)
    for (const [id, ext] of this.extensions) {
      if (ext.manifest.activationEvents.includes('onStartup') && this.isExtensionEnabled(id)) {
        try {
          await this.activateExtension(id)
        } catch (err) {
          log.error(`Failed to activate extension "${id}" on startup`, err)
        }
      }
    }
  }

  /**
   * Activate a specific extension by ID.
   */
  async activateExtension(id: string): Promise<void> {
    const ext = this.extensions.get(id)
    if (!ext) {
      log.error(`Extension "${id}" not found`)
      return
    }
    if (ext.activated) {
      log.debug(`Extension "${id}" already activated`)
      return
    }

    log.info(`Activating extension: ${ext.manifest.displayName} (${id})`)

    // Use pre-loaded module if available (built-in extensions bundled by Vite),
    // otherwise fall back to dynamic import (for future runtime plugins).
    let mainModule: ExtensionMainAPI
    const preloaded = this.deps.preloadedModules?.get(id)
    if (preloaded) {
      mainModule = preloaded
    } else {
      const mainEntryPath = resolve(ext.packagePath, ext.manifest.main)
      const mod = (await import(mainEntryPath)) as { default: ExtensionMainAPI }
      mainModule = mod.default
    }

    // Run extension migrations before activation
    if (mainModule.migrations && mainModule.migrations.length > 0) {
      runExtensionMigrations(this.deps.db, id, mainModule.migrations)
    }

    // Create scoped context for this extension
    const ctx = this.createContext(ext)

    // Activate — let errors propagate so callers can handle them
    await mainModule.activate(ctx)

    ext.mainModule = mainModule
    ext.activated = true
    log.info(`Extension "${id}" activated successfully`)
  }

  /**
   * Deactivate all extensions (called during app shutdown).
   */
  async deactivateAll(): Promise<void> {
    // Deactivate in reverse order
    const ids = [...this.extensions.keys()].reverse()
    for (const id of ids) {
      const ext = this.extensions.get(id)
      if (ext?.activated && ext.mainModule?.deactivate) {
        try {
          await ext.mainModule.deactivate()
          log.info(`Extension "${id}" deactivated`)
        } catch (err) {
          log.error(`Error deactivating extension "${id}"`, err)
        }
      }
    }
  }

  /**
   * Get a loaded extension's manifest by ID.
   */
  getManifest(id: string): ExtensionManifest | undefined {
    return this.extensions.get(id)?.manifest
  }

  /**
   * List all discovered extension manifests.
   */
  listExtensions(): ExtensionManifest[] {
    return [...this.extensions.values()].map((ext) => ext.manifest)
  }

  /**
   * Get all contribution points of a given type, sorted by priority.
   */
  getContributions<K extends keyof ExtensionManifest['contributes']>(
    type: K
  ): NonNullable<ExtensionManifest['contributes'][K]> {
    const all: unknown[] = []
    for (const ext of this.extensions.values()) {
      const contributions = ext.manifest.contributes[type]
      if (contributions) {
        all.push(...contributions)
      }
    }
    // Sort by priority if applicable (higher priority first)
    if (all.length > 0 && typeof (all[0] as { priority?: number }).priority === 'number') {
      all.sort(
        (a, b) =>
          ((b as { priority: number }).priority ?? 0) - ((a as { priority: number }).priority ?? 0)
      )
    }
    return all as NonNullable<ExtensionManifest['contributes'][K]>
  }

  /**
   * Check if an extension is activated. If not, check if viewing a contribution
   * triggers lazy activation.
   */
  async ensureActivatedForView(viewId: string): Promise<void> {
    for (const [id, ext] of this.extensions) {
      if (ext.activated) continue

      const allViewIds = [
        ...(ext.manifest.contributes.sidebar ?? []),
        ...(ext.manifest.contributes.workspace ?? []),
        ...(ext.manifest.contributes.panel ?? [])
      ].map((v) => v.id)

      if (allViewIds.includes(viewId)) {
        const activationEvent = `onView:${viewId}`
        if (ext.manifest.activationEvents.includes(activationEvent)) {
          try {
            await this.activateExtension(id)
          } catch (err) {
            log.error(`Failed to activate extension "${id}" for view "${viewId}"`, err)
          }
        }
      }
    }
  }

  /**
   * Check if an extension is enabled.
   * Core extensions (AI providers, db-viewer) default to enabled.
   * All other extensions default to disabled until explicitly enabled.
   */
  isExtensionEnabled(id: string): boolean {
    const row = this.deps.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(`ext.${id}.enabled`) as { value: string } | undefined
    if (row) return row.value !== '0'
    // No explicit setting — core extensions default on, others default off
    return CORE_EXTENSION_IDS.has(id)
  }

  /**
   * Enable an extension and activate it if it has onStartup.
   * Returns `{ activated }` on success, or `{ error }` on failure.
   */
  async enableExtension(id: string): Promise<{ activated: boolean; error?: string }> {
    this.deps.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = '1'`
      )
      .run(`ext.${id}.enabled`)
    log.info(`Extension "${id}" enabled`)

    const ext = this.extensions.get(id)
    if (ext && !ext.activated && ext.manifest.activationEvents.includes('onStartup')) {
      try {
        await this.activateExtension(id)
        return { activated: ext.activated }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Activation failed'
        log.error(`Failed to activate extension "${id}"`, err)
        return { activated: false, error: message }
      }
    }
    return { activated: ext?.activated ?? false }
  }

  /**
   * Disable an extension (takes effect on next restart for currently active ones).
   */
  disableExtension(id: string): void {
    this.deps.db
      .prepare(
        `INSERT INTO settings (key, value) VALUES (?, '0') ON CONFLICT(key) DO UPDATE SET value = '0'`
      )
      .run(`ext.${id}.enabled`)
    log.info(`Extension "${id}" disabled (takes effect on restart)`)
  }

  /**
   * Get enabled status for all discovered extensions.
   */
  getEnabledMap(): Record<string, boolean> {
    const result: Record<string, boolean> = {}
    for (const id of this.extensions.keys()) {
      result[id] = this.isExtensionEnabled(id)
    }
    return result
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private discoverExtensions(): { manifest: ExtensionManifest; packagePath: string }[] {
    const results: { manifest: ExtensionManifest; packagePath: string }[] = []
    const extensionsDir = join(this.deps.projectRoot, 'packages', 'extensions')

    if (!existsSync(extensionsDir)) {
      log.warn(`Extensions directory not found: ${extensionsDir}`)
      return results
    }

    let dirs: string[]
    try {
      dirs = readdirSync(extensionsDir)
    } catch {
      return results
    }

    for (const dir of dirs) {
      const pkgJsonPath = join(extensionsDir, dir, 'package.json')
      if (!existsSync(pkgJsonPath)) continue

      try {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
        const openorbitField = pkgJson['openorbit']
        if (!openorbitField) continue

        // Inject description and version from outer package.json if not in openorbit block
        if (!openorbitField.description && pkgJson.description) {
          openorbitField.description = pkgJson.description
        }
        if (!openorbitField.version && pkgJson.version) {
          openorbitField.version = pkgJson.version
        }

        const result = safeParseManifest(openorbitField)
        if (!result.success) {
          log.warn(`Invalid manifest in ${dir}/package.json:`, result.error)
          continue
        }

        results.push({
          manifest: result.data as ExtensionManifest,
          packagePath: join(extensionsDir, dir)
        })
        log.debug(`Discovered extension: ${result.data.id} (${dir})`)
      } catch (err) {
        log.warn(`Failed to read ${pkgJsonPath}`, err)
      }
    }

    return results
  }

  private createContext(ext: LoadedExtension): ExtensionContext {
    // Scoped IPC
    const ipc = createExtensionIPCHost(ext.manifest.id, this.deps.ipcMain, this.deps.getMainWindow)

    // Scoped event bus
    const events = this.createEventBus(ext.manifest.id)

    // Extension storage path
    const storagePath = join(this.deps.extensionDataRoot, ext.manifest.id)
    if (!existsSync(storagePath)) {
      mkdirSync(storagePath, { recursive: true })
    }

    // Scoped logger
    const extLog = createLogger(`ext:${ext.manifest.id}`)

    return {
      extensionId: ext.manifest.id,
      ipc,
      db: this.deps.db,
      services: this.deps.services,
      events,
      storagePath,
      log: extLog
    }
  }

  private createEventBus(extensionId: string): ExtensionEventBus {
    const emitter = new EventEmitter()
    return {
      emit(event: string, ...args: unknown[]): boolean {
        return emitter.emit(`ext:${extensionId}:${event}`, ...args)
      },
      on(event: string, listener: (...args: unknown[]) => void): void {
        emitter.on(`ext:${extensionId}:${event}`, listener)
      },
      off(event: string, listener: (...args: unknown[]) => void): void {
        emitter.off(`ext:${extensionId}:${event}`, listener)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton access
// ---------------------------------------------------------------------------

let host: ExtensionHost | null = null

export function initExtensionHost(deps: ExtensionHostDeps): ExtensionHost {
  host = new ExtensionHost(deps)
  return host
}

export function getExtensionHost(): ExtensionHost {
  if (!host) throw new Error('ExtensionHost not initialized. Call initExtensionHost() first.')
  return host
}
