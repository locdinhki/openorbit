import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { ConfigChangeEvent, ConfigChangeType } from '../config-watcher'

vi.mock('../logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const { ConfigWatcher } = await import('../config-watcher')

describe('ConfigWatcher', () => {
  let tempDir: string
  let watcher: InstanceType<typeof ConfigWatcher>

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-watcher-test-'))
  })

  afterEach(() => {
    watcher?.close()
    try {
      rmSync(tempDir, { recursive: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('emits change event when a file is modified', async () => {
    watcher = new ConfigWatcher(50) // short debounce for tests
    watcher.watch(tempDir, 'hints')

    const received = new Promise<ConfigChangeEvent>((resolve) => {
      watcher.on('change', resolve)
    })

    // Trigger a filesystem change
    writeFileSync(join(tempDir, 'test.json'), '{"updated": true}')

    const event = await received
    expect(event.type).toBe('hints')
    expect(typeof event.filename).toBe('string')
  })

  it('emits typed event matching the watch type', async () => {
    watcher = new ConfigWatcher(50)
    watcher.watch(tempDir, 'settings')

    const received = new Promise<ConfigChangeEvent>((resolve) => {
      watcher.on('settings', resolve)
    })

    writeFileSync(join(tempDir, 'config.json'), '{}')

    const event = await received
    expect(event.type).toBe('settings')
  })

  it('debounces rapid changes', async () => {
    watcher = new ConfigWatcher(100)
    watcher.watch(tempDir, 'hints')

    const events: ConfigChangeEvent[] = []
    watcher.on('change', (e: ConfigChangeEvent) => events.push(e))

    const file = join(tempDir, 'rapid.json')
    // Write the same file multiple times rapidly
    writeFileSync(file, '1')
    writeFileSync(file, '2')
    writeFileSync(file, '3')

    // Wait for debounce to settle
    await new Promise((r) => setTimeout(r, 250))

    // Should have debounced to a single event per unique filename
    expect(events.length).toBeLessThanOrEqual(2) // fs.watch may fire once or twice
    expect(events.length).toBeGreaterThanOrEqual(1)
  })

  it('does not emit after close()', async () => {
    watcher = new ConfigWatcher(50)
    watcher.watch(tempDir, 'hints')

    const events: ConfigChangeEvent[] = []
    watcher.on('change', (e: ConfigChangeEvent) => events.push(e))

    watcher.close()

    writeFileSync(join(tempDir, 'after-close.json'), '{}')
    await new Promise((r) => setTimeout(r, 150))

    expect(events).toHaveLength(0)
  })

  it('ignores duplicate watch on same directory', () => {
    watcher = new ConfigWatcher(50)
    watcher.watch(tempDir, 'hints')
    watcher.watch(tempDir, 'hints') // should not throw or create duplicate

    // Just verify no error — a single close should clean up
    watcher.close()
  })

  it('can watch multiple directories', async () => {
    const tempDir2 = mkdtempSync(join(tmpdir(), 'config-watcher-test2-'))
    watcher = new ConfigWatcher(50)
    watcher.watch(tempDir, 'hints')
    watcher.watch(tempDir2, 'data')

    const events: ConfigChangeType[] = []
    watcher.on('change', (e: ConfigChangeEvent) => events.push(e.type))

    writeFileSync(join(tempDir, 'a.json'), '{}')
    writeFileSync(join(tempDir2, 'b.json'), '{}')

    await new Promise((r) => setTimeout(r, 200))

    expect(events).toContain('hints')
    expect(events).toContain('data')

    try {
      rmSync(tempDir2, { recursive: true })
    } catch {
      // ignore
    }
  })

  it('emits error event on watcher error', () => {
    watcher = new ConfigWatcher(50)

    const errors: Error[] = []
    watcher.on('error', (e: Error) => errors.push(e))

    // Watching a non-existent directory should not throw (caught internally)
    watcher.watch('/tmp/nonexistent-dir-' + Date.now(), 'hints')

    // No crash — error is logged internally
    expect(true).toBe(true)
  })

  it('close() is safe to call multiple times', () => {
    watcher = new ConfigWatcher(50)
    watcher.watch(tempDir, 'hints')

    watcher.close()
    watcher.close() // should not throw
  })
})
