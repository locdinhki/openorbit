// ============================================================================
// ext-zillow — Zillow Scraper
//
// Adapted from go-high-level-connector test project.
// Uses shared SessionManager instead of owning its own browser context.
// ============================================================================

import type { SessionManager } from '@openorbit/core/automation/session-manager'

export interface ZillowResult {
  zestimate: number | null
  zillowUrl: string | null
  error?: string
}

export interface AddressInput {
  address1: string
  city: string
  state: string
  postalCode: string
}

function buildZillowSearchUrl(address: AddressInput): string {
  const parts = [address.address1, address.city, address.state, address.postalCode]
  const slug = parts
    .filter(Boolean)
    .join(' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '-')
  return `https://www.zillow.com/homes/${slug}_rb/`
}

export class ZillowScraper {
  constructor(private sessionManager: SessionManager) {}

  async scrape(address: AddressInput): Promise<ZillowResult> {
    const url = buildZillowSearchUrl(address)
    const page = await this.sessionManager.newPage()

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await page.waitForTimeout(3000)

      // If we landed on a search results page, click the first result
      if (!page.url().includes('/homedetails/')) {
        const firstResult = page.locator('a[data-test="property-card-link"]').first()
        try {
          await firstResult.click({ timeout: 5_000 })
          await page.waitForTimeout(3000)
        } catch {
          // No results or different page layout — continue and try to find Zestimate anyway
        }
      }

      // Extract Zestimate via page.evaluate
      const zestimate = await page.evaluate(() => {
        const priceRe = /\$(\d{1,3}(?:,\d{3})*)\b/

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
        let node: Node | null
        while ((node = walker.nextNode())) {
          const text = (node as Element).textContent?.trim() ?? ''
          if (text.length < 100 && text.includes('Zestimate') && priceRe.test(text)) {
            const match = text.match(priceRe)
            if (match) {
              const val = parseInt(match[1].replace(/,/g, ''), 10)
              if (val > 10_000 && val < 10_000_000) return val
            }
          }
        }
        // Fallback: find Zestimate button and read its sibling value
        for (const btn of document.querySelectorAll('button')) {
          if (btn.textContent?.includes('Zestimate')) {
            const sibling = btn.nextElementSibling
            const match = sibling?.textContent?.match(priceRe)
            if (match) {
              const val = parseInt(match[1].replace(/,/g, ''), 10)
              if (val > 10_000 && val < 10_000_000) return val
            }
          }
        }
        return null
      })

      return { zestimate, zillowUrl: page.url() }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { zestimate: null, zillowUrl: null, error: message }
    } finally {
      await page.close()
    }
  }
}
