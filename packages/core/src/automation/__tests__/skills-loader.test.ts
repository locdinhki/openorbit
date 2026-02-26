import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SkillsLoader } from '../skills-loader'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string
let loader: SkillsLoader

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'skills-test-'))
  loader = new SkillsLoader([tempDir])
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

const MINIMAL_MD = `---
site: test.com/jobs
---

## search_jobs

### navigate_to_search
- **selectors**: (none)
- **location**: url
- **elementType**: navigation
- **fallback**: Navigate to test search
- **confidence**: 0.9
`

const FULL_MD = `---
site: linkedin.com/jobs
lastFullScan: "2025-01-01"
lastVerified: "2025-06-01"
---

## search_jobs

### navigate_to_search
- **selectors**: (none)
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: url
- **elementType**: navigation
- **fallback**: Navigate to LinkedIn job search URL with query parameters
- **confidence**: 0.95

### wait_for_results
- **selectors**: \`.jobs-search-results-list\`, \`.scaffold-layout__list\`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: main
- **elementType**: container
- **fallback**: Wait for job search results container to appear
- **confidence**: 0.85

## extract_job_cards

### find_job_cards
- **selectors**: \`.job-card-container\`, \`.jobs-search-results__list-item\`
- **textMatches**: (none)
- **ariaLabels**: (none)
- **location**: .jobs-search-results-list
- **elementType**: li
- **fallback**: Find all job card list items
- **confidence**: 0.8

## check_authentication

### verify_logged_in
- **selectors**: \`.global-nav__me-photo\`, \`img.global-nav__me-photo\`
- **textMatches**: (none)
- **ariaLabels**: \`Profile\`, \`Me\`
- **location**: nav
- **elementType**: img, button
- **fallback**: Check if user is logged in
- **confidence**: 0.9
`

