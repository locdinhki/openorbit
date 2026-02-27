import { describe, it, expect, vi } from 'vitest'
import { SkillRegistry } from '../skill-registry'
import type { Skill } from '../skill-types'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: 'test-skill',
    displayName: 'Test Skill',
    description: 'A test skill',
    category: 'data',
    extensionId: 'shell',
    capabilities: { aiTool: true, offlineCapable: true },
    inputSchema: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'Test input' }
      },
      required: ['input']
    },
    outputSchema: {
      type: 'object',
      properties: {
        output: { type: 'string', description: 'Test output' }
      }
    },
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: { output: 'result' },
      summary: 'Test completed'
    }),
    ...overrides
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillRegistry', () => {
  describe('register', () => {
    it('registers a skill', () => {
      const registry = new SkillRegistry()
      const skill = createMockSkill()

      registry.register(skill)

      expect(registry.get('test-skill')).toBe(skill)
    })

    it('replaces an existing skill with the same ID', () => {
      const registry = new SkillRegistry()
      const skill1 = createMockSkill({ displayName: 'First' })
      const skill2 = createMockSkill({ displayName: 'Second' })

      registry.register(skill1)
      registry.register(skill2)

      expect(registry.get('test-skill')?.displayName).toBe('Second')
    })
  })

  describe('unregister', () => {
    it('removes a skill', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill())

      registry.unregister('test-skill')

      expect(registry.get('test-skill')).toBeUndefined()
    })
  })

  describe('list', () => {
    it('returns all skills', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill({ id: 'a', category: 'data' }))
      registry.register(createMockSkill({ id: 'b', category: 'media' }))

      expect(registry.list()).toHaveLength(2)
    })

    it('filters by category', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill({ id: 'a', category: 'data' }))
      registry.register(createMockSkill({ id: 'b', category: 'media' }))

      expect(registry.list('data')).toHaveLength(1)
      expect(registry.list('data')[0].id).toBe('a')
    })
  })

  describe('listInfo', () => {
    it('returns renderer-safe info without execute function', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill())

      const infos = registry.listInfo()

      expect(infos).toHaveLength(1)
      expect(infos[0]).toEqual({
        id: 'test-skill',
        displayName: 'Test Skill',
        description: 'A test skill',
        category: 'data',
        extensionId: 'shell',
        capabilities: { aiTool: true, offlineCapable: true },
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object)
      })
      // Must not have execute function
      expect(infos[0]).not.toHaveProperty('execute')
    })
  })

  describe('execute', () => {
    it('executes a skill and returns result', async () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill())

      const result = await registry.execute('test-skill', { input: 'hello' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ output: 'result' })
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('returns error for unknown skill', async () => {
      const registry = new SkillRegistry()

      const result = await registry.execute('nonexistent', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('catches execution errors', async () => {
      const registry = new SkillRegistry()
      registry.register(
        createMockSkill({
          execute: vi.fn().mockRejectedValue(new Error('boom'))
        })
      )

      const result = await registry.execute('test-skill', {})

      expect(result.success).toBe(false)
      expect(result.error).toBe('boom')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    })

    it('runs validation if skill has validate()', async () => {
      const registry = new SkillRegistry()
      registry.register(
        createMockSkill({
          validate: () => ({ valid: false, errors: ['bad input'] })
        })
      )

      const result = await registry.execute('test-skill', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('bad input')
    })
  })

  describe('toAITools', () => {
    it('converts skills to AIToolDefinition[]', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill({ id: 'calc-expression' }))

      const tools = registry.toAITools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('skill_calc_expression')
      expect(tools[0].description).toBe('A test skill')
      expect(tools[0].inputSchema.type).toBe('object')
    })

    it('filters out skills with aiTool: false', () => {
      const registry = new SkillRegistry()
      registry.register(createMockSkill({ id: 'a', capabilities: { aiTool: true } }))
      registry.register(createMockSkill({ id: 'b', capabilities: { aiTool: false } }))

      const tools = registry.toAITools()

      expect(tools).toHaveLength(1)
      expect(tools[0].name).toBe('skill_a')
    })
  })

  describe('toService', () => {
    it('creates a facade that delegates to registry', async () => {
      const registry = new SkillRegistry()
      const skill = createMockSkill()
      registry.register(skill)

      const service = registry.toService()

      expect(service.listSkills()).toHaveLength(1)
      expect(service.getSkill('test-skill')).toBe(skill)
      expect(service.toAITools()).toHaveLength(1)

      const result = await service.execute('test-skill', { input: 'x' })
      expect(result.success).toBe(true)
    })
  })
})
