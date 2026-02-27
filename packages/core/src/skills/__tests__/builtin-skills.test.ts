import { describe, it, expect, vi } from 'vitest'
import { createCalcSkill, safeMathEval } from '../builtin/calc-skill'
import { createFormatSkill, csvToJson, jsonToCsv } from '../builtin/format-skill'
import { createVoiceTranscribeSkill } from '../builtin/voice-transcribe-skill'

// ---------------------------------------------------------------------------
// Calculator
// ---------------------------------------------------------------------------

describe('Calculator Skill', () => {
  const skill = createCalcSkill('shell')

  describe('safeMathEval', () => {
    it('evaluates basic arithmetic', () => {
      expect(safeMathEval('2 + 3')).toBe(5)
      expect(safeMathEval('10 - 4')).toBe(6)
      expect(safeMathEval('3 * 7')).toBe(21)
      expect(safeMathEval('20 / 4')).toBe(5)
    })

    it('respects operator precedence', () => {
      expect(safeMathEval('2 + 3 * 4')).toBe(14)
      expect(safeMathEval('(2 + 3) * 4')).toBe(20)
    })

    it('evaluates exponents', () => {
      expect(safeMathEval('2 ^ 10')).toBe(1024)
    })

    it('evaluates modulo', () => {
      expect(safeMathEval('10 % 3')).toBe(1)
    })

    it('evaluates math functions', () => {
      expect(safeMathEval('sqrt(16)')).toBe(4)
      expect(safeMathEval('abs(-5)')).toBe(5)
      expect(safeMathEval('ceil(2.3)')).toBe(3)
      expect(safeMathEval('floor(2.7)')).toBe(2)
      expect(safeMathEval('round(2.5)')).toBe(3)
    })

    it('evaluates pi constant', () => {
      expect(safeMathEval('pi')).toBeCloseTo(Math.PI)
    })

    it('rejects invalid characters', () => {
      expect(() => safeMathEval('require("fs")')).toThrow('Invalid characters')
      expect(() => safeMathEval('process.exit(1)')).toThrow('Invalid characters')
      expect(() => safeMathEval('2 + ; 3')).toThrow('Invalid characters')
    })

    it('rejects empty expressions', () => {
      expect(() => safeMathEval('')).toThrow('Empty expression')
      expect(() => safeMathEval('   ')).toThrow('Empty expression')
    })

    it('handles division by zero', () => {
      expect(() => safeMathEval('1 / 0')).toThrow('not a finite number')
    })
  })

  describe('execute', () => {
    it('returns success with result', async () => {
      const result = await skill.execute({ expression: '2 + 3 * 4' })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ result: 14, expression: '2 + 3 * 4' })
      expect(result.summary).toBe('2 + 3 * 4 = 14')
    })

    it('returns error for invalid expression', async () => {
      const result = await skill.execute({ expression: 'alert(1)' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Invalid characters')
    })

    it('returns error for missing expression', async () => {
      const result = await skill.execute({})

      expect(result.success).toBe(false)
      expect(result.error).toContain('Missing or invalid expression')
    })
  })
})

// ---------------------------------------------------------------------------
// Data Formatter
// ---------------------------------------------------------------------------

describe('Data Formatter Skill', () => {
  const skill = createFormatSkill('shell')

  describe('csvToJson', () => {
    it('parses simple CSV', () => {
      const csv = 'name,age\nAlice,30\nBob,25'
      const result = csvToJson(csv)

      expect(result).toEqual([
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' }
      ])
    })

    it('handles quoted fields with commas', () => {
      const csv = 'name,address\n"Smith, John","123 Main St"'
      const result = csvToJson(csv)

      expect(result[0].name).toBe('Smith, John')
    })

    it('handles escaped quotes', () => {
      const csv = 'name,quote\nAlice,"She said ""hello"""'
      const result = csvToJson(csv)

      expect(result[0].quote).toBe('She said "hello"')
    })

    it('returns empty array for header-only CSV', () => {
      expect(csvToJson('name,age')).toEqual([])
    })
  })

  describe('jsonToCsv', () => {
    it('converts array of objects to CSV', () => {
      const rows = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 }
      ]
      const csv = jsonToCsv(rows)
      const lines = csv.split('\n')

      expect(lines[0]).toBe('name,age')
      expect(lines[1]).toBe('Alice,30')
      expect(lines[2]).toBe('Bob,25')
    })

    it('escapes fields with commas', () => {
      const rows = [{ name: 'Smith, John', city: 'NYC' }]
      const csv = jsonToCsv(rows)

      expect(csv).toContain('"Smith, John"')
    })

    it('returns empty string for empty array', () => {
      expect(jsonToCsv([])).toBe('')
    })
  })

  describe('execute', () => {
    it('converts JSON to CSV', async () => {
      const result = await skill.execute({
        data: '[{"name":"Alice","age":30}]',
        from: 'json',
        to: 'csv'
      })

      expect(result.success).toBe(true)
      expect((result.data as { formatted: string }).formatted).toContain('name,age')
      expect((result.data as { rowCount: number }).rowCount).toBe(1)
    })

    it('converts CSV to JSON', async () => {
      const result = await skill.execute({
        data: 'name,age\nAlice,30',
        from: 'csv',
        to: 'json'
      })

      expect(result.success).toBe(true)
      const parsed = JSON.parse((result.data as { formatted: string }).formatted)
      expect(parsed[0].name).toBe('Alice')
    })

    it('pretty-prints JSON', async () => {
      const result = await skill.execute({
        data: '[{"a":1}]',
        from: 'json',
        to: 'pretty-json'
      })

      expect(result.success).toBe(true)
      expect((result.data as { formatted: string }).formatted).toContain('  ')
    })

    it('returns error for invalid format', async () => {
      const result = await skill.execute({
        data: 'hello',
        from: 'xml' as 'json',
        to: 'json'
      })

      expect(result.success).toBe(false)
    })

    it('returns error for invalid JSON', async () => {
      const result = await skill.execute({
        data: 'not json',
        from: 'json',
        to: 'csv'
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Format conversion failed')
    })
  })
})

// ---------------------------------------------------------------------------
// Voice Transcribe
// ---------------------------------------------------------------------------

vi.mock('../../audio/voice-transcriber', () => ({
  VoiceTranscriber: class MockVoiceTranscriber {
    transcribe = vi.fn().mockResolvedValue({
      transcript: 'Hello world',
      durationSeconds: 3.5,
      model: 'tiny'
    })
  }
}))

describe('Voice Transcribe Skill', () => {
  const skill = createVoiceTranscribeSkill('shell')

  it('has correct metadata', () => {
    expect(skill.id).toBe('voice-transcribe')
    expect(skill.category).toBe('media')
    expect(skill.capabilities.aiTool).toBe(true)
  })

  it('delegates to VoiceTranscriber', async () => {
    const result = await skill.execute({ audioPath: '/tmp/test.wav' })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      transcript: 'Hello world',
      durationSeconds: 3.5,
      model: 'tiny'
    })
    expect(result.summary).toContain('Hello world')
  })

  it('returns error for missing audioPath', async () => {
    const result = await skill.execute({})

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing or invalid audioPath')
  })
})
