import { ipcMain } from 'electron'
import type { z, ZodType } from 'zod'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('IPC-Validation')

/**
 * Register an IPC handler with Zod schema validation.
 * Validates the arguments object before passing to the handler.
 * On validation failure, returns a structured error response.
 */
export function validatedHandle<TSchema extends ZodType>(
  channel: string,
  schema: TSchema,
  handler: (
    event: Electron.IpcMainInvokeEvent,
    args: z.infer<TSchema>
  ) => unknown | Promise<unknown>
): void {
  ipcMain.handle(channel, async (event, ...rawArgs) => {
    // Build args object from positional arguments based on channel convention
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
}
