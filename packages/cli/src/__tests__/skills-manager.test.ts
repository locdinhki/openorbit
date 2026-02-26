import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { SkillsManager } from '../skills-manager'
import type { SkillRegistry } from '../skills-manager'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDir(): string {
  const dir = join(tmpdir(), `openorbit-test-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

const VALID_SKILL_YAML = `site: glassdoor.com
lastVerified: "2025-01-01"

## search_jobs

### navigate
- **selectors**: .search-btn
- **confidence**: 0.9
`

const MOCK_REGISTRY: SkillRegistry = {
  updatedAt: '2025-01-01',
  skills: [
    {
      name: '@community/glassdoor',
      version: '1.0.0',
      description: 'Glassdoor job search and extraction',
      url: 'https://raw.githubusercontent.com/openorbit/skills-registry/main/skills/glassdoor.yaml',
      author: 'community',
      platform: 'glassdoor.com'
    },
    {
      name: '@community/dice',
      version: '0.9.0',
      description: 'Dice.com job search',
      url: 'https://raw.githubusercontent.com/openorbit/skills-registry/main/skills/dice.yaml',
      author: 'community',
      platform: 'dice.com'
    }
  ]
}

// ---------------------------------------------------------------------------

describe('SkillsManager', () => {
  let dataDir: string
  let mgr: SkillsManager

  beforeEach(() => {
    dataDir = makeDir()
    mgr = new SkillsManager(dataDir)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    rmSync(dataDir, { recursive: true, force: true })
  })

  describe('list()', () => {
    it('returns empty array when community dir does not exist', () => {
      expect(mgr.list()).toEqual([])
    })

    it('returns installed skill names', () => {
      const communityDir = join(dataDir, 'skills', 'community')
      mkdirSync(communityDir, { recursive: true })
      writeFileSync(join(communityDir, 'glassdoor.yaml'), VALID_SKILL_YAML)
      writeFileSync(join(communityDir, 'dice.yaml'), VALID_SKILL_YAML)

      const names = mgr.list()
      expect(names).toContain('@community/glassdoor')
      expect(names).toContain('@community/dice')
    })

    it('ignores non-yaml files', () => {
      const communityDir = join(dataDir, 'skills', 'community')
      mkdirSync(communityDir, { recursive: true })
      writeFileSync(join(communityDir, 'notes.txt'), 'not a skill')
      expect(mgr.list()).toEqual([])
    })
  })

  describe('fetchRegistry()', () => {
    it('parses the registry JSON', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_REGISTRY)
      } as Response)

      const registry = await mgr.fetchRegistry()
      expect(registry.skills).toHaveLength(2)
      expect(registry.skills[0].name).toBe('@community/glassdoor')
    })

    it('throws on HTTP error', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      await expect(mgr.fetchRegistry()).rejects.toThrow('404')
    })
  })

  describe('install()', () => {
    it('downloads and writes skill file', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_REGISTRY)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_SKILL_YAML)
        } as Response)

      const meta = await mgr.install('@community/glassdoor')
      expect(meta.name).toBe('@community/glassdoor')
      expect(mgr.list()).toContain('@community/glassdoor')
    })

    it('throws when skill not in registry', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(MOCK_REGISTRY)
      } as Response)

      await expect(mgr.install('@community/unknown')).rejects.toThrow("not found in registry")
    })

    it('throws when skill download fails', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_REGISTRY)
        } as Response)
        .mockResolvedValueOnce({ ok: false, status: 503 } as Response)

      await expect(mgr.install('@community/glassdoor')).rejects.toThrow('503')
    })

    it('throws when skill content is invalid', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_REGISTRY)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve('just some random text without site field')
        } as Response)

      await expect(mgr.install('@community/glassdoor')).rejects.toThrow('invalid')
    })
  })

  describe('remove()', () => {
    it('removes an installed skill', async () => {
      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(MOCK_REGISTRY)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(VALID_SKILL_YAML)
        } as Response)
      await mgr.install('@community/glassdoor')

      mgr.remove('@community/glassdoor')
      expect(mgr.list()).not.toContain('@community/glassdoor')
    })

    it('throws when skill is not installed', () => {
      expect(() => mgr.remove('@community/notinstalled')).toThrow('not installed')
    })
  })

  describe('toFilename()', () => {
    it('converts @community/name to name.yaml', () => {
      expect(mgr.toFilename('@community/glassdoor')).toBe('glassdoor.yaml')
    })

    it('handles names without scope', () => {
      expect(mgr.toFilename('dice')).toBe('dice.yaml')
    })
  })

  describe('validateSkillContent()', () => {
    it('accepts valid skill YAML', () => {
      expect(() => mgr.validateSkillContent('test', VALID_SKILL_YAML)).not.toThrow()
    })

    it('rejects content without site field', () => {
      expect(() =>
        mgr.validateSkillContent('test', 'platform: glassdoor.com\nactions: []')
      ).toThrow('missing required "site:"')
    })

    it('accepts Markdown with frontmatter containing site', () => {
      const md = '---\nsite: example.com\n---\n## actions\n'
      expect(() => mgr.validateSkillContent('test', md)).not.toThrow()
    })
  })
})
