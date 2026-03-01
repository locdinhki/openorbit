// ============================================================================
// ext-deal-analyzer — Deal Analyzer Engine
//
// Financial metrics calculator for real estate deal analysis
// ============================================================================

import type { DealRow } from '../db/deals-repo'
import {
  calculate,
  type CalculationResult
} from '@openorbit/core/skills/builtin/financial-formulas'

export interface DealMetrics {
  // Investment Summary
  totalInvestment: number
  loanAmount: number
  downPayment: number
  monthlyMortgage: number
  annualDebtService: number

  // Income
  monthlyRent: number
  annualRent: number
  effectiveGrossIncome: number // After vacancy

  // Expenses
  annualPropertyTax: number
  annualInsurance: number
  annualHoa: number
  annualMaintenance: number
  annualManagement: number
  annualVacancyLoss: number
  totalAnnualExpenses: number

  // Profitability
  noi: number
  annualCashFlow: number
  monthlyCashFlow: number

  // Key Ratios
  capRate: number
  cashOnCash: number
  dscr: number
  grm: number
  rentalYield: number
  breakEvenRatio: number

  // Flip Analysis (if ARV provided)
  equityGain: number | null
  roi: number | null

  // Formatted breakdown strings
  breakdowns: {
    mortgage: string
    noi: string
    capRate: string
    cashOnCash: string
    dscr: string
  }
}

