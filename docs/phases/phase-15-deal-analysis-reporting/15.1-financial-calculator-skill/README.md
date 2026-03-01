# 15.1: Financial Calculator Skill

**Effort:** Medium | **Depends on:** Phase 12 (Skill System) | **Status:** Complete

## Goal

Add a built-in tool skill with 9 real estate financial calculations. Pure TypeScript — no external APIs, no native deps. Follows the `createCalcSkill` factory pattern from `packages/core/src/skills/builtin/calc-skill.ts`.

## Calculations

| Type | Formula | Key Inputs |
|------|---------|------------|
| `roi` | (gain - cost) / cost × 100 | gain, cost |
| `cap-rate` | NOI / propertyValue × 100 | noi, propertyValue |
| `cash-on-cash` | annualCashFlow / totalCashInvested × 100 | annualCashFlow, totalCashInvested |
| `dscr` | NOI / annualDebtService | noi, annualDebtService |
| `mortgage-payment` | P[r(1+r)^n] / [(1+r)^n - 1] | principal, annualRate, termYears |
| `rental-yield` | annualRent / propertyValue × 100 | annualRent, propertyValue |
| `break-even` | (expenses + debt) / grossIncome | grossIncome, operatingExpenses, debtService |
| `grm` | price / grossAnnualRent | propertyPrice, grossAnnualRent |
| `noi` | grossIncome - operatingExpenses | grossIncome, operatingExpenses |

## Skill Definition

- **id:** `financial-calc`
- **category:** `data`
- **icon:** `calculator`
- **capabilities:** `{ aiTool: true, offlineCapable: true, streaming: false }`
- **AI tool name:** `skill_financial_calc`

### Input Schema

```typescript
{
  calculation: 'roi' | 'cap-rate' | 'cash-on-cash' | 'dscr' | 'mortgage-payment' | 'rental-yield' | 'break-even' | 'grm' | 'noi',
  params: Record<string, number>  // calculation-specific parameters
}
```

### Output

```typescript
{
  result: number,       // numeric result
  formatted: string,    // e.g. "7.2%" or "$1,423.47/mo"
  breakdown: string,    // step-by-step formula explanation
  calculation: string   // echoed calculation type
}
```

## Design Notes

- Pure calculation functions live in `financial-formulas.ts` as a shared library — ext-deal-analyzer imports them directly for batch computations without going through the skill registry.
- Each formula validates its own required parameters and returns a descriptive error on division-by-zero or negative-where-positive-expected cases.

## New Files

| File | Purpose |
|------|---------|
| `packages/core/src/skills/builtin/financial-formulas.ts` | Pure calculation library (9 formulas) |
| `packages/core/src/skills/builtin/financial-calc-skill.ts` | `createFinancialCalcSkill(extensionId): Skill` |
| `packages/core/src/skills/builtin/__tests__/financial-formulas.test.ts` | Unit tests for formulas |

## Modified Files

| File | Change |
|------|--------|
| `src/main/index.ts` | Import + `skillRegistry.register(createFinancialCalcSkill('shell'))` |
| `packages/core/src/skills/skill-catalog.ts` | Change `financial-calculator` entry: `type: 'tool'`, `isBuiltIn: true`, remove `content` |

## Success Criteria

- [x] All 9 calculations produce correct results matching manual verification
- [x] Edge cases handled: division by zero → `{ success: false, error }`
- [x] Skill appears in `skill:list` with category `data`
- [x] AI tools include `skill_financial_calc` in combined tools array
- [x] `npx vitest run` passes (existing + new tests)
