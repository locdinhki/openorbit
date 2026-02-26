import { watch, type FSWatcher } from 'fs'
import { EventEmitter } from 'events'
import { createLogger } from './logger'

const log = createLogger('ConfigWatcher')

export type ConfigChangeType = 'hints' | 'settings' | 'data'

export interface ConfigChangeEvent {
  type: ConfigChangeType
  filename: string | null
}

export class ConfigWatcher extends EventEmitter {
  private watchers: Map<string, FSWatcher> = new Map()
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private debounceMs: number

  constructor(debounceMs = 300) {
    super()
    this.debounceMs = debounceMs
  }

  watch(directory: string, type: ConfigChangeType): void {
    if (this.watchers.has(directory)) {
      log.warn('Already watching directory', { directory })
      return
    }

    try {
      const watcher = watch(directory, { recursive: true }, (_, filename) => {
        this.handleChange(type, filename)
      })

      watcher.on('error', (err) => {
        log.error('Watch error', { directory, error: String(err) })
        this.emit('error', err)
      })

      this.watchers.set(directory, watcher)
      log.info('Watching directory', { directory, type })
    } catch (err) {
      log.error('Failed to watch directory', { directory, error: String(err) })
    }
  }

  private handleChange(type: ConfigChangeType, filename: string | null): void {
    const key = `${type}:${filename ?? 'unknown'}`

    const existing = this.debounceTimers.get(key)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)

      const event: ConfigChangeEvent = { type, filename }
      this.emit('change', event)
      this.emit(type, event)

      log.info('Config change detected', { type, filename })
    }, this.debounceMs)

    this.debounceTimers.set(key, timer)
  }

  close(): void {
    for (const [dir, watcher] of this.watchers) {
      watcher.close()
      log.info('Stopped watching', { directory: dir })
    }
    this.watchers.clear()

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    this.removeAllListeners()
  }
}
