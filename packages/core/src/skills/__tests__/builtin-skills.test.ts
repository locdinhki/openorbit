import { describe, it, expect, vi } from 'vitest'
import { createCalcSkill, safeMathEval } from '../builtin/calc-skill'
import { createFormatSkill, csvToJson, jsonToCsv } from '../builtin/format-skill'
import { createVoiceTranscribeSkill } from '../builtin/voice-transcribe-skill'
import { createFinancialCalcSkill } from '../builtin/financial-calc-skill'
import {
  calculate,
  calculateROI,
  calculateCapRate,
  calculateCashOnCash,
  calculateDSCR,
  calculateMortgagePayment,
  calculateRentalYield,
  calculateBreakEven,
  calculateGRM,
  calculateNOI,
  CALCULATION_TYPES
} from '../builtin/financial-formulas'

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

// ---------------------------------------------------------------------------
// Financial Calculator
// ---------------------------------------------------------------------------

describe('Financial Formulas', () => {
  describe('calculateROI', () => {
    it('calculates ROI correctly', () => {
      const result = calculateROI({ netProfit: 50000, totalInvestment: 200000 })
      expect(result.result).toBe(0.25) // 25%
      expect(result.calculation).toBe('roi')
    })

    it('handles negative returns', () => {
      const result = calculateROI({ netProfit: -10000, totalInvestment: 100000 })
      expect(result.result).toBe(-0.1) // -10%
    })

    it('throws on missing params', () => {
      expect(() => calculateROI({ netProfit: 50000 })).toThrow('Missing required parameter')
    })

    it('throws on division by zero', () => {
      expect(() => calculateROI({ netProfit: 50000, totalInvestment: 0 })).toThrow(
        'Division by zero'
      )
    })
  })

  describe('calculateCapRate', () => {
    it('calculates cap rate correctly', () => {
      const result = calculateCapRate({ noi: 30000, purchasePrice: 400000 })
      expect(result.result).toBe(0.075) // 7.5%
      expect(result.calculation).toBe('cap-rate')
    })
  })

  describe('calculateCashOnCash', () => {
    it('calculates cash-on-cash return', () => {
      const result = calculateCashOnCash({ annualCashFlow: 8000, totalCashInvested: 80000 })
      expect(result.result).toBe(0.1) // 10%
      expect(result.calculation).toBe('cash-on-cash')
    })
  })

  describe('calculateDSCR', () => {
    it('calculates DSCR correctly', () => {
      const result = calculateDSCR({ noi: 50000, annualDebtService: 40000 })
      expect(result.result).toBe(1.25)
      expect(result.calculation).toBe('dscr')
    })
  })

  describe('calculateMortgagePayment', () => {
    it('calculates monthly mortgage payment', () => {
      const result = calculateMortgagePayment({
        loanAmount: 320000,
        annualInterestRate: 7,
        loanTermYears: 30
      })
      // 30-year fixed at 7% on $320k should be approximately $2,129/month
      expect(result.result).toBeCloseTo(2129, -1)
      expect(result.calculation).toBe('mortgage-payment')
    })

    it('handles 0% interest rate', () => {
      const result = calculateMortgagePayment({
        loanAmount: 120000,
        annualInterestRate: 0,
        loanTermYears: 10
      })
      // $120k / 120 months = $1000/month
      expect(result.result).toBe(1000)
    })
  })

  describe('calculateRentalYield', () => {
    it('calculates rental yield', () => {
      const result = calculateRentalYield({ annualRent: 24000, purchasePrice: 300000 })
      expect(result.result).toBe(0.08) // 8%
      expect(result.calculation).toBe('rental-yield')
    })
  })

  describe('calculateBreakEven', () => {
    it('calculates break-even ratio', () => {
      const result = calculateBreakEven({
        operatingExpenses: 12000,
        debtService: 18000,
        grossOperatingIncome: 40000
      })
      expect(result.result).toBe(0.75) // 75%
      expect(result.calculation).toBe('break-even')
    })
  })

  describe('calculateGRM', () => {
    it('calculates gross rent multiplier', () => {
      const result = calculateGRM({ purchasePrice: 400000, grossAnnualRent: 32000 })
      expect(result.result).toBe(12.5)
      expect(result.calculation).toBe('grm')
    })
  })

  describe('calculateNOI', () => {
    it('calculates net operating income', () => {
      const result = calculateNOI({ grossOperatingIncome: 50000, operatingExpenses: 15000 })
      expect(result.result).toBe(35000)
      expect(result.calculation).toBe('noi')
    })
  })

  describe('calculate dispatcher', () => {
    it('dispatches to correct formula', () => {
      const result = calculate('cap-rate', { noi: 30000, purchasePrice: 500000 })
      expect(result.result).toBe(0.06)
    })

    it('throws on unknown calculation type', () => {
      expect(() => calculate('unknown' as 'roi', {})).toThrow('Unknown calculation type')
    })

    it('lists all 9 calculation types', () => {
      expect(CALCULATION_TYPES).toHaveLength(9)
      expect(CALCULATION_TYPES).toContain('roi')
      expect(CALCULATION_TYPES).toContain('cap-rate')
      expect(CALCULATION_TYPES).toContain('cash-on-cash')
      expect(CALCULATION_TYPES).toContain('dscr')
      expect(CALCULATION_TYPES).toContain('mortgage-payment')
      expect(CALCULATION_TYPES).toContain('rental-yield')
      expect(CALCULATION_TYPES).toContain('break-even')
      expect(CALCULATION_TYPES).toContain('grm')
      expect(CALCULATION_TYPES).toContain('noi')
    })
  })
})

describe('Financial Calculator Skill', () => {
  const skill = createFinancialCalcSkill('shell')

  it('has correct metadata', () => {
    expect(skill.id).toBe('financial-calculator')
    expect(skill.category).toBe('data')
    expect(skill.capabilities.aiTool).toBe(true)
    expect(skill.capabilities.offlineCapable).toBe(true)
  })

  it('executes cap rate calculation', async () => {
    const result = await skill.execute({
      calculation: 'cap-rate',
      params: { noi: 30000, purchasePrice: 400000 }
    })

    expect(result.success).toBe(true)
    expect((result.data as { result: number }).result).toBe(0.075)
    expect(result.summary).toContain('Cap Rate')
  })

  it('executes mortgage payment calculation', async () => {
    const result = await skill.execute({
      calculation: 'mortgage-payment',
      params: { loanAmount: 240000, annualInterestRate: 6, loanTermYears: 30 }
    })

    expect(result.success).toBe(true)
    expect((result.data as { result: number }).result).toBeGreaterThan(1400)
    expect((result.data as { result: number }).result).toBeLessThan(1500)
  })

  it('returns error for invalid calculation type', async () => {
    const result = await skill.execute({
      calculation: 'invalid',
      params: { foo: 123 }
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown calculation type')
  })

  it('returns error for missing params', async () => {
    const result = await skill.execute({
      calculation: 'roi',
      params: {}
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing required parameter')
  })

  it('validates input with validate method', () => {
    const valid = skill.validate?.({ calculation: 'roi', params: {} })
    expect(valid?.valid).toBe(true)

    const invalid = skill.validate?.({ calculation: 123, params: {} })
    expect(invalid?.valid).toBe(false)
  })
})
