# 15.4: ext-deal-analyzer Extension

**Effort:** High | **Depends on:** 15.1, 15.2, 15.3, Phase 11 (ext-ghl, ext-zillow) | **Status:** Complete

## Goal

Full extension for real estate deal analysis. Composes the three new skills with ext-zillow and ext-ghl data to provide financial metric computation, deal comparison, and PDF report export. Follows the ext-ghl pattern: package.json manifest, main entry with IPC + DB migrations, renderer with sidebar/workspace + Zustand store.

## DB Schema (V1 Migration)

### deals

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | uuid |
| name | TEXT NOT NULL | deal title |
| address1, city, state, postal_code | TEXT | property address |
| purchase_price | REAL | |
| after_repair_value | REAL | |
| rental_income | REAL | monthly |
| vacancy_rate | REAL | default 0.08 (8%) |
| property_tax | REAL | annual |
| insurance | REAL | annual |
| management_fee | REAL | default 0.10 (10%) |
| loan_amount | REAL | |
| loan_rate | REAL | annual interest rate |
| loan_term_years | INTEGER | default 30 |
| rehab_budget | REAL | default 0 |
| status | TEXT NOT NULL | draft\|active\|closed\|archived |
| notes | TEXT | |
| ghl_contact_id | TEXT | soft FK to ghl_contacts |
| ghl_opportunity_id | TEXT | soft FK to ghl_opportunities |
| created_at, updated_at | TEXT | timestamps |

### deal_comps

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | uuid |
| deal_id | TEXT FK | → deals(id) ON DELETE CASCADE |
| address1, city, state | TEXT | |
| sale_price | REAL | |
| sale_date | TEXT | |
| sq_ft | INTEGER | |
| beds | INTEGER | |
| baths | REAL | |
| source | TEXT | 'zillow' \| 'manual' |
| arv_cache_id | TEXT | soft FK to arv_cache |
| created_at | TEXT | |

### deal_expenses

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT PK | uuid |
| deal_id | TEXT FK | → deals(id) ON DELETE CASCADE |
| category | TEXT NOT NULL | rehab\|closing\|holding\|other |
| description | TEXT NOT NULL | |
| amount | REAL NOT NULL | |
| created_at | TEXT | |

## IPC Channels (14)

| Channel | Purpose |
|---------|---------|
| `ext-deal:deals-list` | List deals with filters (status, search) |
| `ext-deal:deals-get` | Get single deal by ID |
| `ext-deal:deals-create` | Create new deal |
| `ext-deal:deals-update` | Update existing deal |
| `ext-deal:deals-delete` | Delete deal |
| `ext-deal:comps-list` | List comps for a deal |
| `ext-deal:comps-add` | Add a comp (manual or from Zillow) |
| `ext-deal:comps-delete` | Remove a comp |
| `ext-deal:expenses-list` | List expenses for a deal |
| `ext-deal:expenses-add` | Add an expense line item |
| `ext-deal:expenses-delete` | Remove an expense |
| `ext-deal:analyze` | Run full financial analysis on a deal |
| `ext-deal:compare` | Side-by-side comparison (up to 4 deals) |
| `ext-deal:export-pdf` | Generate PDF deal package |

## Analysis Engine

### DealAnalyzer

Loads a deal + comps + expenses, computes all financial metrics via direct import of `financial-formulas.ts` (not through skill registry — efficiency for batch). Returns:

```typescript
interface DealAnalysis {
  deal: DealRow
  comps: DealCompRow[]
  expenses: {
    items: DealExpenseRow[]
    totalByCategory: Record<string, number>
    grandTotal: number
  }
  metrics: {
    noi: number
    capRate: number
    cashOnCash: number
    dscr: number
    monthlyMortgage: number
    annualDebtService: number
    rentalYield: number
    grm: number
    roi: number
    breakEvenOccupancy: number
    totalInvestment: number    // purchase + rehab + closing
    equity: number             // ARV - loan
    monthlyNetCashFlow: number
  }
  zestimate?: number  // from arv_cache if available
}
```

### DealComparer

Takes up to 4 deal IDs, runs DealAnalyzer on each, returns `DealAnalysis[]` for side-by-side display.

### DealExporter

Composes all 3 skills:
1. Run DealAnalyzer to get metrics
2. Call `chart-render` skill: bar chart (income vs expenses), pie chart (expense categories)
3. Call `pdf-generate` skill: title, metrics key-values, comps table, expenses table, embedded charts

## Cross-Extension Access

Direct DB import (same pattern as ext-ghl importing ext-zillow):

```typescript
import { ArvCacheRepo } from '@openorbit/ext-zillow/main/db/arv-cache-repo'
import { GhlContactsRepo } from '@openorbit/ext-ghl/main/db/contacts-repo'
import { GhlOpportunitiesRepo } from '@openorbit/ext-ghl/main/db/opportunities-repo'
```

