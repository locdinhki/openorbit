// ============================================================================
// ext-invoicing — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { EXT_INVOICING_IPC } from '../ipc-channels'
import { extInvoicingSchemas } from '../ipc-schemas'
import { InvoicesRepo } from './db/invoices-repo'
import { InvoiceItemsRepo } from './db/invoice-items-repo'
import { InvoicePaymentsRepo } from './db/payments-repo'
import { InvoiceTemplatesRepo } from './db/templates-repo'
import { InvoiceRecurringRepo } from './db/recurring-repo'
import { InvoiceGenerator } from './invoice/invoice-generator'
import { RecurringScheduler } from './invoice/recurring-scheduler'

function getSettings(): SettingsRepo {
  return new SettingsRepo()
}

export function registerExtInvoicingHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const invoicesRepo = new InvoicesRepo(db)
  const itemsRepo = new InvoiceItemsRepo(db)
  const paymentsRepo = new InvoicePaymentsRepo(db)
  const templatesRepo = new InvoiceTemplatesRepo(db)
  const recurringRepo = new InvoiceRecurringRepo(db)
  const generator = new InvoiceGenerator()
  const scheduler = new RecurringScheduler(invoicesRepo, itemsRepo, recurringRepo)

  // ===== Settings =====

  ipc.handle(
    EXT_INVOICING_IPC.SETTINGS_GET,
    extInvoicingSchemas['ext-invoicing:settings-get'],
    () => {
      try {
        const settings = getSettings()
        return {
          success: true,
          data: {
            companyName: settings.get('invoicing.company-name') as string | null,
            companyEmail: settings.get('invoicing.company-email') as string | null,
            companyAddress: settings.get('invoicing.company-address') as string | null,
            defaultTaxRate: parseFloat(settings.get('invoicing.default-tax-rate') as string) || 0,
            paymentTermsDays: parseInt(settings.get('invoicing.payment-terms') as string) || 30
          }
        }
      } catch (err) {
        log.error('Failed to get settings', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.SETTINGS_SET,
    extInvoicingSchemas['ext-invoicing:settings-set'],
    (_event, { companyName, companyEmail, companyAddress, defaultTaxRate, paymentTermsDays }) => {
      try {
        const settings = getSettings()
        if (companyName !== undefined) settings.set('invoicing.company-name', companyName)
        if (companyEmail !== undefined) settings.set('invoicing.company-email', companyEmail)
        if (companyAddress !== undefined) settings.set('invoicing.company-address', companyAddress)
        if (defaultTaxRate !== undefined)
          settings.set('invoicing.default-tax-rate', String(defaultTaxRate))
        if (paymentTermsDays !== undefined)
          settings.set('invoicing.payment-terms', String(paymentTermsDays))
        return { success: true, data: { saved: true } }
      } catch (err) {
        log.error('Failed to save settings', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Invoices =====

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_LIST,
    extInvoicingSchemas['ext-invoicing:invoices-list'],
    (_event, { status, customerId, limit, offset }) => {
      try {
        const invoices = invoicesRepo.list({ status, customerId, limit, offset })
        // Include items for each invoice
        const result = invoices.map((inv) => ({
          ...inv,
          items: itemsRepo.listByInvoice(inv.id)
        }))
        return { success: true, data: result }
      } catch (err) {
        log.error('Failed to list invoices', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_GET,
    extInvoicingSchemas['ext-invoicing:invoices-get'],
    (_event, { id }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
        const items = itemsRepo.listByInvoice(id)
        const payments = paymentsRepo.listByInvoice(id)
        return { success: true, data: { ...invoice, items, payments } }
      } catch (err) {
        log.error('Failed to get invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_CREATE,
    extInvoicingSchemas['ext-invoicing:invoices-create'],
    (_event, { customer, items, taxRate, dueDate, notes, templateId }) => {
      try {
        const settings = getSettings()
        const defaultTaxRate = parseFloat(settings.get('invoicing.default-tax-rate') as string) || 0
        const paymentTerms = parseInt(settings.get('invoicing.payment-terms') as string) || 30

        const actualTaxRate = taxRate ?? defaultTaxRate
        const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
        const taxAmount = subtotal * (actualTaxRate / 100)
        const total = subtotal + taxAmount

        // Calculate due date if not provided
        let actualDueDate = dueDate
        if (!actualDueDate) {
          const due = new Date()
          due.setDate(due.getDate() + paymentTerms)
          actualDueDate = due.toISOString().split('T')[0]
        }

        const invoice = invoicesRepo.create({
          customerName: customer.name,
          customerEmail: customer.email,
          customerAddress: customer.address,
          customerPhone: customer.phone,
          subtotal,
          taxRate: actualTaxRate,
          taxAmount,
          total,
          dueDate: actualDueDate,
          notes,
          templateId
        })

        itemsRepo.createMany(invoice.id, items)

        return {
          success: true,
          data: {
            ...invoice,
            items: itemsRepo.listByInvoice(invoice.id)
          }
        }
      } catch (err) {
        log.error('Failed to create invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_UPDATE,
    extInvoicingSchemas['ext-invoicing:invoices-update'],
    (_event, { id, customer, items, taxRate, dueDate, notes }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
        if (invoice.status !== 'draft') {
          return { success: false, error: 'Cannot update sent invoice', code: 'INVALID_STATUS' }
        }

        // Update customer info
        if (customer) {
          invoicesRepo.update(id, {
            customerName: customer.name,
            customerEmail: customer.email,
            customerAddress: customer.address,
            customerPhone: customer.phone
          })
        }

        // Update items if provided
        if (items) {
          itemsRepo.replaceForInvoice(id, items)
          const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
          const actualTaxRate = taxRate ?? invoice.tax_rate
          const taxAmount = subtotal * (actualTaxRate / 100)
          const total = subtotal + taxAmount
          invoicesRepo.update(id, { subtotal, taxRate: actualTaxRate, taxAmount, total })
        }

        if (dueDate !== undefined) invoicesRepo.update(id, { dueDate })
        if (notes !== undefined) invoicesRepo.update(id, { notes })

        return {
          success: true,
          data: {
            ...invoicesRepo.getById(id),
            items: itemsRepo.listByInvoice(id)
          }
        }
      } catch (err) {
        log.error('Failed to update invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_DELETE,
    extInvoicingSchemas['ext-invoicing:invoices-delete'],
    (_event, { id }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
        if (invoice.status !== 'draft') {
          return { success: false, error: 'Cannot delete sent invoice', code: 'INVALID_STATUS' }
        }
        invoicesRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete invoice', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Invoice Actions =====

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_SEND,
    extInvoicingSchemas['ext-invoicing:invoices-send'],
    async (_event, { id }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

        invoicesRepo.updateStatus(id, 'sent')
        // TODO: Actually send email using Phase 16 email skill

        return { success: true, data: { sent: true } }
      } catch (err) {
        log.error('Failed to send invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_MARK_PAID,
    extInvoicingSchemas['ext-invoicing:invoices-mark-paid'],
    (_event, { id, paymentMethod, paymentDate, notes }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

        const amountDue = invoice.total - invoice.amount_paid
        if (amountDue <= 0) {
          return { success: false, error: 'Invoice already paid', code: 'ALREADY_PAID' }
        }

        paymentsRepo.create({
          invoiceId: id,
          amount: amountDue,
          paymentMethod: paymentMethod ?? 'other',
          paymentDate,
          notes
        })

        invoicesRepo.updateAmountPaid(id, invoice.total)
        invoicesRepo.updateStatus(id, 'paid')

        return { success: true, data: { paid: true } }
      } catch (err) {
        log.error('Failed to mark invoice paid', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_VOID,
    extInvoicingSchemas['ext-invoicing:invoices-void'],
    (_event, { id, reason }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }
        if (invoice.status === 'paid') {
          return { success: false, error: 'Cannot void paid invoice', code: 'INVALID_STATUS' }
        }

        invoicesRepo.voidInvoice(id, reason)
        return { success: true, data: { voided: true } }
      } catch (err) {
        log.error('Failed to void invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_DOWNLOAD_PDF,
    extInvoicingSchemas['ext-invoicing:invoices-download-pdf'],
    (_event, { id }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

        const items = itemsRepo.listByInvoice(id)
        const template = invoice.template_id ? templatesRepo.getById(invoice.template_id) : null
        const settings = getSettings()

        const html = generator.generateHTML({
          invoice,
          items,
          template,
          companyInfo: {
            name: settings.get('invoicing.company-name') as string | undefined,
            email: settings.get('invoicing.company-email') as string | undefined,
            address: settings.get('invoicing.company-address') as string | undefined
          }
        })

        // Return HTML - actual PDF generation would use Phase 17 PDF skill
        return { success: true, data: { html, invoiceNumber: invoice.invoice_number } }
      } catch (err) {
        log.error('Failed to generate invoice PDF', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.INVOICES_CREATE_PAYMENT_LINK,
    extInvoicingSchemas['ext-invoicing:invoices-create-payment-link'],
    async (_event, { id }) => {
      try {
        const invoice = invoicesRepo.getById(id)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

        const amountDue = invoice.total - invoice.amount_paid
        if (amountDue <= 0) {
          return { success: false, error: 'Invoice already paid', code: 'ALREADY_PAID' }
        }

        // Call ext-stripe to create payment link
        const stripeResult = await ctx.ipc.invoke('ext-stripe:payment-links-create', {
          amount: Math.round(amountDue * 100), // Convert to cents
          currency: 'usd',
          description: `Invoice ${invoice.invoice_number}`,
          metadata: { invoiceId: id, invoiceNumber: invoice.invoice_number }
        })

        if (!stripeResult.success || !stripeResult.data) {
          return {
            success: false,
            error: stripeResult.error || 'Failed to create payment link',
            code: 'STRIPE_ERROR'
          }
        }

        const { id: linkId, url } = stripeResult.data as { id: string; url: string }
        invoicesRepo.updatePaymentLink(id, linkId, url)

        return { success: true, data: { paymentLinkUrl: url } }
      } catch (err) {
        log.error('Failed to create payment link', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Templates =====

  ipc.handle(
    EXT_INVOICING_IPC.TEMPLATES_LIST,
    extInvoicingSchemas['ext-invoicing:templates-list'],
    () => {
      try {
        return { success: true, data: templatesRepo.list() }
      } catch (err) {
        log.error('Failed to list templates', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.TEMPLATES_CREATE,
    extInvoicingSchemas['ext-invoicing:templates-create'],
    (_event, { name, logoUrl, primaryColor, headerText, footerText }) => {
      try {
        const template = templatesRepo.create({
          name,
          logoUrl,
          primaryColor,
          headerText,
          footerText
        })
        return { success: true, data: template }
      } catch (err) {
        log.error('Failed to create template', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.TEMPLATES_UPDATE,
    extInvoicingSchemas['ext-invoicing:templates-update'],
    (_event, { id, name, logoUrl, primaryColor, headerText, footerText }) => {
      try {
        templatesRepo.update(id, { name, logoUrl, primaryColor, headerText, footerText })
        return { success: true, data: templatesRepo.getById(id) }
      } catch (err) {
        log.error('Failed to update template', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.TEMPLATES_DELETE,
    extInvoicingSchemas['ext-invoicing:templates-delete'],
    (_event, { id }) => {
      try {
        templatesRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete template', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Recurring =====

  ipc.handle(
    EXT_INVOICING_IPC.RECURRING_LIST,
    extInvoicingSchemas['ext-invoicing:recurring-list'],
    (_event, { active }) => {
      try {
        return { success: true, data: recurringRepo.list({ active }) }
      } catch (err) {
        log.error('Failed to list recurring invoices', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.RECURRING_CREATE,
    extInvoicingSchemas['ext-invoicing:recurring-create'],
    (_event, { customer, items, frequency, startDate, autoSend }) => {
      try {
        const recurring = recurringRepo.create({
          customerName: customer.name,
          customerEmail: customer.email,
          customerAddress: customer.address,
          customerPhone: customer.phone,
          items,
          frequency,
          startDate,
          autoSend
        })
        return { success: true, data: recurring }
      } catch (err) {
        log.error('Failed to create recurring invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.RECURRING_UPDATE,
    extInvoicingSchemas['ext-invoicing:recurring-update'],
    (_event, { id, items, frequency, nextDate, autoSend }) => {
      try {
        recurringRepo.update(id, { items, frequency, nextDate, autoSend })
        return { success: true, data: recurringRepo.getById(id) }
      } catch (err) {
        log.error('Failed to update recurring invoice', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.RECURRING_PAUSE,
    extInvoicingSchemas['ext-invoicing:recurring-pause'],
    (_event, { id, paused }) => {
      try {
        recurringRepo.setPaused(id, paused)
        return { success: true, data: { paused } }
      } catch (err) {
        log.error('Failed to pause recurring invoice', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Payments =====

  ipc.handle(
    EXT_INVOICING_IPC.PAYMENTS_LIST,
    extInvoicingSchemas['ext-invoicing:payments-list'],
    (_event, { invoiceId, limit }) => {
      try {
        return { success: true, data: paymentsRepo.list({ invoiceId, limit }) }
      } catch (err) {
        log.error('Failed to list payments', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_INVOICING_IPC.PAYMENTS_RECORD,
    extInvoicingSchemas['ext-invoicing:payments-record'],
    (_event, { invoiceId, amount, paymentMethod, paymentDate, notes }) => {
      try {
        const invoice = invoicesRepo.getById(invoiceId)
        if (!invoice) return { success: false, error: 'Invoice not found', code: 'NOT_FOUND' }

        const payment = paymentsRepo.create({
          invoiceId,
          amount,
          paymentMethod,
          paymentDate,
          notes
        })

        const totalPaid = paymentsRepo.sumByInvoice(invoiceId)
        invoicesRepo.updateAmountPaid(invoiceId, totalPaid)

        if (totalPaid >= invoice.total) {
          invoicesRepo.updateStatus(invoiceId, 'paid')
        }

        return { success: true, data: payment }
      } catch (err) {
        log.error('Failed to record payment', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Dashboard =====

  ipc.handle(
    EXT_INVOICING_IPC.DASHBOARD_STATS,
    extInvoicingSchemas['ext-invoicing:dashboard-stats'],
    () => {
      try {
        const overdueInvoices = invoicesRepo.getOverdueInvoices()
        const overdueAmount = overdueInvoices.reduce(
          (sum, inv) => sum + (inv.total - inv.amount_paid),
          0
        )

        return {
          success: true,
          data: {
            totalInvoices: invoicesRepo.count(),
            draftCount: invoicesRepo.countByStatus('draft'),
            sentCount: invoicesRepo.countByStatus('sent'),
            paidCount: invoicesRepo.countByStatus('paid'),
            overdueCount: overdueInvoices.length,
            overdueAmount,
            totalPaid: paymentsRepo.sumTotal(),
            totalOutstanding: invoicesRepo.sumByStatus('sent'),
            recurringCount: recurringRepo.count(),
            upcomingRecurring: scheduler.getUpcoming(7).length
          }
        }
      } catch (err) {
        log.error('Failed to get dashboard stats', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-invoicing IPC handlers registered (22 channels)')
}
