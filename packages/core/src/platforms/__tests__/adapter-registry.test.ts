import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { discoverAdapters } from '../adapter-registry'

function makeDir(): string {
  const dir = join(tmpdir(), `openorbit-adapter-test-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writePackage(dir: string, name: string, pkg: Record<string, unknown>): void {
  const pkgDir = join(dir, 'node_modules', '@openorbit', name)
  mkdirSync(pkgDir, { recursive: true })
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg), 'utf-8')
}

describe('discoverAdapters()', () => {
  let root: string

  beforeEach(() => {
    root = makeDir()
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('returns empty array when node_modules/@openorbit does not exist', async () => {
    const result = await discoverAdapters(root)
    expect(result).toEqual([])
  })

  it('discovers packages with openorbit-adapter keyword', async () => {
    writePackage(root, 'glassdoor', {
      name: '@openorbit/glassdoor',
      version: '1.0.0',
      description: 'Glassdoor adapter',
      keywords: ['openorbit-adapter'],
      'openorbit-platform': 'glassdoor.com'
    })

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('@openorbit/glassdoor')
    expect(result[0].version).toBe('1.0.0')
    expect(result[0].platform).toBe('glassdoor.com')
    expect(result[0].description).toBe('Glassdoor adapter')
  })

  it('ignores packages without openorbit-adapter keyword', async () => {
    writePackage(root, 'some-tool', {
      name: '@openorbit/some-tool',
      version: '1.0.0',
      keywords: ['utility']
    })

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(0)
  })

  it('ignores packages without keywords field', async () => {
    writePackage(root, 'no-keywords', {
      name: '@openorbit/no-keywords',
      version: '1.0.0'
    })

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(0)
  })

  it('discovers multiple adapters', async () => {
    writePackage(root, 'glassdoor', {
      name: '@openorbit/glassdoor',
      version: '1.0.0',
      keywords: ['openorbit-adapter'],
      'openorbit-platform': 'glassdoor.com'
    })
    writePackage(root, 'dice', {
      name: '@openorbit/dice',
      version: '0.9.0',
      keywords: ['openorbit-adapter', 'jobs'],
      'openorbit-platform': 'dice.com'
    })

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(2)
    const names = result.map((r) => r.name)
    expect(names).toContain('@openorbit/glassdoor')
    expect(names).toContain('@openorbit/dice')
  })

  it('skips packages with invalid package.json', async () => {
    const pkgDir = join(root, 'node_modules', '@openorbit', 'bad-json')
    mkdirSync(pkgDir, { recursive: true })
    writeFileSync(join(pkgDir, 'package.json'), 'not valid json{{{}}}')

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(0)
  })

  it('skips package directories without package.json', async () => {
    const pkgDir = join(root, 'node_modules', '@openorbit', 'no-pkg-json')
    mkdirSync(pkgDir, { recursive: true })
    // no package.json written

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(0)
  })

  it('handles missing optional fields gracefully', async () => {
    writePackage(root, 'minimal', {
      name: '@openorbit/minimal',
      keywords: ['openorbit-adapter']
      // no version, description, or openorbit-platform
    })

    const result = await discoverAdapters(root)
    expect(result).toHaveLength(1)
    expect(result[0].version).toBe('unknown')
    expect(result[0].description).toBeUndefined()
    expect(result[0].platform).toBeUndefined()
  })
})
