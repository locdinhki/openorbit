# Phase 20: Marketing & Business Intelligence

**Theme:** Marketing automation (email campaigns, social media scheduling), calendar sync with booking links, and a unified business dashboard pulling KPIs from every installed extension. The capstone phase that ties all extensions into a single-pane-of-glass view.

**Effort:** Very High | **Depends on:** Phase 16 (Email skill), Phase 18 (ext-invoicing, ext-stripe) | **Status:** Not started

## Why This Phase

With deals, properties, invoices, bookkeeping, and documents in place, the final layer is outbound marketing and unified visibility. Email campaigns and social scheduling drive lead generation. Calendar sync handles appointment booking. The dashboard is the capstone — a customizable widget grid showing revenue, leads, pipeline value, portfolio equity, and AI-generated business summaries from every extension.

## Components

### 20.1: ext-email-marketing — Email Campaigns & Sequences

Drip email campaigns with tracking and analytics.

- Contact list import from ext-ghl
- Segment contacts by tags, status, custom fields
- Drip sequence builder with triggers (new lead, form submit, time delay)
- HTML email template editor with merge fields
- Open/click tracking (pixel + link wrapping)
- Unsubscribe management
- Campaign analytics dashboard
- **IPC channels:** ~15 (campaign CRUD, sequence builder, send, analytics)
- **DB tables:** `campaigns`, `sequences`, `sequence_steps`, `email_events`
- **UI:** Sidebar (campaign list), Workspace (sequence builder + analytics)
- **Inspiration:** Mailchimp, ConvertKit — both $15-50/mo for small lists

### 20.2: ext-social — Social Media Scheduler

Multi-platform social media management.

- Multi-platform posting: X (Twitter), LinkedIn, Instagram, Facebook
- Content calendar view (day/week/month)
- AI-assisted caption and hashtag generation (via existing AI providers)
- Image/video attachment support
- Post queue with scheduling
- Basic engagement metrics per platform
- Content library for reusable templates
- **IPC channels:** ~12 (post CRUD, schedule, publish, analytics)
- **DB tables:** `social_posts`, `social_accounts`, `post_analytics`
- **UI:** Sidebar (post queue + quick compose), Workspace (content calendar)
- **APIs:** Twitter/X API, LinkedIn API, Meta Graph API

### 20.3: ext-calendar — Calendar Sync & Scheduling

Google/Outlook calendar integration with booking links.

- Two-way sync with Google Calendar and/or Outlook
- Booking link generation (like Cal.com/Calendly)
- Auto-suggest available meeting times
- Link calendar events to GHL contacts/opportunities
- Appointment reminders (via Phase 16 Email/SMS skills)
- Daily agenda view in sidebar
- **IPC channels:** ~10 (sync, events CRUD, booking, availability)
- **DB tables:** `calendar_events`, `booking_links`, `calendar_accounts`
- **UI:** Sidebar (daily agenda + quick add), Workspace (weekly calendar view)
- **Note:** ext-ghl already has basic calendar via GHL's API — this is standalone for personal/business use

### 20.4: ext-dashboard — Unified Business Dashboard

Capstone extension tying all extensions into one view.

- Customizable widget grid pulling KPIs from all installed extensions
- Revenue (ext-invoicing/ext-stripe), leads (ext-ghl), pipeline value (ext-ghl), properties (ext-portfolio)
- Daily/weekly AI-generated business summary (via AI providers)
- Goal tracking and trends
- Alerting rules (revenue drop, overdue invoice, new high-value lead)
- **IPC channels:** ~8 (widgets, summary, alerts, goals)
- **DB tables:** `dashboard_widgets`, `dashboard_goals`
- **UI:** Full workspace takeover — widget grid layout

## After Phase 20, OpenOrbit Is...

A complete business operating system for real estate investors and solopreneurs — with deal analysis, property management, CRM, invoicing, bookkeeping, document management, email marketing, social media scheduling, calendar booking, and a unified dashboard with AI-generated business intelligence. All composable, all local-first, all replacing $200+/mo in SaaS subscriptions.
