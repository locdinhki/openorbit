// ============================================================================
// ext-bookkeeping — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { EXT_BOOKKEEPING_IPC } from '../ipc-channels'
import { extBookkeepingSchemas } from '../ipc-schemas'
import { BkAccountsRepo } from './db/accounts-repo'
import { BkCategoriesRepo } from './db/categories-repo'
import { BkTransactionsRepo } from './db/transactions-repo'
import { TransactionCategorizer } from './ai/transaction-categorizer'
import { ProfitLossGenerator } from './reports/profit-loss'
import { CashFlowGenerator } from './reports/cash-flow'
import { TaxReportGenerator } from './reports/tax-report'

function getSettings(): SettingsRepo {
  return new SettingsRepo()
}

export function registerExtBookkeepingHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const accountsRepo = new BkAccountsRepo(db)
  const categoriesRepo = new BkCategoriesRepo(db)
  const transactionsRepo = new BkTransactionsRepo(db)

  const categorizer = new TransactionCategorizer(ctx.services.ai)
  const plGenerator = new ProfitLossGenerator(categoriesRepo, transactionsRepo)
  const cfGenerator = new CashFlowGenerator(accountsRepo, transactionsRepo)
  const taxGenerator = new TaxReportGenerator(categoriesRepo, transactionsRepo)

  // ===== Settings =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.SETTINGS_GET,
    extBookkeepingSchemas['ext-bookkeeping:settings-get'],
    () => {
      try {
        const settings = getSettings()
        return {
          success: true,
          data: {
            fiscalYearStart: parseInt(settings.get('bookkeeping.fiscal-year-start') as string) || 1,
            defaultCurrency: (settings.get('bookkeeping.default-currency') as string) || 'USD'
          }
        }
      } catch (err) {
        log.error('Failed to get settings', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.SETTINGS_SET,
    extBookkeepingSchemas['ext-bookkeeping:settings-set'],
    (_event, { fiscalYearStart, defaultCurrency }) => {
      try {
        const settings = getSettings()
        if (fiscalYearStart !== undefined)
          settings.set('bookkeeping.fiscal-year-start', String(fiscalYearStart))
        if (defaultCurrency !== undefined)
          settings.set('bookkeeping.default-currency', defaultCurrency)
        return { success: true, data: { saved: true } }
      } catch (err) {
        log.error('Failed to save settings', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Accounts =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.ACCOUNTS_LIST,
    extBookkeepingSchemas['ext-bookkeeping:accounts-list'],
    () => {
      try {
        return { success: true, data: accountsRepo.list() }
      } catch (err) {
        log.error('Failed to list accounts', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.ACCOUNTS_CREATE,
    extBookkeepingSchemas['ext-bookkeeping:accounts-create'],
    (_event, { name, type, openingBalance }) => {
      try {
        const account = accountsRepo.create({ name, type, openingBalance })
        return { success: true, data: account }
      } catch (err) {
        log.error('Failed to create account', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.ACCOUNTS_UPDATE,
    extBookkeepingSchemas['ext-bookkeeping:accounts-update'],
    (_event, { id, name, openingBalance }) => {
      try {
        accountsRepo.update(id, { name, openingBalance })
        return { success: true, data: accountsRepo.getById(id) }
      } catch (err) {
        log.error('Failed to update account', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.ACCOUNTS_LINK_PLAID,
    extBookkeepingSchemas['ext-bookkeeping:accounts-link-plaid'],
    (_event, { id, plaidAccountId }) => {
      try {
        accountsRepo.linkToPlaid(id, plaidAccountId)
        return { success: true, data: { linked: true } }
      } catch (err) {
        log.error('Failed to link account to Plaid', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Categories =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.CATEGORIES_LIST,
    extBookkeepingSchemas['ext-bookkeeping:categories-list'],
    (_event, { type }) => {
      try {
        return { success: true, data: categoriesRepo.list(type) }
      } catch (err) {
        log.error('Failed to list categories', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.CATEGORIES_CREATE,
    extBookkeepingSchemas['ext-bookkeeping:categories-create'],
    (_event, { name, type, parentId, taxCategory }) => {
      try {
        const category = categoriesRepo.create({ name, type, parentId, taxCategory })
        return { success: true, data: category }
      } catch (err) {
        log.error('Failed to create category', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.CATEGORIES_UPDATE,
    extBookkeepingSchemas['ext-bookkeeping:categories-update'],
    (_event, { id, name, parentId, taxCategory }) => {
      try {
        categoriesRepo.update(id, { name, parentId, taxCategory })
        return { success: true, data: categoriesRepo.getById(id) }
      } catch (err) {
        log.error('Failed to update category', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.CATEGORIES_DELETE,
    extBookkeepingSchemas['ext-bookkeeping:categories-delete'],
    (_event, { id }) => {
      try {
        categoriesRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete category', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Transactions =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_LIST,
    extBookkeepingSchemas['ext-bookkeeping:transactions-list'],
    (_event, { accountId, categoryId, startDate, endDate, uncategorized, limit, offset }) => {
      try {
        const transactions = transactionsRepo.list({
          accountId,
          categoryId,
          startDate,
          endDate,
          uncategorized,
          limit,
          offset
        })
        return { success: true, data: transactions }
      } catch (err) {
        log.error('Failed to list transactions', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_GET,
    extBookkeepingSchemas['ext-bookkeeping:transactions-get'],
    (_event, { id }) => {
      try {
        const txn = transactionsRepo.getById(id)
        if (!txn) return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' }
        return { success: true, data: txn }
      } catch (err) {
        log.error('Failed to get transaction', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_CREATE,
    extBookkeepingSchemas['ext-bookkeeping:transactions-create'],
    (_event, { date, amount, description, payee, accountId, categoryId, notes }) => {
      try {
        const txn = transactionsRepo.create({
          date,
          amount,
          description,
          payee,
          accountId,
          categoryId,
          notes
        })
        accountsRepo.recalculateBalance(accountId)
        return { success: true, data: txn }
      } catch (err) {
        log.error('Failed to create transaction', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_UPDATE,
    extBookkeepingSchemas['ext-bookkeeping:transactions-update'],
    (_event, { id, date, amount, description, payee, categoryId, notes }) => {
      try {
        const txn = transactionsRepo.getById(id)
        if (!txn) return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' }

        transactionsRepo.update(id, { date, amount, description, payee, categoryId, notes })

        // Recalculate balance if amount changed
        if (amount !== undefined) {
          accountsRepo.recalculateBalance(txn.account_id)
        }

        return { success: true, data: transactionsRepo.getById(id) }
      } catch (err) {
        log.error('Failed to update transaction', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_DELETE,
    extBookkeepingSchemas['ext-bookkeeping:transactions-delete'],
    (_event, { id }) => {
      try {
        const txn = transactionsRepo.getById(id)
        if (!txn) return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' }

        transactionsRepo.delete(id)
        accountsRepo.recalculateBalance(txn.account_id)

        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete transaction', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.TRANSACTIONS_BULK_CATEGORIZE,
    extBookkeepingSchemas['ext-bookkeeping:transactions-bulk-categorize'],
    (_event, { ids, categoryId }) => {
      try {
        transactionsRepo.bulkUpdateCategory(ids, categoryId)
        return { success: true, data: { updated: ids.length } }
      } catch (err) {
        log.error('Failed to bulk categorize transactions', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== AI =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.AI_CATEGORIZE,
    extBookkeepingSchemas['ext-bookkeeping:ai-categorize'],
    async (_event, { transactionId }) => {
      try {
        const txn = transactionsRepo.getById(transactionId)
        if (!txn) return { success: false, error: 'Transaction not found', code: 'NOT_FOUND' }

        const categories = categoriesRepo.list()
        const result = await categorizer.categorize(txn, categories)

        transactionsRepo.updateAiSuggestion(transactionId, result.categoryId, result.confidence)

        return { success: true, data: result }
      } catch (err) {
        log.error('Failed to AI categorize transaction', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.AI_CATEGORIZE_BATCH,
    extBookkeepingSchemas['ext-bookkeeping:ai-categorize-batch'],
    async (_event, { transactionIds, uncategorizedOnly }) => {
      try {
        const transactions = transactionIds
          ? transactionIds.map((id) => transactionsRepo.getById(id)).filter((t) => t !== null)
          : uncategorizedOnly
            ? transactionsRepo.listUncategorized(100)
            : transactionsRepo.list({ limit: 100 })

        const categories = categoriesRepo.list()
        const results = await categorizer.categorizeBatch(
          transactions as NonNullable<typeof transactions>,
          categories,
          (index, total) => {
            ipc.push(EXT_BOOKKEEPING_IPC.IMPORT_PROGRESS, {
              type: 'ai-categorize',
              current: index,
              total
            })
          }
        )

        // Apply suggestions
        let applied = 0
        for (const [txnId, result] of results) {
          transactionsRepo.updateAiSuggestion(txnId, result.categoryId, result.confidence)
          applied++
        }

        return { success: true, data: { processed: results.size, applied } }
      } catch (err) {
        log.error('Failed to AI categorize batch', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Import =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.IMPORT_FROM_PLAID,
    extBookkeepingSchemas['ext-bookkeeping:import-from-plaid'],
    async (_event, { accountId }) => {
      try {
        // Get Plaid transactions
        const plaidResult = await ctx.ipc.invoke('ext-plaid:transactions-list', {
          accountId,
          limit: 500
        })

        if (!plaidResult.success || !plaidResult.data) {
          return {
            success: false,
            error: 'Failed to fetch Plaid transactions',
            code: 'PLAID_ERROR'
          }
        }

        const plaidTxns = plaidResult.data as Array<{
          id: string
          account_id: string
          amount: number
          date: string
          name: string
          merchant_name: string | null
        }>

        let imported = 0
        let skipped = 0

        for (const ptxn of plaidTxns) {
          // Check if already imported
          if (transactionsRepo.getByPlaidTxnId(ptxn.id)) {
            skipped++
            continue
          }

          // Find or create bookkeeping account
          let bkAccount = accountsRepo.getByPlaidAccountId(ptxn.account_id)
          if (!bkAccount && !accountId) {
            // Auto-create account
            bkAccount = accountsRepo.create({
              name: `Bank Account (${ptxn.account_id.slice(-4)})`,
              type: 'checking'
            })
            accountsRepo.linkToPlaid(bkAccount.id, ptxn.account_id)
          }

          if (!bkAccount) {
            skipped++
            continue
          }

          // Import transaction (Plaid amounts are inverted: positive = money out)
          transactionsRepo.create({
            date: ptxn.date,
            amount: -ptxn.amount, // Invert to match bookkeeping convention
            description: ptxn.merchant_name || ptxn.name,
            payee: ptxn.merchant_name || undefined,
            accountId: bkAccount.id,
            source: 'plaid',
            plaidTxnId: ptxn.id
          })
          imported++

          if (imported % 50 === 0) {
            ipc.push(EXT_BOOKKEEPING_IPC.IMPORT_PROGRESS, {
              type: 'plaid-import',
              imported,
              skipped
            })
          }
        }

        // Recalculate balances
        const accounts = accountsRepo.list()
        for (const acc of accounts) {
          accountsRepo.recalculateBalance(acc.id)
        }

        return { success: true, data: { imported, skipped } }
      } catch (err) {
        log.error('Failed to import from Plaid', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.IMPORT_FROM_STRIPE,
    extBookkeepingSchemas['ext-bookkeeping:import-from-stripe'],
    async () => {
      try {
        // Get Stripe payments
        const stripeResult = await ctx.ipc.invoke('ext-stripe:payments-list', { limit: 100 })

        if (!stripeResult.success || !stripeResult.data) {
          return { success: false, error: 'Failed to fetch Stripe payments', code: 'STRIPE_ERROR' }
        }

        const payments = stripeResult.data as Array<{
          id: string
          amount: number
          status: string
          created_at: string
          description: string | null
        }>

        // Find or create Stripe income account
        let stripeAccount = accountsRepo.list().find((a) => a.name === 'Stripe Revenue')
        if (!stripeAccount) {
          stripeAccount = accountsRepo.create({
            name: 'Stripe Revenue',
            type: 'other'
          })
        }

        let imported = 0
        let skipped = 0

        for (const payment of payments) {
          if (payment.status !== 'succeeded') {
            skipped++
            continue
          }

          // Check if already imported
          const existing = transactionsRepo
            .list({ limit: 1 })
            .find((t) => t.stripe_payment_id === payment.id)
          if (existing) {
            skipped++
            continue
          }

          transactionsRepo.create({
            date: payment.created_at.split('T')[0],
            amount: payment.amount / 100, // Convert from cents
            description: payment.description || 'Stripe Payment',
            accountId: stripeAccount.id,
            source: 'stripe',
            stripePaymentId: payment.id
          })
          imported++
        }

        accountsRepo.recalculateBalance(stripeAccount.id)

        return { success: true, data: { imported, skipped } }
      } catch (err) {
        log.error('Failed to import from Stripe', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.IMPORT_FROM_CSV,
    extBookkeepingSchemas['ext-bookkeeping:import-from-csv'],
    async (_event, { accountId, filePath, dateColumn, amountColumn, descriptionColumn }) => {
      try {
        // Read CSV file
        const fs = await import('fs/promises')
        const content = await fs.readFile(filePath, 'utf-8')
        const lines = content.split('\n')

        if (lines.length < 2) {
          return { success: false, error: 'CSV file is empty', code: 'INVALID_CSV' }
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
        const dateIdx = headers.findIndex((h) => h.toLowerCase() === dateColumn.toLowerCase())
        const amountIdx = headers.findIndex((h) => h.toLowerCase() === amountColumn.toLowerCase())
        const descIdx = headers.findIndex(
          (h) => h.toLowerCase() === descriptionColumn.toLowerCase()
        )

        if (dateIdx === -1 || amountIdx === -1 || descIdx === -1) {
          return { success: false, error: 'Required columns not found', code: 'INVALID_CSV' }
        }

        let imported = 0
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const values = line.split(',').map((v) => v.trim().replace(/"/g, ''))
          const date = values[dateIdx]
          const amount = parseFloat(values[amountIdx].replace(/[^0-9.-]/g, ''))
          const description = values[descIdx]

          if (!date || isNaN(amount) || !description) continue

          transactionsRepo.create({
            date,
            amount,
            description,
            accountId,
            source: 'csv'
          })
          imported++
        }

        accountsRepo.recalculateBalance(accountId)

        return { success: true, data: { imported } }
      } catch (err) {
        log.error('Failed to import from CSV', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Reports =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.REPORT_PROFIT_LOSS,
    extBookkeepingSchemas['ext-bookkeeping:report-profit-loss'],
    (_event, { startDate, endDate }) => {
      try {
        const report = plGenerator.generate(startDate, endDate)
        return { success: true, data: report }
      } catch (err) {
        log.error('Failed to generate P&L report', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.REPORT_CASH_FLOW,
    extBookkeepingSchemas['ext-bookkeeping:report-cash-flow'],
    (_event, { startDate, endDate }) => {
      try {
        const report = cfGenerator.generate(startDate, endDate)
        return { success: true, data: report }
      } catch (err) {
        log.error('Failed to generate cash flow report', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.REPORT_TAX,
    extBookkeepingSchemas['ext-bookkeeping:report-tax'],
    (_event, { year }) => {
      try {
        const report = taxGenerator.generate(year)
        const scheduleC = taxGenerator.generateScheduleC(year)
        return { success: true, data: { report, scheduleC } }
      } catch (err) {
        log.error('Failed to generate tax report', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Export =====

  ipc.handle(
    EXT_BOOKKEEPING_IPC.EXPORT_CSV,
    extBookkeepingSchemas['ext-bookkeeping:export-csv'],
    (_event, { startDate, endDate, accountId }) => {
      try {
        const transactions = transactionsRepo.list({
          startDate,
          endDate,
          accountId,
          limit: 10000
        })

        const categories = categoriesRepo.list()
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

        const headers = ['Date', 'Description', 'Payee', 'Amount', 'Category', 'Account', 'Notes']
        const rows = transactions.map((t) => [
          t.date,
          `"${t.description.replace(/"/g, '""')}"`,
          `"${(t.payee || '').replace(/"/g, '""')}"`,
          t.amount.toFixed(2),
          `"${categoryMap.get(t.category_id ?? '') || 'Uncategorized'}"`,
          t.account_id,
          `"${(t.notes || '').replace(/"/g, '""')}"`
        ])

        const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

        return { success: true, data: { csv, count: transactions.length } }
      } catch (err) {
        log.error('Failed to export CSV', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_BOOKKEEPING_IPC.EXPORT_QUICKBOOKS,
    extBookkeepingSchemas['ext-bookkeeping:export-quickbooks'],
    (_event, { startDate, endDate }) => {
      try {
        const transactions = transactionsRepo.list({
          startDate,
          endDate,
          limit: 10000
        })

        const categories = categoriesRepo.list()
        const accounts = accountsRepo.list()
        const categoryMap = new Map(categories.map((c) => [c.id, c]))
        const accountMap = new Map(accounts.map((a) => [a.id, a]))

        // QuickBooks IIF format
        const lines: string[] = ['!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO']
        lines.push('!SPL\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO')
        lines.push('!ENDTRNS')

        for (const t of transactions) {
          const account = accountMap.get(t.account_id)
          const category = t.category_id ? categoryMap.get(t.category_id) : null
          const trnsType = t.amount > 0 ? 'DEPOSIT' : 'CHECK'

          lines.push(
            `TRNS\t${trnsType}\t${t.date}\t${account?.name || 'Uncategorized'}\t${t.payee || ''}\t${t.amount}\t${t.description}`
          )
          lines.push(
            `SPL\t${trnsType}\t${t.date}\t${category?.name || 'Uncategorized'}\t\t${-t.amount}\t`
          )
          lines.push('ENDTRNS')
        }

        return { success: true, data: { iif: lines.join('\n'), count: transactions.length } }
      } catch (err) {
        log.error('Failed to export QuickBooks', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-bookkeeping IPC handlers registered (24 channels)')
}
