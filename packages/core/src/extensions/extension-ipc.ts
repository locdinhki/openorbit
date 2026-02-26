// ============================================================================
// OpenOrbit — Scoped IPC for Extensions
// ============================================================================

import type { ZodType, z } from 'zod'
import type { ExtensionIPCHost } from './types'
import { createLogger } from '../utils/logger'

/**
 * Creates a scoped IPC host for an extension.
 *
 * All channels registered through this host are validated to start with
 * `{extensionId}:` to prevent namespace collisions between extensions.
 * Extension IDs must start with `ext-` (enforced by manifest schema),
 * so channels always match the preload whitelist prefix `ext-*`.
 *
 * Requires the Electron ipcMain module and a BrowserWindow reference
 * to be injected (avoids importing Electron from core package).
 */
export function createExtensionIPCHost(
  extensionId: string,
  ipcMain: {
    handle(channel: string, listener: (event: unknown, ...args: unknown[]) => unknown): void
    removeHandler(channel: string): void
  },
  getMainWindow: () => { webContents: { send(channel: string, ...args: unknown[]): void } } | null
): ExtensionIPCHost {
  const log = createLogger(`ext-ipc:${extensionId}`)
  const prefix = `${extensionId}:`
  const registeredChannels = new Set<string>()

  function validateChannel(channel: string): void {
    if (!channel.startsWith(prefix)) {
      throw new Error(
        `Extension "${extensionId}" cannot register channel "${channel}". ` +
          `Channels must start with "${prefix}".`
      )
    }
  }

  return {
    handle<TSchema extends ZodType>(
      channel: string,
      schema: TSchema,
      handler: (event: unknown, args: z.infer<TSchema>) => unknown | Promise<unknown>
    ): void {
      validateChannel(channel)

      if (registeredChannels.has(channel)) {
        log.warn(`Channel "${channel}" already registered, replacing handler`)
        ipcMain.removeHandler(channel)
      }

      ipcMain.handle(channel, async (event: unknown, ...rawArgs: unknown[]) => {
        const argsObj = rawArgs.length === 0 ? {} : rawArgs.length === 1 ? rawArgs[0] : rawArgs[0]

        const parsed = schema.safeParse(argsObj ?? {})
        if (!parsed.success) {
          const errorMessage =
            'issues' in parsed.error
              ? parsed.error.issues.map((i: { message: string }) => i.message).join(', ')
              : String(parsed.error)
          log.warn(`Validation failed for ${channel}`, { error: errorMessage })
          return {
            success: false,
            error: `Validation error: ${errorMessage}`,
            code: 'VALIDATION_ERROR'
          }
        }

        return handler(event, parsed.data)
      })

      registeredChannels.add(channel)
      log.debug(`Registered IPC handler: ${channel}`)
    },

    push(channel: string, data: unknown): void {
      validateChannel(channel)
      const win = getMainWindow()
      if (win) {
        win.webContents.send(channel, data)
      }
    },

    removeHandler(channel: string): void {
      validateChannel(channel)
      if (registeredChannels.has(channel)) {
        ipcMain.removeHandler(channel)
        registeredChannels.delete(channel)
        log.debug(`Removed IPC handler: ${channel}`)
      }
    }
  }
}
