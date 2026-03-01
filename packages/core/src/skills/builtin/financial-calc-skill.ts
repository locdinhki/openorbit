// ============================================================================
// OpenOrbit — Financial Calculator Skill
//
// Skill wrapper for financial formulas library. Supports 9 real estate
// investment calculations: ROI, Cap Rate, Cash-on-Cash, DSCR, Mortgage Payment,
// Rental Yield, Break-Even, GRM, and NOI.
// ============================================================================

import type { Skill, SkillResult } from '../skill-types'
import {
  calculate,
  CALCULATION_TYPES,
  type CalculationType,
  type FormulaParams
} from './financial-formulas'

export function createFinancialCalcSkill(extensionId: string): Skill {
  return {
    id: 'financial-calculator',
    displayName: 'Financial Calculator',
    icon: 'calculator',
    description: `Calculate real estate investment metrics. Supported calculations: ${CALCULATION_TYPES.join(', ')}. Each formula requires specific parameters - use the params object to provide the required values.`,
    category: 'data',
    extensionId,
    capabilities: {
      aiTool: true,
      offlineCapable: true,
      streaming: false
    },
    inputSchema: {
      type: 'object',
      properties: {
        calculation: {
          type: 'string',
          description: `The calculation to perform. One of: ${CALCULATION_TYPES.join(', ')}`,
          enum: CALCULATION_TYPES
        },
        params: {
          type: 'object',
          description: `Parameters for the calculation. Required params vary by calculation type:
- roi: netProfit, totalInvestment
- cap-rate: noi, purchasePrice
- cash-on-cash: annualCashFlow, totalCashInvested
- dscr: noi, annualDebtService
- mortgage-payment: loanAmount, annualInterestRate, loanTermYears
- rental-yield: annualRent, purchasePrice
- break-even: operatingExpenses, debtService, grossOperatingIncome
- grm: purchasePrice, grossAnnualRent
- noi: grossOperatingIncome, operatingExpenses`,
          properties: {
            purchasePrice: { type: 'number', description: 'Property purchase price' },
            netProfit: { type: 'number', description: 'Net profit from investment' },
            totalInvestment: { type: 'number', description: 'Total amount invested' },
            noi: { type: 'number', description: 'Net Operating Income' },
            annualCashFlow: { type: 'number', description: 'Annual cash flow' },
            totalCashInvested: {
              type: 'number',
              description: 'Total cash invested (down payment + closing costs)'
            },
            annualDebtService: {
              type: 'number',
              description: 'Annual debt service (mortgage payments)'
            },
            loanAmount: { type: 'number', description: 'Loan principal amount' },
            annualInterestRate: {
              type: 'number',
              description: 'Annual interest rate as percentage (e.g., 6.5 for 6.5%)'
            },
            loanTermYears: { type: 'number', description: 'Loan term in years' },
            annualRent: { type: 'number', description: 'Annual rental income' },
            grossOperatingIncome: { type: 'number', description: 'Gross operating income' },
            operatingExpenses: { type: 'number', description: 'Total operating expenses' },
            debtService: { type: 'number', description: 'Debt service amount' },
            grossAnnualRent: { type: 'number', description: 'Gross annual rent' }
          }
        }
      },
      required: ['calculation', 'params']
    },
    outputSchema: {
      type: 'object',
      description: 'Calculation result with formatted output and breakdown',
      properties: {
        result: { type: 'number', description: 'The numeric result' },
        formatted: { type: 'string', description: 'Formatted result (percentage or currency)' },
        breakdown: { type: 'string', description: 'Step-by-step calculation breakdown' },
        calculation: { type: 'string', description: 'The calculation type that was performed' }
      }
    },

    validate(input: Record<string, unknown>) {
      const errors: string[] = []

      if (!input.calculation || typeof input.calculation !== 'string') {
        errors.push('Missing or invalid calculation type')
      } else if (!CALCULATION_TYPES.includes(input.calculation as CalculationType)) {
        errors.push(
          `Invalid calculation type: ${input.calculation}. Valid types: ${CALCULATION_TYPES.join(', ')}`
        )
      }

      if (!input.params || typeof input.params !== 'object') {
        errors.push('Missing or invalid params object')
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
    },

    async execute(input: Record<string, unknown>): Promise<SkillResult> {
      const calculation = input.calculation as CalculationType
      const params = input.params as FormulaParams

      if (!calculation || typeof calculation !== 'string') {
        return { success: false, error: 'Missing or invalid calculation type' }
      }

      if (!params || typeof params !== 'object') {
        return { success: false, error: 'Missing or invalid params object' }
      }

      try {
        const result = calculate(calculation, params)
        return {
          success: true,
          data: result,
          summary: result.breakdown
        }
      } catch (err) {
        return {
          success: false,
          error: `Calculation failed: ${err instanceof Error ? err.message : String(err)}`
        }
      }
    }
  }
}
