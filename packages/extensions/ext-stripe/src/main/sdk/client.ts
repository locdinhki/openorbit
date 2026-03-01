// ============================================================================
// ext-stripe — Stripe SDK Wrapper
// ============================================================================

import Stripe from 'stripe'

export class StripeClient {
  private stripe: Stripe

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-11-20.acacia'
    })
  }

  // ===== Customers =====

  async listCustomers(opts?: {
    limit?: number
    startingAfter?: string
    email?: string
  }): Promise<Stripe.ApiList<Stripe.Customer>> {
    return this.stripe.customers.list({
      limit: opts?.limit ?? 100,
      starting_after: opts?.startingAfter,
      email: opts?.email
    })
  }

  async getCustomer(id: string): Promise<Stripe.Customer> {
    return this.stripe.customers.retrieve(id) as Promise<Stripe.Customer>
  }

  async createCustomer(params: {
    email: string
    name?: string
    phone?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.Customer> {
    return this.stripe.customers.create(params)
  }

  // ===== Payment Intents =====

  async listPaymentIntents(opts?: {
    limit?: number
    startingAfter?: string
    customer?: string
  }): Promise<Stripe.ApiList<Stripe.PaymentIntent>> {
    return this.stripe.paymentIntents.list({
      limit: opts?.limit ?? 100,
      starting_after: opts?.startingAfter,
      customer: opts?.customer
    })
  }

  async refundPayment(paymentIntentId: string, amount?: number): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount
    })
  }

  // ===== Payment Links =====

  async createPaymentLink(params: {
    amount: number
    currency: string
    description?: string
    metadata?: Record<string, string>
  }): Promise<Stripe.PaymentLink> {
    // First create a price for this one-time payment
    const price = await this.stripe.prices.create({
      unit_amount: params.amount,
      currency: params.currency,
      product_data: {
        name: params.description || 'Payment'
      }
    })

    return this.stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: params.metadata
    })
  }

  async listPaymentLinks(opts?: {
    active?: boolean
    limit?: number
  }): Promise<Stripe.ApiList<Stripe.PaymentLink>> {
    return this.stripe.paymentLinks.list({
      active: opts?.active,
      limit: opts?.limit ?? 100
    })
  }

  // ===== Subscriptions =====

  async listSubscriptions(opts?: {
    limit?: number
    startingAfter?: string
    customer?: string
    status?: Stripe.SubscriptionListParams.Status
  }): Promise<Stripe.ApiList<Stripe.Subscription>> {
    return this.stripe.subscriptions.list({
      limit: opts?.limit ?? 100,
      starting_after: opts?.startingAfter,
      customer: opts?.customer,
      status: opts?.status
    })
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd = true
  ): Promise<Stripe.Subscription> {
    if (cancelAtPeriodEnd) {
      return this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      })
    }
    return this.stripe.subscriptions.cancel(subscriptionId)
  }

  // ===== Balance & Metrics =====

  async getBalance(): Promise<Stripe.Balance> {
    return this.stripe.balance.retrieve()
  }

  async listBalanceTransactions(opts?: {
    limit?: number
    type?: string
    created?: { gte?: number; lte?: number }
  }): Promise<Stripe.ApiList<Stripe.BalanceTransaction>> {
    return this.stripe.balanceTransactions.list({
      limit: opts?.limit ?? 100,
      type: opts?.type as Stripe.BalanceTransactionListParams.Type,
      created: opts?.created
    })
  }
}
