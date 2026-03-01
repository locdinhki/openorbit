# Phase 19: Portfolio & Market Intelligence

**Theme:** Property portfolio tracking, a second real estate data source (Redfin), and a generic web scraper. Builds on Phase 15 deal analyzer to track owned properties over time and triangulate market data across sources.

**Effort:** High | **Depends on:** Phase 15 (ext-deal-analyzer, financial formulas, PDF/Charts skills) | **Status:** Not started

## Why This Phase

Phase 15 analyzes deals before purchase. This phase tracks properties after purchase — equity growth, rental P&L, maintenance, tenants. ext-redfin adds a second data source for comps and market trends, cross-referenced with ext-zillow. The generic web scraper extends the existing Patchright/SessionManager pattern for arbitrary data extraction beyond Zillow/Redfin.

## Components

### 19.1: ext-portfolio — Property Portfolio Tracker

Full extension for tracking owned properties.

- Property registry with purchase price, mortgage details, current value (auto-update from ext-zillow)
- Rental income and expense tracking per property
- Mortgage amortization schedules (via Phase 15 financial formulas)
- Maintenance request log
- Tenant info management
- Portfolio-level P&L, net worth, equity growth dashboard
- Monthly/annual reporting (via Phase 15 PDF + Phase 17 Spreadsheet skills)
- **IPC channels:** ~15 (property CRUD, tenant CRUD, transaction CRUD, reports)
- **DB tables:** `properties`, `tenants`, `property_transactions`, `maintenance_requests`
- **UI:** Sidebar (property list), Workspace (portfolio dashboard with charts)
- **Inspiration:** [Baselane](https://www.baselane.com/), Stessa

### 19.2: ext-redfin — Redfin Property Data

Second property data source for market intelligence.

- Property search by address/MLS
- Comp analysis (similar to ext-zillow but Redfin data)
- Market trend data (median price, days on market, inventory)
- Cross-reference with ext-zillow for data triangulation
- **IPC channels:** ~6 (search, property detail, comps, market data)
- **DB tables:** `redfin_cache`

### 19.3: Web Scraper (Generic) Skill

Built-in tool skill for configurable browser automation.

- Extends existing Patchright/SessionManager pattern from ext-zillow
- User-configurable scrape jobs: URL pattern, CSS selectors, schedule
- Output to DB table or CSV export
- Change detection with alerts
- Skill id: `web-scrape`, category: `utility`
- **Note:** ext-zillow/ext-redfin are domain-specific scrapers. This is a generic, user-configurable scraping framework.

## After Phase 19, OpenOrbit Is...

A platform that tracks the full real estate lifecycle — from deal analysis (Phase 15) through owned property management, with multi-source market intelligence (Zillow + Redfin) and generic data extraction for any website.