describe('SkillsLoader', () => {
  describe('loadSkill', () => {
    it('returns null when no skill file exists', () => {
      expect(loader.loadSkill('nonexistent')).toBeNull()
    })

    it('loads a markdown skill file by site name', () => {
      writeFileSync(join(tempDir, 'test.md'), MINIMAL_MD)
      const result = loader.loadSkill('test')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('test.com/jobs')
    })

    it('loads a markdown skill file with -jobs suffix', () => {
      writeFileSync(join(tempDir, 'test-jobs.md'), MINIMAL_MD)
      const result = loader.loadSkill('test')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('test.com/jobs')
    })

    it('loads a JSON skill file as fallback', () => {
      const json = {
        site: 'test.com/jobs',
        lastFullScan: '',
        lastVerified: '',
        actions: {},
        changeLog: []
      }
      writeFileSync(join(tempDir, 'test-jobs.json'), JSON.stringify(json))
      const result = loader.loadSkill('test')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('test.com/jobs')
    })

    it('prefers .md over .json when both exist', () => {
      writeFileSync(join(tempDir, 'test.md'), MINIMAL_MD)
      const json = {
        site: 'json-site.com',
        lastFullScan: '',
        lastVerified: '',
        actions: {},
        changeLog: []
      }
      writeFileSync(join(tempDir, 'test-jobs.json'), JSON.stringify(json))
      const result = loader.loadSkill('test')
      expect(result!.site).toBe('test.com/jobs')
    })

    it('caches loaded skills', () => {
      writeFileSync(join(tempDir, 'test.md'), MINIMAL_MD)
      const first = loader.loadSkill('test')
      const second = loader.loadSkill('test')
      expect(first).toBe(second)
    })

    it('searches multiple directories in priority order', () => {
      const dir2 = mkdtempSync(join(tmpdir(), 'skills-test2-'))
      try {
        const highPriorityMd = MINIMAL_MD.replace('test.com/jobs', 'high-priority.com')
        const lowPriorityMd = MINIMAL_MD.replace('test.com/jobs', 'low-priority.com')

        writeFileSync(join(tempDir, 'test.md'), highPriorityMd)
        writeFileSync(join(dir2, 'test.md'), lowPriorityMd)

        const multiLoader = new SkillsLoader([tempDir, dir2])
        const result = multiLoader.loadSkill('test')
        expect(result!.site).toBe('high-priority.com')
      } finally {
        rmSync(dir2, { recursive: true, force: true })
      }
    })
  })

  describe('reloadSkill', () => {
    it('clears cache and reloads from disk', () => {
      writeFileSync(join(tempDir, 'test.md'), MINIMAL_MD)
      const first = loader.loadSkill('test')
      expect(first!.site).toBe('test.com/jobs')

      const updated = MINIMAL_MD.replace('test.com/jobs', 'updated.com/jobs')
      writeFileSync(join(tempDir, 'test.md'), updated)

      const reloaded = loader.reloadSkill('test')
      expect(reloaded!.site).toBe('updated.com/jobs')
    })
  })

  describe('clearCache', () => {
    it('clears all cached entries', () => {
      writeFileSync(join(tempDir, 'test.md'), MINIMAL_MD)
      loader.loadSkill('test')
      loader.clearCache()

      // After clearing, a new load should re-read from disk
      const updated = MINIMAL_MD.replace('test.com/jobs', 'cleared.com/jobs')
      writeFileSync(join(tempDir, 'test.md'), updated)
      const result = loader.loadSkill('test')
      expect(result!.site).toBe('cleared.com/jobs')
    })
  })

  describe('parseMarkdownContent', () => {
    it('parses frontmatter correctly', () => {
      const result = loader.parseMarkdownContent(FULL_MD)
      expect(result).not.toBeNull()
      expect(result!.site).toBe('linkedin.com/jobs')
      expect(result!.lastFullScan).toBe('2025-01-01')
      expect(result!.lastVerified).toBe('2025-06-01')
    })

    it('returns null for missing frontmatter', () => {
      const result = loader.parseMarkdownContent('# No frontmatter\nJust text.')
      expect(result).toBeNull()
    })

    it('returns null for missing site field', () => {
      const content = `---
lastFullScan: ""
---

## action
`
      expect(loader.parseMarkdownContent(content)).toBeNull()
    })

    it('parses multiple actions with multiple steps', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      expect(Object.keys(result.actions)).toEqual([
        'search_jobs',
        'extract_job_cards',
        'check_authentication'
      ])

      // search_jobs has 2 steps
      expect(result.actions['search_jobs'].steps).toHaveLength(2)
      expect(result.actions['search_jobs'].steps[0].intent).toBe('navigate_to_search')
      expect(result.actions['search_jobs'].steps[1].intent).toBe('wait_for_results')

      // extract_job_cards has 1 step
      expect(result.actions['extract_job_cards'].steps).toHaveLength(1)
    })

    it('parses selectors as comma-separated list', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      const waitStep = result.actions['search_jobs'].steps[1]
      expect(waitStep.hint.selectors).toEqual([
        '.jobs-search-results-list',
        '.scaffold-layout__list'
      ])
    })

    it('parses (none) as empty array', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      const navStep = result.actions['search_jobs'].steps[0]
      expect(navStep.hint.selectors).toEqual([])
      expect(navStep.hint.textMatches).toEqual([])
      expect(navStep.hint.ariaLabels).toEqual([])
    })

    it('parses aria labels', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      const authStep = result.actions['check_authentication'].steps[0]
      expect(authStep.hint.ariaLabels).toEqual(['Profile', 'Me'])
    })

    it('parses confidence as number', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      expect(result.actions['search_jobs'].steps[0].confidence).toBe(0.95)
      expect(result.actions['search_jobs'].steps[1].confidence).toBe(0.85)
    })

    it('parses location and elementType', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      const navStep = result.actions['search_jobs'].steps[0]
      expect(navStep.hint.location).toBe('url')
      expect(navStep.hint.elementType).toBe('navigation')
    })

    it('parses fallback description', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      const navStep = result.actions['search_jobs'].steps[0]
      expect(navStep.fallbackDescription).toBe(
        'Navigate to LinkedIn job search URL with query parameters'
      )
    })

    it('defaults confidence to 0.8 when missing', () => {
      const content = `---
site: test.com
---

## action

### step
- **selectors**: (none)
- **location**: main
- **elementType**: div
- **fallback**: Test step
`
      const result = loader.parseMarkdownContent(content)!
      expect(result.actions['action'].steps[0].confidence).toBe(0.8)
    })

    it('defaults failureCount to 0', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      expect(result.actions['search_jobs'].steps[0].failureCount).toBe(0)
    })

    it('initializes changeLog as empty array', () => {
      const result = loader.parseMarkdownContent(FULL_MD)!
      expect(result.changeLog).toEqual([])
    })
  })

  describe('JSON fallback', () => {
    it('returns null for invalid JSON', () => {
      writeFileSync(join(tempDir, 'bad-jobs.json'), '{invalid json')
      expect(loader.loadSkill('bad')).toBeNull()
    })

    it('returns null for invalid markdown', () => {
      writeFileSync(join(tempDir, 'bad.md'), '---\ninvalid: [yaml: {{\n---\n')
      expect(loader.loadSkill('bad')).toBeNull()
    })
  })

  describe('real skill files', () => {
    it('parses the actual linkedin-jobs.md file', () => {
      const hintsDir = join(__dirname, '../../../../../hints')
      const realLoader = new SkillsLoader([hintsDir])
      const result = realLoader.loadSkill('linkedin')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('linkedin.com/jobs')
      expect(Object.keys(result!.actions).length).toBeGreaterThanOrEqual(9)

      // Verify key actions exist
      expect(result!.actions['search_jobs']).toBeDefined()
      expect(result!.actions['extract_job_cards']).toBeDefined()
      expect(result!.actions['extract_job_details']).toBeDefined()
      expect(result!.actions['check_authentication']).toBeDefined()
    })

    it('parses the actual indeed-jobs.md file', () => {
      const hintsDir = join(__dirname, '../../../../../hints')
      const realLoader = new SkillsLoader([hintsDir])
      const result = realLoader.loadSkill('indeed')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('indeed.com/jobs')
      expect(result!.actions['search_jobs']).toBeDefined()
    })

    it('parses the actual upwork-jobs.md file', () => {
      const hintsDir = join(__dirname, '../../../../../hints')
      const realLoader = new SkillsLoader([hintsDir])
      const result = realLoader.loadSkill('upwork')
      expect(result).not.toBeNull()
      expect(result!.site).toBe('upwork.com/jobs')
      expect(result!.actions['search_jobs']).toBeDefined()
    })

    it('still loads JSON files for backward compatibility', () => {
      const hintsDir = join(__dirname, '../../../../../hints')
      // Create a loader that only looks at JSON by giving it a dir with no .md files
      const jsonOnlyDir = mkdtempSync(join(tmpdir(), 'json-only-'))
      try {
        writeFileSync(
          join(jsonOnlyDir, 'test-jobs.json'),
          JSON.stringify({
            site: 'test.com',
            lastFullScan: '',
            lastVerified: '',
            actions: {
              search: {
                steps: [
                  {
                    intent: 'navigate',
                    hint: {
                      selectors: ['.foo'],
                      textMatches: [],
                      ariaLabels: [],
                      location: 'main',
                      elementType: 'a'
                    },
                    fallbackDescription: 'Navigate',
                    lastVerified: '',
                    confidence: 0.9,
                    failureCount: 0
                  }
                ]
              }
            },
            changeLog: []
          })
        )
        const jsonLoader = new SkillsLoader([jsonOnlyDir, hintsDir])
        const result = jsonLoader.loadSkill('test')
        expect(result).not.toBeNull()
        expect(result!.site).toBe('test.com')
        expect(result!.actions['search'].steps[0].hint.selectors).toEqual(['.foo'])
      } finally {
        rmSync(jsonOnlyDir, { recursive: true, force: true })
      }
    })
  })
})
