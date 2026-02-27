# Research Ideas

> Staging area for potential features and extensions. When an idea is promoted to a roadmap phase, remove it from here and add it to `roadmap.md`.

---

## Skills (Generic, Reusable Capabilities)

Skills are horizontal building blocks — not tied to any specific service or API. Any extension can compose them.

### PDF Generation & Review

Create, edit, and review PDFs programmatically.

**Use cases:** Invoice generation, deal analysis reports, property comp packages, contract templates, cover letters.

**Approach:**
- Use `pdf-lib` (TypeScript-native) or `pdfkit` for generation
- Template system with merge fields pulled from any extension's data
- Preview rendering in workspace panel
- Export to file or send via email/SMS skill

**Composes with:** ext-ghl (contact/deal data → PDF), ext-zillow (comp data → report), ext-jobs (resume → PDF)

---

### Spreadsheet / CSV

Create, edit, and analyze spreadsheets.

**Use cases:** Financial reports, comp analysis exports, bulk contact imports/exports, tax prep data.

**Approach:**
- Use `xlsx` or `exceljs` for .xlsx read/write
- CSV import/export (already partially exists in ext-db-viewer)
- Tabular data viewer in workspace panel
- Formula evaluation for basic calculations

**Composes with:** ext-zillow (export comps), ext-ghl (export contacts/pipeline), ext-jobs (export job list)

---

### Email (SMTP)

Send emails programmatically.

**Use cases:** Invoice delivery, follow-up sequences, marketing campaigns, notifications, report distribution.

**Approach:**
- `nodemailer` with SMTP config (Gmail, Outlook, custom)
- HTML template engine with merge fields
- Attachment support (PDFs, spreadsheets from other skills)
- Send tracking (basic: sent/failed status in DB)

**Composes with:** PDF skill (attach invoice), Spreadsheet skill (attach report), ext-ghl (contact email addresses)

---

### SMS / MMS

Send text messages programmatically.

**Use cases:** Appointment reminders, payment follow-ups, lead notifications, two-factor alerts.

**Approach:**
- Twilio API or generic SMS gateway
- Template system with merge fields
- Opt-in/opt-out tracking
- Delivery status tracking

**Note:** ext-ghl already has conversation/SMS via GHL's API. This skill would be for standalone SMS outside of GHL.

---

### Charts & Visualization

Generate charts and data visualizations.

**Use cases:** Pipeline funnels, P&L graphs, portfolio performance, KPI dashboards, market trends.

**Approach:**
- `chart.js` (already in renderer) or `d3` for complex visualizations
- Server-side rendering to PNG/SVG for PDF embedding
- Dashboard widget system for workspace panels

**Composes with:** ext-ghl (pipeline funnel), ext-zillow (market trend charts), Portfolio extension (equity growth)

---

### Document Generation (Templates)

Merge data into document templates to produce polished output.

**Use cases:** Lease agreements, proposals, offer letters, contracts, SOPs.

**Approach:**
- Template format: Markdown with `{{field}}` placeholders
- Data source: any extension's IPC data
- Output: PDF (via PDF skill), HTML, or plain text
- Template library stored in user data dir

**Composes with:** PDF skill (final output), ext-ghl (contact/deal merge fields), ext-zillow (property data merge)

---

### Financial Calculator

Common business and real estate financial formulas.

**Use cases:** ROI, cap rate, cash-on-cash return, mortgage amortization, DSCR, rental yield, break-even analysis.

**Approach:**
- Pure TypeScript calculation library
- Interactive calculator UI in workspace panel
- Results can feed into PDF/Spreadsheet skills
- Save calculation history to DB

**Composes with:** ext-zillow (Zestimate → ARV calc), Deal Analyzer extension, Portfolio extension

---

### OCR / Text Extraction

Extract text from images and scanned documents.

**Use cases:** Receipt scanning, business card capture, document digitization.

**Approach:**
- `tesseract.js` for local OCR (no API key needed)
- AI-assisted extraction for structured data (receipts → line items)
- Image preprocessing for better accuracy

**Composes with:** Bookkeeping extension (receipt → expense entry), ext-ghl (business card → contact)

---

### Web Scraper (Generic)

Configurable browser automation for data extraction from any website.

**Use cases:** Competitor pricing, listing monitoring, lead scraping, market research.

**Approach:**
- Extend existing Patchright/SessionManager pattern from ext-zillow
- User-configurable scrape jobs: URL pattern, selectors, schedule
- Output to DB table or CSV export
- Change detection with alerts

**Note:** ext-zillow is a domain-specific scraper. This would be a generic, user-configurable scraping framework.

---

## Extensions (Service-Specific Integrations)