## AI Tools (6)

| Tool Name | Description |
|-----------|-------------|
| `list_deals` | List deals with optional status filter |
| `get_deal_analysis` | Get full financial analysis for a deal |
| `create_deal` | Create a new deal from property data |
| `compare_deals` | Side-by-side comparison of 2–4 deals |
| `add_deal_expense` | Add a rehab/closing/holding expense |
| `export_deal_pdf` | Generate a PDF deal package |

## UI

**Sidebar:** Tab bar (Active \| Draft \| Archived), deal cards (name, address, key metric), "New Deal" button, search

**Workspace:** Deal header with status badge, 3×3 metrics grid, comps table with "Add from Zillow" button, expenses table with running total, charts section, action bar (Export PDF, Compare, Edit, Delete)

**Store:** Zustand with 4 slices — dealsSlice, analysisSlice, compsSlice, expensesSlice

## New Files (29)

| File | Purpose |
|------|---------|
| `packages/extensions/ext-deal-analyzer/package.json` | Extension manifest |
| `packages/extensions/ext-deal-analyzer/tsconfig.json` | TS config |
| `packages/extensions/ext-deal-analyzer/src/main/index.ts` | activate/deactivate + migrations |
| `packages/extensions/ext-deal-analyzer/src/main/db/migrations.ts` | V1 schema |
| `packages/extensions/ext-deal-analyzer/src/main/db/deals-repo.ts` | DealsRepo |
| `packages/extensions/ext-deal-analyzer/src/main/db/deal-comps-repo.ts` | DealCompsRepo |
| `packages/extensions/ext-deal-analyzer/src/main/db/deal-expenses-repo.ts` | DealExpensesRepo |
| `packages/extensions/ext-deal-analyzer/src/ipc-channels.ts` | 14 channel constants |
| `packages/extensions/ext-deal-analyzer/src/ipc-schemas.ts` | Zod schemas |
| `packages/extensions/ext-deal-analyzer/src/main/ipc-handlers.ts` | Handler registration |
| `packages/extensions/ext-deal-analyzer/src/main/analysis/deal-analyzer.ts` | Financial metrics engine |
| `packages/extensions/ext-deal-analyzer/src/main/analysis/deal-comparer.ts` | Side-by-side comparison |
| `packages/extensions/ext-deal-analyzer/src/main/analysis/deal-exporter.ts` | PDF export compositor |
| `packages/extensions/ext-deal-analyzer/src/main/ai/deal-tools.ts` | AI tool definitions |
| `packages/extensions/ext-deal-analyzer/src/renderer/index.ts` | View registration |
| `packages/extensions/ext-deal-analyzer/src/renderer/lib/ipc-client.ts` | Typed IPC wrapper |
| `packages/extensions/ext-deal-analyzer/src/renderer/store/index.ts` | Composed Zustand store |
| `packages/extensions/ext-deal-analyzer/src/renderer/store/dealsSlice.ts` | Deals state |
| `packages/extensions/ext-deal-analyzer/src/renderer/store/analysisSlice.ts` | Analysis state |
| `packages/extensions/ext-deal-analyzer/src/renderer/store/compsSlice.ts` | Comps state |
| `packages/extensions/ext-deal-analyzer/src/renderer/store/expensesSlice.ts` | Expenses state |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/DealSidebar.tsx` | Sidebar view |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/DealWorkspace.tsx` | Workspace router |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/DealCard.tsx` | Deal summary card |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/MetricsGrid.tsx` | Metrics display |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/CompsTable.tsx` | Comparable sales |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/ExpensesTable.tsx` | Expense line items |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/CompareView.tsx` | Comparison view |
| `packages/extensions/ext-deal-analyzer/src/renderer/components/DealForm.tsx` | Create/edit form |

## Modified Files (2)

| File | Change |
|------|--------|
| `electron.vite.config.ts` | Add `@openorbit/ext-deal-analyzer` alias (main + renderer) |
| `src/main/index.ts` | Import `extDealAnalyzerMain` + add to preloadedModules |

## Success Criteria

- [x] `npx vitest run` — all tests pass
- [x] `npx electron-vite build` — builds without errors
- [x] Extension appears in Extensions panel under "integrations" category
- [x] Deal CRUD works: create, read, update, delete
- [x] Comps: add manually or pull from Zillow arv_cache
- [x] Expenses: line-item add/remove, category totals
- [x] All 9 financial metrics compute correctly
- [x] Comparison view shows side-by-side for 2–4 deals
- [x] PDF export produces valid PDF with metrics, tables, and charts
- [x] GHL linking: deal associated with contact/opportunity
- [x] AI chat can invoke deal tools via skill tool dispatcher
- [x] IPC channels match `/^[a-z-]+:[a-z-]+$/`