export function analyzeDeal(deal: DealRow, additionalExpenses = 0): DealMetrics {
  const {
    purchasePrice,
    afterRepairValue,
    estimatedRent,
    repairCosts,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    closingCosts,
    propertyTaxRate,
    insuranceAnnual,
    hoaMonthly,
    vacancyRate,
    managementRate,
    maintenanceRate
  } = deal

  // Investment calculations
  const downPayment = purchasePrice * (downPaymentPercent / 100)
  const loanAmount = purchasePrice - downPayment
  const totalInvestment = downPayment + closingCosts + repairCosts + additionalExpenses

  // Mortgage payment
  let mortgageResult: CalculationResult
  try {
    mortgageResult = calculate('mortgage-payment', {
      loanAmount,
      annualInterestRate: interestRate,
      loanTermYears
    })
  } catch {
    mortgageResult = {
      result: 0,
      formatted: '$0.00',
      breakdown: 'Unable to calculate mortgage',
      calculation: 'mortgage-payment'
    }
  }
  const monthlyMortgage = mortgageResult.result
  const annualDebtService = monthlyMortgage * 12

  // Rental income
  const monthlyRent = estimatedRent ?? 0
  const annualRent = monthlyRent * 12
  const annualVacancyLoss = annualRent * (vacancyRate / 100)
  const effectiveGrossIncome = annualRent - annualVacancyLoss

  // Operating expenses
  const annualPropertyTax = purchasePrice * (propertyTaxRate / 100)
  const annualHoa = hoaMonthly * 12
  const annualMaintenance = effectiveGrossIncome * (maintenanceRate / 100)
  const annualManagement = effectiveGrossIncome * (managementRate / 100)
  const totalAnnualExpenses =
    annualPropertyTax + insuranceAnnual + annualHoa + annualMaintenance + annualManagement

  // NOI
  let noiResult: CalculationResult
  try {
    noiResult = calculate('noi', {
      grossOperatingIncome: effectiveGrossIncome,
      operatingExpenses: totalAnnualExpenses
    })
  } catch {
    noiResult = {
      result: effectiveGrossIncome - totalAnnualExpenses,
      formatted: `$${(effectiveGrossIncome - totalAnnualExpenses).toFixed(2)}`,
      breakdown: 'NOI calculated directly',
      calculation: 'noi'
    }
  }
  const noi = noiResult.result

  // Cash flow
  const annualCashFlow = noi - annualDebtService
  const monthlyCashFlow = annualCashFlow / 12

  // Cap Rate
  let capRateResult: CalculationResult
  try {
    capRateResult = calculate('cap-rate', {
      noi,
      purchasePrice
    })
  } catch {
    capRateResult = {
      result: purchasePrice > 0 ? noi / purchasePrice : 0,
      formatted: '0%',
      breakdown: 'Cap rate calculated directly',
      calculation: 'cap-rate'
    }
  }
  const capRate = capRateResult.result

  // Cash-on-Cash
  let cocResult: CalculationResult
  try {
    cocResult = calculate('cash-on-cash', {
      annualCashFlow,
      totalCashInvested: totalInvestment
    })
  } catch {
    cocResult = {
      result: totalInvestment > 0 ? annualCashFlow / totalInvestment : 0,
      formatted: '0%',
      breakdown: 'Cash-on-Cash calculated directly',
      calculation: 'cash-on-cash'
    }
  }
  const cashOnCash = cocResult.result

  // DSCR
  let dscrResult: CalculationResult
  try {
    dscrResult = calculate('dscr', {
      noi,
      annualDebtService: annualDebtService > 0 ? annualDebtService : 1
    })
  } catch {
    dscrResult = {
      result: annualDebtService > 0 ? noi / annualDebtService : 0,
      formatted: '0',
      breakdown: 'DSCR calculated directly',
      calculation: 'dscr'
    }
  }
  const dscr = dscrResult.result

  // GRM
  let grmResult: CalculationResult
  try {
    grmResult = calculate('grm', {
      purchasePrice,
      grossAnnualRent: annualRent > 0 ? annualRent : 1
    })
  } catch {
    grmResult = {
      result: annualRent > 0 ? purchasePrice / annualRent : 0,
      formatted: '0',
      breakdown: 'GRM calculated directly',
      calculation: 'grm'
    }
  }
  const grm = grmResult.result

  // Rental Yield
  let yieldResult: CalculationResult
  try {
    yieldResult = calculate('rental-yield', {
      annualRent,
      purchasePrice
    })
  } catch {
    yieldResult = {
      result: purchasePrice > 0 ? annualRent / purchasePrice : 0,
      formatted: '0%',
      breakdown: 'Rental yield calculated directly',
      calculation: 'rental-yield'
    }
  }
  const rentalYield = yieldResult.result

  // Break-Even Ratio
  let breakEvenResult: CalculationResult
  try {
    breakEvenResult = calculate('break-even', {
      operatingExpenses: totalAnnualExpenses,
      debtService: annualDebtService,
      grossOperatingIncome: effectiveGrossIncome > 0 ? effectiveGrossIncome : 1
    })
  } catch {
    breakEvenResult = {
      result:
        effectiveGrossIncome > 0
          ? (totalAnnualExpenses + annualDebtService) / effectiveGrossIncome
          : 0,
      formatted: '0%',
      breakdown: 'Break-even calculated directly',
      calculation: 'break-even'
    }
  }
  const breakEvenRatio = breakEvenResult.result

  // Flip analysis (if ARV provided)
  let equityGain: number | null = null
  let roi: number | null = null

  if (afterRepairValue && afterRepairValue > 0) {
    equityGain = afterRepairValue - purchasePrice - repairCosts - closingCosts - additionalExpenses

    try {
      const roiResult = calculate('roi', {
        netProfit: equityGain,
        totalInvestment
      })
      roi = roiResult.result
    } catch {
      roi = totalInvestment > 0 ? equityGain / totalInvestment : 0
    }
  }

  return {
    totalInvestment,
    loanAmount,
    downPayment,
    monthlyMortgage,
    annualDebtService,
    monthlyRent,
    annualRent,
    effectiveGrossIncome,
    annualPropertyTax,
    annualInsurance: insuranceAnnual,
    annualHoa,
    annualMaintenance,
    annualManagement,
    annualVacancyLoss,
    totalAnnualExpenses,
    noi,
    annualCashFlow,
    monthlyCashFlow,
    capRate,
    cashOnCash,
    dscr,
    grm,
    rentalYield,
    breakEvenRatio,
    equityGain,
    roi,
    breakdowns: {
      mortgage: mortgageResult.breakdown,
      noi: noiResult.breakdown,
      capRate: capRateResult.breakdown,
      cashOnCash: cocResult.breakdown,
      dscr: dscrResult.breakdown
    }
  }
}

// Format helpers for display
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`
}

export function formatRatio(value: number): string {
  return value.toFixed(2)
}
