// ============================================================================
// ext-stripe — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { SettingsRepo } from '@openorbit/core/db/settings-repo'
import { EXT_STRIPE_IPC } from '../ipc-channels'
import { extStripeSchemas } from '../ipc-schemas'
import { StripeClient } from './sdk/client'
import { StripeCustomersRepo } from './db/customers-repo'
import { StripePaymentsRepo } from './db/payments-repo'
import { StripeSubscriptionsRepo } from './db/subscriptions-repo'
import { StripePaymentLinksRepo } from './db/payment-links-repo'

let stripeClient: StripeClient | null = null

function getSettings(): SettingsRepo {
  return new SettingsRepo()
}

function getStripeClient(): StripeClient {
  if (!stripeClient) {
    const settings = getSettings()
    const secretKey = settings.get('stripe.secret-key') as string | null
    if (!secretKey) throw new Error('Stripe secret key not configured')
    stripeClient = new StripeClient(secretKey)
  }
  return stripeClient
}

function resetStripeClient(): void {
  stripeClient = null
}

export function registerExtStripeHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const customersRepo = new StripeCustomersRepo(db)
  const paymentsRepo = new StripePaymentsRepo(db)
  const subsRepo = new StripeSubscriptionsRepo(db)
  const linksRepo = new StripePaymentLinksRepo(db)

  // ===== Settings =====

  ipc.handle(EXT_STRIPE_IPC.SETTINGS_GET, extStripeSchemas['ext-stripe:settings-get'], () => {
    try {
      const settings = getSettings()
      const secretKey = settings.get('stripe.secret-key') as string | null
      const webhookSecret = settings.get('stripe.webhook-secret') as string | null
      return {
        success: true,
        data: {
          hasSecretKey: !!secretKey,
          secretKeyPreview: secretKey ? `${secretKey.slice(0, 7)}...${secretKey.slice(-4)}` : null,
          hasWebhookSecret: !!webhookSecret
        }
      }
    } catch (err) {
      log.error('Failed to get settings', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_STRIPE_IPC.SETTINGS_SET,
    extStripeSchemas['ext-stripe:settings-set'],
    (_event, { secretKey, webhookSecret }) => {
      try {
        const settings = getSettings()
        if (secretKey !== undefined) settings.set('stripe.secret-key', secretKey)
        if (webhookSecret !== undefined) settings.set('stripe.webhook-secret', webhookSecret)
        resetStripeClient()
        return { success: true, data: { saved: true } }
      } catch (err) {
        log.error('Failed to save settings', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.CONNECTION_TEST,
    extStripeSchemas['ext-stripe:connection-test'],
    async () => {
      try {
        const client = getStripeClient()
        const balance = await client.getBalance()
        return {
          success: true,
          data: {
            connected: true,
            liveMode: balance.livemode,
            availableBalance: balance.available?.[0]?.amount ?? 0,
            currency: balance.available?.[0]?.currency ?? 'usd'
          }
        }
      } catch (err) {
        log.error('Connection test failed', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Customers =====

  ipc.handle(
    EXT_STRIPE_IPC.CUSTOMERS_LIST,
    extStripeSchemas['ext-stripe:customers-list'],
    (_event, { query, limit, offset }) => {
      try {
        const customers = customersRepo.list({ query, limit, offset })
        return { success: true, data: customers }
      } catch (err) {
        log.error('Failed to list customers', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.CUSTOMERS_GET,
    extStripeSchemas['ext-stripe:customers-get'],
    (_event, { id }) => {
      try {
        const customer = customersRepo.getById(id)
        if (!customer) return { success: false, error: 'Customer not found', code: 'NOT_FOUND' }
        return { success: true, data: customer }
      } catch (err) {
        log.error('Failed to get customer', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.CUSTOMERS_CREATE,
    extStripeSchemas['ext-stripe:customers-create'],
    async (_event, { email, name, phone, metadata }) => {
      try {
        const client = getStripeClient()
        const customer = await client.createCustomer({ email, name, phone, metadata })
        customersRepo.upsert(customer)
        return { success: true, data: customer }
      } catch (err) {
        log.error('Failed to create customer', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.CUSTOMERS_SYNC,
    extStripeSchemas['ext-stripe:customers-sync'],
    async () => {
      try {
        const client = getStripeClient()
        let synced = 0
        let startingAfter: string | undefined

        while (true) {
          const result = await client.listCustomers({ limit: 100, startingAfter })
          for (const customer of result.data) {
            customersRepo.upsert(customer)
            synced++
          }
          ipc.push(EXT_STRIPE_IPC.SYNC_PROGRESS, {
            type: 'customers',
            synced,
            hasMore: result.has_more
          })
          if (!result.has_more) break
          startingAfter = result.data[result.data.length - 1]?.id
        }

        return { success: true, data: { synced } }
      } catch (err) {
        log.error('Failed to sync customers', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Payments =====

  ipc.handle(
    EXT_STRIPE_IPC.PAYMENTS_LIST,
    extStripeSchemas['ext-stripe:payments-list'],
    (_event, { customerId, limit }) => {
      try {
        const payments = paymentsRepo.list({ customerId, limit })
        return { success: true, data: payments }
      } catch (err) {
        log.error('Failed to list payments', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.PAYMENTS_SYNC,
    extStripeSchemas['ext-stripe:payments-sync'],
    async () => {
      try {
        const client = getStripeClient()
        let synced = 0
        let startingAfter: string | undefined

        while (true) {
          const result = await client.listPaymentIntents({ limit: 100, startingAfter })
          for (const payment of result.data) {
            paymentsRepo.upsert(payment)
            synced++
          }
          ipc.push(EXT_STRIPE_IPC.SYNC_PROGRESS, {
            type: 'payments',
            synced,
            hasMore: result.has_more
          })
          if (!result.has_more) break
          startingAfter = result.data[result.data.length - 1]?.id
        }

        return { success: true, data: { synced } }
      } catch (err) {
        log.error('Failed to sync payments', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.PAYMENTS_REFUND,
    extStripeSchemas['ext-stripe:payments-refund'],
    async (_event, { paymentIntentId, amount }) => {
      try {
        const client = getStripeClient()
        const refund = await client.refundPayment(paymentIntentId, amount)
        return { success: true, data: refund }
      } catch (err) {
        log.error('Failed to refund payment', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Payment Links =====

  ipc.handle(
    EXT_STRIPE_IPC.PAYMENT_LINKS_CREATE,
    extStripeSchemas['ext-stripe:payment-links-create'],
    async (_event, { amount, currency, description, metadata }) => {
      try {
        const client = getStripeClient()
        const link = await client.createPaymentLink({
          amount,
          currency: currency ?? 'usd',
          description,
          metadata
        })
        linksRepo.insert(link, amount, description)
        return { success: true, data: { id: link.id, url: link.url } }
      } catch (err) {
        log.error('Failed to create payment link', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_STRIPE_IPC.PAYMENT_LINKS_LIST,
    extStripeSchemas['ext-stripe:payment-links-list'],
    (_event, { active, limit }) => {
      try {
        const links = linksRepo.list({ active, limit })
        return { success: true, data: links }
      } catch (err) {
        log.error('Failed to list payment links', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Subscriptions =====

  ipc.handle(
    EXT_STRIPE_IPC.SUBS_LIST,
    extStripeSchemas['ext-stripe:subs-list'],
    (_event, { customerId, status, limit }) => {
      try {
        const subs = subsRepo.list({ customerId, status, limit })
        return { success: true, data: subs }
      } catch (err) {
        log.error('Failed to list subscriptions', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_STRIPE_IPC.SUBS_SYNC, extStripeSchemas['ext-stripe:subs-sync'], async () => {
    try {
      const client = getStripeClient()
      let synced = 0
      let startingAfter: string | undefined

      while (true) {
        const result = await client.listSubscriptions({ limit: 100, startingAfter })
        for (const sub of result.data) {
          subsRepo.upsert(sub)
          synced++
        }
        ipc.push(EXT_STRIPE_IPC.SYNC_PROGRESS, {
          type: 'subscriptions',
          synced,
          hasMore: result.has_more
        })
        if (!result.has_more) break
        startingAfter = result.data[result.data.length - 1]?.id
      }

      return { success: true, data: { synced } }
    } catch (err) {
      log.error('Failed to sync subscriptions', err)
      return errorToResponse(err)
    }
  })

  ipc.handle(
    EXT_STRIPE_IPC.SUBS_CANCEL,
    extStripeSchemas['ext-stripe:subs-cancel'],
    async (_event, { subscriptionId, cancelAtPeriodEnd }) => {
      try {
        const client = getStripeClient()
        const sub = await client.cancelSubscription(subscriptionId, cancelAtPeriodEnd)
        subsRepo.upsert(sub)
        return { success: true, data: sub }
      } catch (err) {
        log.error('Failed to cancel subscription', err)
        return errorToResponse(err)
      }
    }
  )

  // ===== Dashboard Metrics =====

  ipc.handle(
    EXT_STRIPE_IPC.DASHBOARD_METRICS,
    extStripeSchemas['ext-stripe:dashboard-metrics'],
    (_event, { startDate, endDate }) => {
      try {
        const now = new Date()
        const start = startDate ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const end = endDate ?? now.toISOString()

        const totalCustomers = customersRepo.count()
        const totalPayments = paymentsRepo.count()
        const totalRevenue = paymentsRepo.sumByStatus('succeeded')
        const periodRevenue = paymentsRepo.sumByDateRange(start, end)
        const periodPaymentCount = paymentsRepo.countByDateRange(start, end)
        const activeSubscriptions = subsRepo.countByStatus('active')
        const mrr = subsRepo.getMRR()
        const totalSubscriptions = subsRepo.count()

        return {
          success: true,
          data: {
            totalCustomers,
            totalPayments,
            totalRevenue,
            periodRevenue,
            periodPaymentCount,
            activeSubscriptions,
            totalSubscriptions,
            mrr,
            startDate: start,
            endDate: end
          }
        }
      } catch (err) {
        log.error('Failed to get dashboard metrics', err)
        return errorToResponse(err)
      }
    }
  )

  log.info('ext-stripe IPC handlers registered (16 channels)')
}
