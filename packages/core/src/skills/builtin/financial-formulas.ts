// ============================================================================
// OpenOrbit — Financial Formulas Library
//
// Pure calculation functions for real estate investment analysis.
// All formulas validate required parameters and handle edge cases.
// ============================================================================

export type CalculationType =
  | 'roi'
  | 'cap-rate'
  | 'cash-on-cash'
  | 'dscr'
  | 'mortgage-payment'
  | 'rental-yield'
  | 'break-even'
  | 'grm'
  | 'noi'

export interface CalculationResult {
  result: number
  formatted: string
  breakdown: string
  calculation: CalculationType
}

export interface FormulaParams {
  // Common
  purchasePrice?: number
  // ROI
  netProfit?: number
  totalInvestment?: number
  // Cap Rate / NOI
  noi?: number
  // Cash-on-Cash
  annualCashFlow?: number
  totalCashInvested?: number
  // DSCR
  annualDebtService?: number
  // Mortgage Payment
  loanAmount?: number
  annualInterestRate?: number
  loanTermYears?: number
  // Rental Yield
  annualRent?: number
  // Break-Even
  grossOperatingIncome?: number
  operatingExpenses?: number
  debtService?: number
  // GRM
  grossAnnualRent?: number
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function requireParams(params: FormulaParams, required: (keyof FormulaParams)[]): void {
  for (const key of required) {
    if (params[key] === undefined || params[key] === null) {
      throw new Error(`Missing required parameter: ${key}`)
    }
    if (typeof params[key] !== 'number' || !isFinite(params[key] as number)) {
      throw new Error(`Parameter ${key} must be a finite number`)
    }
  }
}

function safeDivide(numerator: number, denominator: number, context: string): number {
  if (denominator === 0) {
    throw new Error(`Division by zero in ${context}`)
  }
  return numerator / denominator
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// Formula implementations
// ---------------------------------------------------------------------------

/**
 * Return on Investment (ROI)
 * Formula: ROI = Net Profit / Total Investment
 */
export function calculateROI(params: FormulaParams): CalculationResult {
  requireParams(params, ['netProfit', 'totalInvestment'])
  const { netProfit, totalInvestment } = params as Required<
    Pick<FormulaParams, 'netProfit' | 'totalInvestment'>
  >

  const result = safeDivide(netProfit, totalInvestment, 'ROI calculation')

  return {
    result,
    formatted: formatPercent(result),
    breakdown: `ROI = ${formatCurrency(netProfit)} / ${formatCurrency(totalInvestment)} = ${formatPercent(result)}`,
    calculation: 'roi'
  }
}

/**
 * Capitalization Rate (Cap Rate)
 * Formula: Cap Rate = NOI / Purchase Price
 */
export function calculateCapRate(params: FormulaParams): CalculationResult {
  requireParams(params, ['noi', 'purchasePrice'])
  const { noi, purchasePrice } = params as Required<Pick<FormulaParams, 'noi' | 'purchasePrice'>>

  const result = safeDivide(noi, purchasePrice, 'Cap Rate calculation')

  return {
    result,
    formatted: formatPercent(result),
    breakdown: `Cap Rate = ${formatCurrency(noi)} NOI / ${formatCurrency(purchasePrice)} = ${formatPercent(result)}`,
    calculation: 'cap-rate'
  }
}

/**
 * Cash-on-Cash Return
 * Formula: CoC = Annual Cash Flow / Total Cash Invested
 */
export function calculateCashOnCash(params: FormulaParams): CalculationResult {
  requireParams(params, ['annualCashFlow', 'totalCashInvested'])
  const { annualCashFlow, totalCashInvested } = params as Required<
    Pick<FormulaParams, 'annualCashFlow' | 'totalCashInvested'>
  >

  const result = safeDivide(annualCashFlow, totalCashInvested, 'Cash-on-Cash calculation')

  return {
    result,
    formatted: formatPercent(result),
    breakdown: `Cash-on-Cash = ${formatCurrency(annualCashFlow)} / ${formatCurrency(totalCashInvested)} = ${formatPercent(result)}`,
    calculation: 'cash-on-cash'
  }
}

/**
 * Debt Service Coverage Ratio (DSCR)
 * Formula: DSCR = NOI / Annual Debt Service
 */
export function calculateDSCR(params: FormulaParams): CalculationResult {
  requireParams(params, ['noi', 'annualDebtService'])
  const { noi, annualDebtService } = params as Required<
    Pick<FormulaParams, 'noi' | 'annualDebtService'>
  >

  const result = safeDivide(noi, annualDebtService, 'DSCR calculation')

  return {
    result,
    formatted: result.toFixed(2),
    breakdown: `DSCR = ${formatCurrency(noi)} NOI / ${formatCurrency(annualDebtService)} Debt = ${result.toFixed(2)}x`,
    calculation: 'dscr'
  }
}

/**
 * Monthly Mortgage Payment (PMT)
 * Formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
 * Where: P = loan amount, r = monthly interest rate, n = number of payments
 */
export function calculateMortgagePayment(params: FormulaParams): CalculationResult {
  requireParams(params, ['loanAmount', 'annualInterestRate', 'loanTermYears'])
  const { loanAmount, annualInterestRate, loanTermYears } = params as Required<
    Pick<FormulaParams, 'loanAmount' | 'annualInterestRate' | 'loanTermYears'>
  >

  if (loanTermYears <= 0) {
    throw new Error('Loan term must be positive')
  }

  // Handle 0% interest rate edge case
  if (annualInterestRate === 0) {
    const totalPayments = loanTermYears * 12
    const result = loanAmount / totalPayments
    return {
      result,
      formatted: formatCurrency(result),
      breakdown: `Monthly Payment = ${formatCurrency(loanAmount)} / ${totalPayments} months = ${formatCurrency(result)}/mo`,
      calculation: 'mortgage-payment'
    }
  }

  const monthlyRate = annualInterestRate / 100 / 12
  const totalPayments = loanTermYears * 12

  const factor = Math.pow(1 + monthlyRate, totalPayments)
  const result = loanAmount * ((monthlyRate * factor) / (factor - 1))

  return {
    result,
    formatted: formatCurrency(result),
    breakdown: `Monthly Payment = ${formatCurrency(loanAmount)} @ ${annualInterestRate}% for ${loanTermYears}yr = ${formatCurrency(result)}/mo`,
    calculation: 'mortgage-payment'
  }
}

/**
 * Gross Rental Yield
 * Formula: Rental Yield = (Annual Rent / Purchase Price) * 100
 */
export function calculateRentalYield(params: FormulaParams): CalculationResult {
  requireParams(params, ['annualRent', 'purchasePrice'])
  const { annualRent, purchasePrice } = params as Required<
    Pick<FormulaParams, 'annualRent' | 'purchasePrice'>
  >

  const result = safeDivide(annualRent, purchasePrice, 'Rental Yield calculation')

  return {
    result,
    formatted: formatPercent(result),
    breakdown: `Rental Yield = ${formatCurrency(annualRent)} / ${formatCurrency(purchasePrice)} = ${formatPercent(result)}`,
    calculation: 'rental-yield'
  }
}

/**
 * Break-Even Ratio
 * Formula: BER = (Operating Expenses + Debt Service) / Gross Operating Income
 */
export function calculateBreakEven(params: FormulaParams): CalculationResult {
  requireParams(params, ['operatingExpenses', 'debtService', 'grossOperatingIncome'])
  const { operatingExpenses, debtService, grossOperatingIncome } = params as Required<
    Pick<FormulaParams, 'operatingExpenses' | 'debtService' | 'grossOperatingIncome'>
  >

  const totalExpenses = operatingExpenses + debtService
  const result = safeDivide(totalExpenses, grossOperatingIncome, 'Break-Even calculation')

  return {
    result,
    formatted: formatPercent(result),
    breakdown: `Break-Even = (${formatCurrency(operatingExpenses)} + ${formatCurrency(debtService)}) / ${formatCurrency(grossOperatingIncome)} = ${formatPercent(result)}`,
    calculation: 'break-even'
  }
}

/**
 * Gross Rent Multiplier (GRM)
 * Formula: GRM = Purchase Price / Gross Annual Rent
 */
export function calculateGRM(params: FormulaParams): CalculationResult {
  requireParams(params, ['purchasePrice', 'grossAnnualRent'])
  const { purchasePrice, grossAnnualRent } = params as Required<
    Pick<FormulaParams, 'purchasePrice' | 'grossAnnualRent'>
  >

  const result = safeDivide(purchasePrice, grossAnnualRent, 'GRM calculation')

  return {
    result,
    formatted: result.toFixed(2),
    breakdown: `GRM = ${formatCurrency(purchasePrice)} / ${formatCurrency(grossAnnualRent)} = ${result.toFixed(2)}`,
    calculation: 'grm'
  }
}

/**
 * Net Operating Income (NOI)
 * Formula: NOI = Gross Operating Income - Operating Expenses
 */
export function calculateNOI(params: FormulaParams): CalculationResult {
  requireParams(params, ['grossOperatingIncome', 'operatingExpenses'])
  const { grossOperatingIncome, operatingExpenses } = params as Required<
    Pick<FormulaParams, 'grossOperatingIncome' | 'operatingExpenses'>
  >

  const result = grossOperatingIncome - operatingExpenses

  return {
    result,
    formatted: formatCurrency(result),
    breakdown: `NOI = ${formatCurrency(grossOperatingIncome)} - ${formatCurrency(operatingExpenses)} = ${formatCurrency(result)}`,
    calculation: 'noi'
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

const FORMULA_MAP: Record<CalculationType, (params: FormulaParams) => CalculationResult> = {
  roi: calculateROI,
  'cap-rate': calculateCapRate,
  'cash-on-cash': calculateCashOnCash,
  dscr: calculateDSCR,
  'mortgage-payment': calculateMortgagePayment,
  'rental-yield': calculateRentalYield,
  'break-even': calculateBreakEven,
  grm: calculateGRM,
  noi: calculateNOI
}

export const CALCULATION_TYPES = Object.keys(FORMULA_MAP) as CalculationType[]

export function calculate(calculation: CalculationType, params: FormulaParams): CalculationResult {
  const formula = FORMULA_MAP[calculation]
  if (!formula) {
    throw new Error(
      `Unknown calculation type: ${calculation}. Valid types: ${CALCULATION_TYPES.join(', ')}`
    )
  }
  return formula(params)
}
