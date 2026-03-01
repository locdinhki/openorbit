// ============================================================================
// ext-invoicing — Main Process Entry Point
// ============================================================================

import type { ExtensionMainAPI, ExtensionContext } from '@openorbit/core/extensions/types'
import { createLogger } from '@openorbit/core/utils/logger'
import { registerExtInvoicingHandlers } from './ipc-handlers'
import { extInvoicingMigrations } from './db/migrations'
import { InvoicesRepo } from './db/invoices-repo'
import { InvoiceItemsRepo } from './db/invoice-items-repo'
import { InvoiceRecurringRepo } from './db/recurring-repo'
import { RecurringScheduler } from './invoice/recurring-scheduler'

const log = createLogger('ext:invoicing')

const extension: ExtensionMainAPI = {
  async activate(context: ExtensionContext): Promise<void> {
    log.info(`ext-invoicing: activating (storagePath=${context.storagePath})`)

    registerExtInvoicingHandlers(context)

    // Register scheduler task for recurring invoices
    const invoicesRepo = new InvoicesRepo(context.db)
    const itemsRepo = new InvoiceItemsRepo(context.db)
    const recurringRepo = new InvoiceRecurringRepo(context.db)
    const scheduler = new RecurringScheduler(invoicesRepo, itemsRepo, recurringRepo)

    context.services.scheduler.registerTaskType(
      'invoicing-process-recurring',
      async () => {
        const result = await scheduler.processDue()
        if (result.generated > 0) {
          context.services.notifications.show(
            'Recurring Invoices',
            `Generated ${result.generated} invoice(s)${result.errors > 0 ? `, ${result.errors} error(s)` : ''}`
          )
        }
        log.info(
          `Processed recurring invoices: ${result.generated} generated, ${result.errors} errors`
        )
      },
      {
        label: 'Process Recurring Invoices',
        description: 'Generate invoices from recurring schedules',
        extensionId: 'ext-invoicing',
        configSchema: []
      }
    )

    log.info('ext-invoicing: activated — 22 IPC handlers + 1 scheduler task registered')
  },

  async deactivate(): Promise<void> {
    log.info('ext-invoicing: deactivating')
  },

  migrations: extInvoicingMigrations
}

export default extension
