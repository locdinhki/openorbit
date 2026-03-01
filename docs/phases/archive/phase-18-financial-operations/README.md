# Phase 18: Financial Operations

**Theme:** Full financial stack — Stripe for payment processing, Plaid for bank data, invoicing for billing, and bookkeeping for expense tracking. Together they replace QuickBooks + Stripe Dashboard + FreshBooks for solopreneurs.

**Effort:** Very High | **Depends on:** Phase 16 (Email skill for invoice delivery), Phase 17 (Spreadsheet skill for exports) | **Status:** Complete

## Why This Phase

Real estate investors and solopreneurs pay $50-150/mo across QuickBooks, Stripe Dashboard, FreshBooks, and bank aggregators. This phase consolidates billing, payments, bank feeds, and bookkeeping into OpenOrbit. ext-invoicing composes with the Phase 15 PDF skill and Phase 16 Email skill for professional invoice delivery. ext-bookkeeping uses AI-assisted categorization via the existing AI provider registry.

## Components

### 18.1: ext-stripe — Stripe Payments

Direct Stripe API integration for payment processing.

- Create payment links and checkout sessions
- Track payments, refunds, disputes
- Customer management (sync with ext-ghl contacts)
- Subscription management for recurring services
- Revenue dashboard with MRR, churn, LTV metrics
- Webhook listener for real-time payment events
- **IPC channels:** ~12 (payments, customers, subscriptions, dashboard)
- **DB tables:** `stripe_customers`, `stripe_payments`, `stripe_subscriptions`

### 18.2: ext-plaid — Bank Account Connections

Plaid API integration for bank data access.

- Connect bank accounts via Plaid Link
- Auto-import transactions
- Account balance monitoring
- Feed data into ext-bookkeeping for categorization
- **IPC channels:** ~6 (link, accounts, transactions, sync)
- **DB tables:** `plaid_accounts`, `plaid_transactions`
- **Note:** Data source extension — best paired with ext-bookkeeping

### 18.3: ext-invoicing — Invoicing & Payments

Professional invoicing with payment tracking.

- Invoice templates with business branding (via Phase 15 PDF skill)
- Auto-generate from GHL contacts/opportunities
- Status tracking: draft → sent → viewed → paid → overdue
- Automated payment reminders (via Phase 16 Email skill)
- Recurring invoices for retainer clients
- Payment integration (ext-stripe for online payment links)
- Tax calculation and summary
- **IPC channels:** ~12 (invoice CRUD, send, status, payment, recurring)
- **DB tables:** `invoices`, `invoice_items`, `payments`
- **UI:** Sidebar (invoice list + quick create), Workspace (invoice editor + payment dashboard)

### 18.4: ext-bookkeeping — Expense & Income Tracking

Lightweight accounting for solopreneurs.

- Transaction import via ext-plaid (bank feed sync)
- AI-assisted categorization (via existing AI providers)
- Income/expense tracking with categories
- Profit & loss, cash flow reports
- Receipt capture via Phase 17 OCR skill
- Tax-ready reports (Schedule C, 1099 tracking)
- Export to QuickBooks/CSV (via Phase 17 Spreadsheet skill)
- **IPC channels:** ~12 (transaction CRUD, categories, reports, sync)
- **DB tables:** `transactions`, `categories`, `accounts`, `receipts`
- **UI:** Sidebar (recent transactions + quick add), Workspace (P&L dashboard)

## New Dependencies

| Package | Purpose |
|---------|---------|
| `stripe` | Stripe API SDK |
| `plaid` | Plaid API SDK |

## After Phase 18, OpenOrbit Is...

A platform with a complete financial stack — payment processing (Stripe), bank data (Plaid), professional invoicing with automated delivery, and AI-assisted bookkeeping with tax-ready reports — replacing $50-150/mo in SaaS tools for solopreneurs.
