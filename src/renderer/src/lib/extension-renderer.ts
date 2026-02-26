// ============================================================================
// OpenOrbit — Renderer Extension Host
// ============================================================================
//
// Registry that maps extension view IDs to React components.
// Extensions call ctx.views.register('my-view', MyComponent) during activation.
// Shell containers look up components from this registry.

import type {
  ExtensionManifest,
  ExtensionRendererAPI,
  ExtensionRendererContext,
  ExtensionViewRegistry,
  ExtensionCommandRegistry,
  ExtensionIPCClient
} from '@openorbit/core/extensions/types'

type ReactComponentType = (...args: unknown[]) => unknown

// ---------------------------------------------------------------------------
// View registry
// ---------------------------------------------------------------------------

const viewRegistry = new Map<string, ReactComponentType>()
const commandRegistry = new Map<string, () => void>()
const loadedExtensions = new Set<string>()

/**
 * Get a registered view component by ID.
 */
export function getExtensionView(viewId: string): ReactComponentType | null {
  return viewRegistry.get(viewId) ?? null
}

/**
 * Register a shell-level (built-in) view component.
 * Uses the same registry as extension views so SidebarContainer works unchanged.
 */
export function registerShellView(viewId: string, component: ReactComponentType): void {
  viewRegistry.set(viewId, component)
}

/**
 * Get all registered view IDs.
 */
export function getRegisteredViewIds(): string[] {
  return [...viewRegistry.keys()]
}

/**
 * Execute a registered command.
 */
export function executeCommand(commandId: string): void {
  const handler = commandRegistry.get(commandId)
  if (handler) {
    handler()
  }
}

// ---------------------------------------------------------------------------
// Extension loading
// ---------------------------------------------------------------------------

/**
 * Load and activate a renderer extension module.
 * Called by the shell during startup or lazy activation.
 */
export async function loadRendererExtension(
  manifest: ExtensionManifest,
  rendererModule: ExtensionRendererAPI
): Promise<void> {
  if (loadedExtensions.has(manifest.id)) return

  const ctx = createRendererContext(manifest.id)
  rendererModule.activate(ctx)
  loadedExtensions.add(manifest.id)
}

/**
 * Check if an extension's renderer has been loaded.
 */
export function isRendererExtensionLoaded(extensionId: string): boolean {
  return loadedExtensions.has(extensionId)
}

// ---------------------------------------------------------------------------
// Context factory
// ---------------------------------------------------------------------------

function createRendererContext(extensionId: string): ExtensionRendererContext {
  const views: ExtensionViewRegistry = {
    register(viewId: string, component: unknown): void {
      viewRegistry.set(viewId, component as ReactComponentType)
    }
  }

  const commands: ExtensionCommandRegistry = {
    register(commandId: string, handler: () => void): void {
      commandRegistry.set(commandId, handler)
    },
    execute(commandId: string): void {
      executeCommand(commandId)
    }
  }

  const ipc: ExtensionIPCClient = {
    async invoke<T = unknown>(channel: string, args?: unknown): Promise<T> {
      return window.api.invoke(channel, args) as Promise<T>
    },
    on(channel: string, callback: (...args: unknown[]) => void): () => void {
      return window.api.on(channel, callback)
    }
  }

  return {
    extensionId,
    views,
    commands,
    ipc
  }
}
