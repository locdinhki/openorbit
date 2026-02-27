import { describe, it, expect, vi } from 'vitest'
import {
  isSkillToolCall,
  toolNameToSkillId,
  executeSkillTool,
  getCombinedTools
} from '../skill-tool-dispatcher'
import type { SkillService } from '../skill-types'
import type { AIToolDefinition } from '../../ai/provider-types'

describe('skill-tool-dispatcher', () => {
  describe('isSkillToolCall', () => {
    it('returns true for skill_ prefixed names', () => {
      expect(isSkillToolCall('skill_calc_expression')).toBe(true)
      expect(isSkillToolCall('skill_voice_transcribe')).toBe(true)
    })

    it('returns false for non-skill tool names', () => {
      expect(isSkillToolCall('list_contacts')).toBe(false)
      expect(isSkillToolCall('get_contact')).toBe(false)
      expect(isSkillToolCall('')).toBe(false)
    })
  })

  describe('toolNameToSkillId', () => {
    it('converts skill_ prefix and underscores to kebab-case', () => {
      expect(toolNameToSkillId('skill_calc_expression')).toBe('calc-expression')
      expect(toolNameToSkillId('skill_voice_transcribe')).toBe('voice-transcribe')
      expect(toolNameToSkillId('skill_data_format')).toBe('data-format')
    })
  })

  describe('executeSkillTool', () => {
    it('returns content on success', async () => {
      const mockService: SkillService = {
        registerSkill: vi.fn(),
        unregisterSkill: vi.fn(),
        getSkill: vi.fn(),
        listSkills: vi.fn(),
        execute: vi.fn().mockResolvedValue({
          success: true,
          data: { result: 42 },
          summary: '2+3 = 42'
        }),
        toAITools: vi.fn()
      }

      const result = await executeSkillTool(
        { id: 'call-1', name: 'skill_calc_expression', input: { expression: '2+3' } },
        mockService
      )

      expect(result.toolCallId).toBe('call-1')
      expect(result.content).toBe('2+3 = 42')
      expect(result.isError).toBeUndefined()
    })

    it('returns error content on failure', async () => {
      const mockService: SkillService = {
        registerSkill: vi.fn(),
        unregisterSkill: vi.fn(),
        getSkill: vi.fn(),
        listSkills: vi.fn(),
        execute: vi.fn().mockResolvedValue({
          success: false,
          error: 'Skill not found'
        }),
        toAITools: vi.fn()
      }

      const result = await executeSkillTool(
        { id: 'call-2', name: 'skill_missing', input: {} },
        mockService
      )

      expect(result.toolCallId).toBe('call-2')
      expect(result.content).toContain('Error')
      expect(result.isError).toBe(true)
    })

    it('catches thrown errors', async () => {
      const mockService: SkillService = {
        registerSkill: vi.fn(),
        unregisterSkill: vi.fn(),
        getSkill: vi.fn(),
        listSkills: vi.fn(),
        execute: vi.fn().mockRejectedValue(new Error('unexpected')),
        toAITools: vi.fn()
      }

      const result = await executeSkillTool(
        { id: 'call-3', name: 'skill_broken', input: {} },
        mockService
      )

      expect(result.isError).toBe(true)
      expect(result.content).toContain('unexpected')
    })
  })

  describe('getCombinedTools', () => {
    it('merges extension tools with skill tools', () => {
      const extTools: AIToolDefinition[] = [
        { name: 'list_contacts', description: 'List CRM contacts', inputSchema: { type: 'object' } }
      ]
      const mockService: SkillService = {
        registerSkill: vi.fn(),
        unregisterSkill: vi.fn(),
        getSkill: vi.fn(),
        listSkills: vi.fn(),
        execute: vi.fn(),
        toAITools: vi.fn().mockReturnValue([
          {
            name: 'skill_calc_expression',
            description: 'Calculate',
            inputSchema: { type: 'object' }
          }
        ])
      }

      const combined = getCombinedTools(extTools, mockService)

      expect(combined).toHaveLength(2)
      expect(combined[0].name).toBe('list_contacts')
      expect(combined[1].name).toBe('skill_calc_expression')
    })
  })
})
