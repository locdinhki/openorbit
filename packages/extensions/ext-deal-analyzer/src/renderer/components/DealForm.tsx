// ============================================================================
// ext-deal-analyzer — Deal Form Component
// ============================================================================

import type React from 'react'
import { useState } from 'react'
import type { DealRow } from '../lib/ipc-client'

type PropertyType = 'single-family' | 'multi-family' | 'condo' | 'townhouse' | 'commercial' | 'land'

interface DealFormProps {
  deal?: DealRow
  onSubmit: (data: DealFormData) => void
  onCancel: () => void
  loading?: boolean
}

export interface DealFormData {
  address: string
  city: string
  state: string
  postalCode: string
  propertyType: PropertyType
  purchasePrice: number
  afterRepairValue?: number
  estimatedRent?: number
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
  notes?: string
}

const propertyTypes: PropertyType[] = [
  'single-family',
  'multi-family',
  'condo',
  'townhouse',
  'commercial',
  'land'
]

export default function DealForm({
  deal,
  onSubmit,
  onCancel,
  loading
}: DealFormProps): React.JSX.Element {
  const [formData, setFormData] = useState<DealFormData>({
    address: deal?.address ?? '',
    city: deal?.city ?? '',
    state: deal?.state ?? '',
    postalCode: deal?.postalCode ?? '',
    propertyType: (deal?.propertyType as PropertyType) ?? 'single-family',
    purchasePrice: deal?.purchasePrice ?? 0,
    afterRepairValue: deal?.afterRepairValue ?? undefined,
    estimatedRent: deal?.estimatedRent ?? undefined,
    repairCosts: deal?.repairCosts ?? 0,
    downPaymentPercent: deal?.downPaymentPercent ?? 20,
    interestRate: deal?.interestRate ?? 7,
    loanTermYears: deal?.loanTermYears ?? 30,
    closingCosts: deal?.closingCosts ?? 0,
    propertyTaxRate: deal?.propertyTaxRate ?? 1.25,
    insuranceAnnual: deal?.insuranceAnnual ?? 0,
    hoaMonthly: deal?.hoaMonthly ?? 0,
    vacancyRate: deal?.vacancyRate ?? 5,
    managementRate: deal?.managementRate ?? 10,
    maintenanceRate: deal?.maintenanceRate ?? 5,
    notes: deal?.notes ?? ''
  })

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    onSubmit(formData)
  }

  const updateField = <K extends keyof DealFormData>(field: K, value: DealFormData[K]): void => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Property Info */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Property Information</h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Street Address"
            value={formData.address}
            onChange={(e) => updateField('address', e.target.value)}
            required
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="City"
              value={formData.city}
              onChange={(e) => updateField('city', e.target.value)}
              required
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="State"
              value={formData.state}
              onChange={(e) => updateField('state', e.target.value.toUpperCase().slice(0, 2))}
              required
              maxLength={2}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            <input
              type="text"
              placeholder="ZIP"
              value={formData.postalCode}
              onChange={(e) => updateField('postalCode', e.target.value)}
              required
              className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={formData.propertyType}
            onChange={(e) => updateField('propertyType', e.target.value as PropertyType)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
          >
            {propertyTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace('-', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Financial Info */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Financial Details</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Purchase Price</label>
            <input
              type="number"
              value={formData.purchasePrice || ''}
              onChange={(e) => updateField('purchasePrice', parseFloat(e.target.value) || 0)}
              required
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">After Repair Value</label>
            <input
              type="number"
              value={formData.afterRepairValue || ''}
              onChange={(e) =>
                updateField('afterRepairValue', parseFloat(e.target.value) || undefined)
              }
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Monthly Rent</label>
            <input
              type="number"
              value={formData.estimatedRent || ''}
              onChange={(e) =>
                updateField('estimatedRent', parseFloat(e.target.value) || undefined)
              }
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Repair Costs</label>
            <input
              type="number"
              value={formData.repairCosts || ''}
              onChange={(e) => updateField('repairCosts', parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Loan Info */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Loan Terms</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Down Payment %</label>
            <input
              type="number"
              value={formData.downPaymentPercent}
              onChange={(e) => updateField('downPaymentPercent', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Interest Rate %</label>
            <input
              type="number"
              step="0.125"
              value={formData.interestRate}
              onChange={(e) => updateField('interestRate', parseFloat(e.target.value) || 0)}
              min={0}
              max={30}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Term (Years)</label>
            <input
              type="number"
              value={formData.loanTermYears}
              onChange={(e) => updateField('loanTermYears', parseInt(e.target.value) || 30)}
              min={1}
              max={40}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Expenses */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Operating Expenses</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Closing Costs</label>
            <input
              type="number"
              value={formData.closingCosts || ''}
              onChange={(e) => updateField('closingCosts', parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Property Tax Rate %</label>
            <input
              type="number"
              step="0.01"
              value={formData.propertyTaxRate}
              onChange={(e) => updateField('propertyTaxRate', parseFloat(e.target.value) || 0)}
              min={0}
              max={10}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Annual Insurance</label>
            <input
              type="number"
              value={formData.insuranceAnnual || ''}
              onChange={(e) => updateField('insuranceAnnual', parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Monthly HOA</label>
            <input
              type="number"
              value={formData.hoaMonthly || ''}
              onChange={(e) => updateField('hoaMonthly', parseFloat(e.target.value) || 0)}
              min={0}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Rates */}
      <div>
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Expense Rates</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Vacancy %</label>
            <input
              type="number"
              value={formData.vacancyRate}
              onChange={(e) => updateField('vacancyRate', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Management %</label>
            <input
              type="number"
              value={formData.managementRate}
              onChange={(e) => updateField('managementRate', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Maintenance %</label>
            <input
              type="number"
              value={formData.maintenanceRate}
              onChange={(e) => updateField('maintenanceRate', parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs text-zinc-500 mb-1">Notes</label>
        <textarea
          value={formData.notes ?? ''}
          onChange={(e) => updateField('notes', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : deal ? 'Update Deal' : 'Create Deal'}
        </button>
      </div>
    </form>
  )
}
