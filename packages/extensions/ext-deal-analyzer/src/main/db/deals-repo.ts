// ============================================================================
// ext-deal-analyzer — Deals Repository
// ============================================================================

import type { Database } from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

export interface DealRow {
  id: string
  address: string
  city: string
  state: string
  postalCode: string
  propertyType: string
  purchasePrice: number
  afterRepairValue: number | null
  estimatedRent: number | null
  repairCosts: number
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
  closingCosts: number
  propertyTaxRate: number
  insuranceAnnual: number
  hoaMonthly: number
  vacancyRate: number
  managementRate: number
  maintenanceRate: number
  notes: string | null
  ghlContactId: string | null
  ghlOpportunityId: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface CreateDealInput {
  address: string
  city: string
  state: string
  postalCode: string
  propertyType?: string
  purchasePrice: number
  afterRepairValue?: number
  estimatedRent?: number
  repairCosts?: number
  downPaymentPercent?: number
  interestRate?: number
  loanTermYears?: number
  closingCosts?: number
  propertyTaxRate?: number
  insuranceAnnual?: number
  hoaMonthly?: number
  vacancyRate?: number
  managementRate?: number
  maintenanceRate?: number
  notes?: string
  ghlContactId?: string
  ghlOpportunityId?: string
}

export interface UpdateDealInput {
  id: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  propertyType?: string
  purchasePrice?: number
  afterRepairValue?: number
  estimatedRent?: number
  repairCosts?: number
  downPaymentPercent?: number
  interestRate?: number
  loanTermYears?: number
  closingCosts?: number
  propertyTaxRate?: number
  insuranceAnnual?: number
  hoaMonthly?: number
  vacancyRate?: number
  managementRate?: number
  maintenanceRate?: number
  notes?: string
  ghlContactId?: string
  ghlOpportunityId?: string
  status?: string
}

export class DealsRepo {
  constructor(private db: Database) {}

  list(limit = 100, offset = 0, status: 'active' | 'archived' | 'all' = 'active'): DealRow[] {
    let query = `
      SELECT
        id, address, city, state, postal_code as postalCode, property_type as propertyType,
        purchase_price as purchasePrice, after_repair_value as afterRepairValue,
        estimated_rent as estimatedRent, repair_costs as repairCosts,
        down_payment_pct as downPaymentPercent, interest_rate as interestRate,
        loan_term_years as loanTermYears, closing_costs as closingCosts,
        property_tax_rate as propertyTaxRate, insurance_annual as insuranceAnnual,
        hoa_monthly as hoaMonthly, vacancy_rate as vacancyRate,
        management_rate as managementRate, maintenance_rate as maintenanceRate,
        notes, ghl_contact_id as ghlContactId, ghl_opportunity_id as ghlOpportunityId,
        status, created_at as createdAt, updated_at as updatedAt
      FROM deals
    `

    if (status !== 'all') {
      query += ` WHERE status = ?`
    }

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`

    const params = status !== 'all' ? [status, limit, offset] : [limit, offset]
    return this.db.prepare(query).all(...params) as DealRow[]
  }

  get(id: string): DealRow | null {
    const row = this.db
      .prepare(
        `
        SELECT
          id, address, city, state, postal_code as postalCode, property_type as propertyType,
          purchase_price as purchasePrice, after_repair_value as afterRepairValue,
          estimated_rent as estimatedRent, repair_costs as repairCosts,
          down_payment_pct as downPaymentPercent, interest_rate as interestRate,
          loan_term_years as loanTermYears, closing_costs as closingCosts,
          property_tax_rate as propertyTaxRate, insurance_annual as insuranceAnnual,
          hoa_monthly as hoaMonthly, vacancy_rate as vacancyRate,
          management_rate as managementRate, maintenance_rate as maintenanceRate,
          notes, ghl_contact_id as ghlContactId, ghl_opportunity_id as ghlOpportunityId,
          status, created_at as createdAt, updated_at as updatedAt
        FROM deals WHERE id = ?
      `
      )
      .get(id) as DealRow | undefined

    return row ?? null
  }

  create(input: CreateDealInput): DealRow {
    const id = uuid()
    const now = new Date().toISOString()

    this.db
      .prepare(
        `
        INSERT INTO deals (
          id, address, city, state, postal_code, property_type,
          purchase_price, after_repair_value, estimated_rent, repair_costs,
          down_payment_pct, interest_rate, loan_term_years, closing_costs,
          property_tax_rate, insurance_annual, hoa_monthly,
          vacancy_rate, management_rate, maintenance_rate,
          notes, ghl_contact_id, ghl_opportunity_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
      `
      )
      .run(
        id,
        input.address,
        input.city,
        input.state,
        input.postalCode,
        input.propertyType ?? 'single-family',
        input.purchasePrice,
        input.afterRepairValue ?? null,
        input.estimatedRent ?? null,
        input.repairCosts ?? 0,
        input.downPaymentPercent ?? 20,
        input.interestRate ?? 7,
        input.loanTermYears ?? 30,
        input.closingCosts ?? 0,
        input.propertyTaxRate ?? 1.25,
        input.insuranceAnnual ?? 0,
        input.hoaMonthly ?? 0,
        input.vacancyRate ?? 5,
        input.managementRate ?? 10,
        input.maintenanceRate ?? 5,
        input.notes ?? null,
        input.ghlContactId ?? null,
        input.ghlOpportunityId ?? null,
        now,
        now
      )

    return this.get(id)!
  }

  update(input: UpdateDealInput): DealRow | null {
    const existing = this.get(input.id)
    if (!existing) return null

    const updates: string[] = []
    const values: unknown[] = []

    const fieldMap: Record<string, string> = {
      address: 'address',
      city: 'city',
      state: 'state',
      postalCode: 'postal_code',
      propertyType: 'property_type',
      purchasePrice: 'purchase_price',
      afterRepairValue: 'after_repair_value',
      estimatedRent: 'estimated_rent',
      repairCosts: 'repair_costs',
      downPaymentPercent: 'down_payment_pct',
      interestRate: 'interest_rate',
      loanTermYears: 'loan_term_years',
      closingCosts: 'closing_costs',
      propertyTaxRate: 'property_tax_rate',
      insuranceAnnual: 'insurance_annual',
      hoaMonthly: 'hoa_monthly',
      vacancyRate: 'vacancy_rate',
      managementRate: 'management_rate',
      maintenanceRate: 'maintenance_rate',
      notes: 'notes',
      ghlContactId: 'ghl_contact_id',
      ghlOpportunityId: 'ghl_opportunity_id',
      status: 'status'
    }

    for (const [key, column] of Object.entries(fieldMap)) {
      const value = input[key as keyof UpdateDealInput]
      if (value !== undefined) {
        updates.push(`${column} = ?`)
        values.push(value)
      }
    }

    if (updates.length === 0) return existing

    updates.push(`updated_at = ?`)
    values.push(new Date().toISOString())
    values.push(input.id)

    this.db.prepare(`UPDATE deals SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    return this.get(input.id)
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM deals WHERE id = ?').run(id)
    return result.changes > 0
  }
}
