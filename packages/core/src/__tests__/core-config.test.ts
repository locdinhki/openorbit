import { describe, it, expect, beforeEach } from 'vitest'
import { initCore, getCoreConfig, isCoreInitialized, resetCoreConfig } from '../config'
import type { CoreConfig } from '../config'

import { vi } from 'vitest'
vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

const testConfig: CoreConfig = {
  dataDir: '/tmp/test/data',
  backupDir: '/tmp/test/backups',
  logDir: '/tmp/test/logs',
  hintsDir: '/tmp/test/hints',
  browserProfileDir: '/tmp/test/browser-profile',
  isDev: true
}

describe('CoreConfig', () => {
  beforeEach(() => {
    resetCoreConfig()
  })

  it('throws when getCoreConfig is called before initCore', () => {
    expect(() => getCoreConfig()).toThrow('Core not initialized')
  })

  it('returns config after initCore', () => {
    initCore(testConfig)
    const config = getCoreConfig()
    expect(config.dataDir).toBe('/tmp/test/data')
    expect(config.backupDir).toBe('/tmp/test/backups')
    expect(config.isDev).toBe(true)
  })

  it('isCoreInitialized returns false before init', () => {
    expect(isCoreInitialized()).toBe(false)
  })

  it('isCoreInitialized returns true after init', () => {
    initCore(testConfig)
    expect(isCoreInitialized()).toBe(true)
  })

  it('resetCoreConfig clears the config', () => {
    initCore(testConfig)
    expect(isCoreInitialized()).toBe(true)
    resetCoreConfig()
    expect(isCoreInitialized()).toBe(false)
    expect(() => getCoreConfig()).toThrow('Core not initialized')
  })
})