Extensions are vertical integrations tied to a specific service, API, or domain.

### ext-deal-analyzer — Real Estate Deal Analysis

> **High priority** — directly leverages existing ext-zillow + ext-ghl data.

Comprehensive property deal analysis and underwriting tool.

**Features:**
- Pull Zestimate/comps from ext-zillow cache
- ROI, cap rate, cash-on-cash, DSCR calculators (via Calculator skill)
- Rehab cost estimator with line-item breakdown
- Rental income projection (monthly cash flow analysis)
- Side-by-side deal comparison (up to 4 properties)
- Export deal package as PDF (via PDF skill)
- Link deals to GHL opportunities (via ext-ghl)

**IPC channels:** ~10 (deal CRUD, calculation, comparison, export)
**DB tables:** `deals`, `deal_comps`, `deal_expenses`
**UI:** Sidebar (deal list + quick calc), Workspace (full analysis dashboard)

**Inspiration:** [DealCheck](https://dealcheck.io/), [Privy Pro](https://www.privy.pro/) — both charge $20-50/mo

---

### ext-portfolio — Property Portfolio Tracker

Track owned properties, equity, and financial performance.

**Features:**
- Property registry with purchase price, mortgage details, current value (auto-update from Zillow)
- Rental income and expense tracking per property
- Mortgage amortization schedules
- Maintenance request log
- Tenant info management
- Portfolio-level P&L, net worth, equity growth dashboard
- Monthly/annual reporting (via PDF + Spreadsheet skills)

**IPC channels:** ~15 (property CRUD, tenant CRUD, transaction CRUD, reports)
**DB tables:** `properties`, `tenants`, `property_transactions`, `maintenance_requests`
**UI:** Sidebar (property list), Workspace (portfolio dashboard with charts)

**Inspiration:** [Baselane](https://www.baselane.com/), Stessa

---

### ext-invoicing — Invoicing & Payments

Create, send, and track invoices.

**Features:**
- Professional invoice templates with business branding
- Auto-generate from GHL contacts/opportunities
- Track status: draft → sent → viewed → paid → overdue
- Automated payment reminders (via Email skill)
- Recurring invoices for retainer clients
- Payment integration (Stripe API for online payment links)
- Tax calculation and summary

**IPC channels:** ~12 (invoice CRUD, send, status, payment, recurring)
**DB tables:** `invoices`, `invoice_items`, `payments`
**UI:** Sidebar (invoice list + quick create), Workspace (invoice editor + payment dashboard)

---

### ext-bookkeeping — Expense & Income Tracking

Lightweight accounting for solopreneurs.

**Features:**
- Transaction import via Plaid API (bank feed sync)
- AI-assisted categorization (leverage existing AI providers)
- Income/expense tracking with categories
- Profit & loss, cash flow reports
- Receipt capture via OCR skill
- Tax-ready reports (Schedule C, 1099 tracking)
- Export to QuickBooks/CSV (via Spreadsheet skill)

**IPC channels:** ~12 (transaction CRUD, categories, reports, sync)
**DB tables:** `transactions`, `categories`, `accounts`, `receipts`
**UI:** Sidebar (recent transactions + quick add), Workspace (P&L dashboard)

**Note:** Could also be `ext-quickbooks` if full QuickBooks API integration is preferred over a standalone tracker.

---

### ext-email-marketing — Email Campaigns & Sequences

Build and send email campaigns with drip sequences.

**Features:**
- Contact list import from ext-ghl
- Segment contacts by tags, status, custom fields
- Drip sequence builder with triggers (new lead, form submit, time delay)
- HTML email template editor with merge fields
- Open/click tracking (pixel + link wrapping)
- Unsubscribe management
- Campaign analytics dashboard

**IPC channels:** ~15 (campaign CRUD, sequence builder, send, analytics)
**DB tables:** `campaigns`, `sequences`, `sequence_steps`, `email_events`
**UI:** Sidebar (campaign list), Workspace (sequence builder + analytics)

**Inspiration:** Mailchimp, ConvertKit — both $15-50/mo for small lists

---

### ext-social — Social Media Scheduler

Compose and schedule posts across platforms.

**Features:**
- Multi-platform posting: X (Twitter), LinkedIn, Instagram, Facebook
- Content calendar view (day/week/month)
- AI-assisted caption and hashtag generation (via AI providers)
- Image/video attachment support
- Post queue with scheduling
- Basic engagement metrics per platform
- Content library for reusable templates

**IPC channels:** ~12 (post CRUD, schedule, publish, analytics)
**DB tables:** `social_posts`, `social_accounts`, `post_analytics`
**UI:** Sidebar (post queue + quick compose), Workspace (content calendar)

**APIs:** Twitter/X API, LinkedIn API, Meta Graph API

---

### ext-calendar — Calendar Sync & Scheduling

Google/Outlook calendar integration with booking links.

**Features:**
- Two-way sync with Google Calendar and/or Outlook
- Booking link generation (like Cal.com/Calendly)
- Auto-suggest available meeting times
- Link calendar events to GHL contacts/opportunities
- Appointment reminders (via Email/SMS skills)
- Daily agenda view in sidebar

**IPC channels:** ~10 (sync, events CRUD, booking, availability)
**DB tables:** `calendar_events`, `booking_links`, `calendar_accounts`
**UI:** Sidebar (daily agenda + quick add), Workspace (weekly calendar view)

**Note:** ext-ghl already has basic calendar support via GHL's API. This would be a standalone calendar for personal/business use outside GHL.

---

### ext-docs — Document & Contract Management

Store, organize, and generate documents.

**Features:**
- File storage organized by contact/deal/property
- Template-based generation with merge fields from CRM data
- E-signature integration (DocuSign or HelloSign API)
- Version tracking
- Expiration tracking and renewal reminders
- Search across all stored documents

**IPC channels:** ~10 (document CRUD, template, sign, search)
**DB tables:** `documents`, `document_templates`, `signature_requests`
**UI:** Sidebar (document browser), Workspace (document viewer + template editor)

---

### ext-stripe — Stripe Payments

Direct Stripe API integration for payment processing.

**Features:**
- Create payment links and checkout sessions
- Track payments, refunds, disputes
- Customer management (sync with ext-ghl contacts)
- Subscription management for recurring services
- Revenue dashboard with MRR, churn, LTV metrics
- Webhook listener for real-time payment events

**IPC channels:** ~12 (payments, customers, subscriptions, dashboard)
**DB tables:** `stripe_customers`, `stripe_payments`, `stripe_subscriptions`

---

### ext-plaid — Bank Account Connections

Plaid API integration for bank data access.

**Features:**
- Connect bank accounts via Plaid Link
- Auto-import transactions
- Account balance monitoring
- Feed data into ext-bookkeeping for categorization

**IPC channels:** ~6 (link, accounts, transactions, sync)
**DB tables:** `plaid_accounts`, `plaid_transactions`

**Note:** This is a data source extension — best paired with ext-bookkeeping.

---

### ext-redfin — Redfin Property Data

Redfin listings, comps, and market data.

**Features:**
- Property search by address/MLS
- Comp analysis (similar to ext-zillow but Redfin data)
- Market trend data (median price, days on market, inventory)
- Cross-reference with ext-zillow for data triangulation

**IPC channels:** ~6 (search, property detail, comps, market data)
**DB tables:** `redfin_cache`

---

### ext-dashboard — Unified Business Dashboard

> Ties all extensions together into a single-pane-of-glass view.

**Features:**
- Customizable widget grid pulling KPIs from all installed extensions
- Revenue (ext-invoicing/ext-stripe), leads (ext-ghl), pipeline value (ext-ghl), properties (ext-portfolio)
- Daily/weekly AI-generated business summary (via AI providers)
- Goal tracking and trends
- Alerting rules (revenue drop, overdue invoice, new high-value lead)

**IPC channels:** ~8 (widgets, summary, alerts, goals)
**DB tables:** `dashboard_widgets`, `dashboard_goals`
**UI:** Full workspace takeover — widget grid layout

---

### ext-voip — Call Tracking & VoIP

Click-to-call with recording and transcription.

**Features:**
- Click-to-call from any contact record
- Call recording with AI transcription (via AI providers)
- Call log linked to CRM contacts
- Virtual phone number management (Twilio Voice API)
- Call analytics (duration, outcome tracking)

**IPC channels:** ~8 (call, record, transcribe, log)
**DB tables:** `calls`, `call_recordings`

---

## Composition Examples

Show how skills + extensions combine to create powerful workflows:

| Workflow | Extensions + Skills Used |
|----------|------------------------|
| Generate and email a deal analysis PDF | ext-zillow + ext-ghl + Calculator skill + PDF skill + Email skill |
| Export pipeline contacts to Excel | ext-ghl + Spreadsheet skill |
| Auto-invoice when GHL opportunity closes | ext-ghl + ext-invoicing + PDF skill + Email skill |
| Monthly portfolio performance report | ext-portfolio + ext-zillow + Charts skill + PDF skill |
| Capture receipt and categorize expense | OCR skill + ext-bookkeeping |
| Scrape competitor listings and alert | Web Scraper skill + SMS skill |
| Daily business briefing email | ext-dashboard + ext-ghl + Email skill |
