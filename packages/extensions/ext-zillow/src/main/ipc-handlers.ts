// ============================================================================
// ext-zillow — IPC Handler Registration
// ============================================================================

import type { ExtensionContext } from '@openorbit/core/extensions/types'
import { errorToResponse } from '@openorbit/core/errors'
import { EXT_ZILLOW_IPC } from '../ipc-channels'
import { extZillowSchemas } from '../ipc-schemas'
import { ZillowScraper } from './scraper/zillow-scraper'
import { ArvCacheRepo } from './db/arv-cache-repo'

export function registerExtZillowHandlers(ctx: ExtensionContext): void {
  const { ipc, log, db } = ctx
  const cacheRepo = new ArvCacheRepo(db)

  // ---- Search (scrape + cache) ----

  ipc.handle(
    EXT_ZILLOW_IPC.SEARCH,
    extZillowSchemas['ext-zillow:search'],
    async (_event, { address1, city, state, postalCode }) => {
      try {
        log.info(`Zillow search: ${address1}, ${city}, ${state} ${postalCode}`)
        ctx.ipc.push(EXT_ZILLOW_IPC.SCRAPE_PROGRESS, { status: 'scraping', address: address1 })

        await ctx.services.browser.ensureReady()
        const session = ctx.services.browser.getSession()
        const scraper = new ZillowScraper(session)
        const result = await scraper.scrape({ address1, city, state, postalCode })

        // Cache the result
        const cached = cacheRepo.insert({
          address1,
          city,
          state,
          postalCode,
          zestimate: result.zestimate,
          zillowUrl: result.zillowUrl,
          error: result.error
        })

        ctx.ipc.push(EXT_ZILLOW_IPC.SCRAPE_PROGRESS, { status: 'complete', address: address1 })
        return { success: true, data: cached }
      } catch (err) {
        log.error('Zillow search failed', err)
        ctx.ipc.push(EXT_ZILLOW_IPC.SCRAPE_PROGRESS, { status: 'error', address: address1 })
        return errorToResponse(err)
      }
    }
  )

  // ---- Get ARV (cache-first, then scrape) ----

  ipc.handle(
    EXT_ZILLOW_IPC.GET_ARV,
    extZillowSchemas['ext-zillow:get-arv'],
    async (_event, { address1, city, state, postalCode }) => {
      try {
        // Check cache first
        const cached = cacheRepo.findByAddress(address1, city, state, postalCode)
        if (cached && cached.zestimate) {
          return { success: true, data: cached }
        }

        // Scrape fresh
        log.info(`Zillow ARV lookup: ${address1}, ${city}, ${state} ${postalCode}`)
        await ctx.services.browser.ensureReady()
        const session = ctx.services.browser.getSession()
        const scraper = new ZillowScraper(session)
        const result = await scraper.scrape({ address1, city, state, postalCode })

        const entry = cacheRepo.insert({
          address1,
          city,
          state,
          postalCode,
          zestimate: result.zestimate,
          zillowUrl: result.zillowUrl,
          error: result.error
        })

        return { success: true, data: entry }
      } catch (err) {
        log.error('Zillow ARV lookup failed', err)
        return errorToResponse(err)
      }
    }
  )

  // ---- Cache management ----

  ipc.handle(
    EXT_ZILLOW_IPC.CACHE_LIST,
    extZillowSchemas['ext-zillow:cache-list'],
    (_event, { limit }) => {
      try {
        return { success: true, data: cacheRepo.list(limit) }
      } catch (err) {
        log.error('Failed to list ARV cache', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(
    EXT_ZILLOW_IPC.CACHE_DELETE,
    extZillowSchemas['ext-zillow:cache-delete'],
    (_event, { id }) => {
      try {
        cacheRepo.delete(id)
        return { success: true, data: { deleted: true } }
      } catch (err) {
        log.error('Failed to delete ARV cache entry', err)
        return errorToResponse(err)
      }
    }
  )

  ipc.handle(EXT_ZILLOW_IPC.CACHE_PURGE, extZillowSchemas['ext-zillow:cache-purge'], () => {
    try {
      const count = cacheRepo.purge()
      return { success: true, data: { purged: count } }
    } catch (err) {
      log.error('Failed to purge ARV cache', err)
      return errorToResponse(err)
    }
  })

  log.info('ext-zillow IPC handlers registered (5 channels)')
}
