import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// Reset module state between tests
let initLogger: typeof import('../logger').initLogger
let createLogger: typeof import('../logger').createLogger
let getLogPath: typeof import('../logger').getLogPath
let setLogLevel: typeof import('../logger').setLogLevel

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function resetModule() {
  vi.resetModules()
  return import('../logger')
}

describe('logger', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'logger-test-'))
    const mod = await resetModule()
    initLogger = mod.initLogger
    createLogger = mod.createLogger
    getLogPath = mod.getLogPath
    setLogLevel = mod.setLogLevel
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  it('creates log directory if it does not exist', () => {
    const logDir = join(tempDir, 'logs')
    expect(existsSync(logDir)).toBe(false)
    initLogger(logDir)
    expect(existsSync(logDir)).toBe(true)
  })

  it('writes JSON lines to log file', () => {
    initLogger(tempDir)
    const log = createLogger('TestContext')
    log.info('Hello world')
    log.warn('Warning message', { key: 'value' })

    const logPath = getLogPath()!
    expect(logPath).toBeTruthy()
    expect(existsSync(logPath)).toBe(true)

    const content = readFileSync(logPath, 'utf-8').trim().split('\n')
    expect(content).toHaveLength(2)

    const line1 = JSON.parse(content[0])
    expect(line1.level).toBe('info')
    expect(line1.ctx).toBe('TestContext')
    expect(line1.msg).toBe('Hello world')
    expect(line1.ts).toBeDefined()

    const line2 = JSON.parse(content[1])
    expect(line2.level).toBe('warn')
    expect(line2.data).toEqual({ key: 'value' })
  })

  it('respects log level filtering', () => {
    initLogger(tempDir)
    setLogLevel('warn')
    const log = createLogger('Test')

    log.debug('should not appear')
    log.info('should not appear')
    log.warn('should appear')
    log.error('should appear')

    const logPath = getLogPath()!
    const content = readFileSync(logPath, 'utf-8').trim().split('\n')
    expect(content).toHaveLength(2)
    expect(JSON.parse(content[0]).level).toBe('warn')
    expect(JSON.parse(content[1]).level).toBe('error')
  })

  it('returns log file path after init', () => {
    initLogger(tempDir)
    const path = getLogPath()
    expect(path).toContain('openorbit-')
    expect(path).toContain('.log')
  })

  it('generates log file name with current date', () => {
    initLogger(tempDir)
    const path = getLogPath()!
    const today = new Date().toISOString().split('T')[0]
    expect(path).toContain(`openorbit-${today}.log`)
  })

  it('prunes log files older than 7 days', () => {
    // Create old log files
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10)
    const oldFileName = `openorbit-${oldDate.toISOString().split('T')[0]}.log`
    writeFileSync(join(tempDir, oldFileName), 'old log')

    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 3)
    const recentFileName = `openorbit-${recentDate.toISOString().split('T')[0]}.log`
    writeFileSync(join(tempDir, recentFileName), 'recent log')

    initLogger(tempDir)

    expect(existsSync(join(tempDir, oldFileName))).toBe(false)
    expect(existsSync(join(tempDir, recentFileName))).toBe(true)
  })

  it('does not prune non-log files', () => {
    writeFileSync(join(tempDir, 'other-file.txt'), 'keep me')
    initLogger(tempDir)
    expect(existsSync(join(tempDir, 'other-file.txt'))).toBe(true)
  })

  it('writes to console in dev mode and to file', () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    initLogger(tempDir, true) // dev mode
    const log = createLogger('Dev')
    log.info('dev message')

    expect(consoleSpy).toHaveBeenCalled()
    const logPath = getLogPath()!
    const content = readFileSync(logPath, 'utf-8').trim()
    expect(content.length).toBeGreaterThan(0)

    consoleSpy.mockRestore()
  })
})
