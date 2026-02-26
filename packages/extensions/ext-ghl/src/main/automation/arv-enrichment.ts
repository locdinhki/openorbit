// ============================================================================
// ext-ghl — ARV Enrichment Runner
//
// Scrapes Zillow Zestimate for pipeline contacts and writes back to GHL.
// Uses ext-zillow's ZillowScraper for cross-extension data sharing.
// ============================================================================

import type { SessionManager } from '@openorbit/core/automation/session-manager'
import { createLogger } from '@openorbit/core/utils/logger'
import {
  ZillowScraper,
  type AddressInput,
  type ZillowResult
} from '@openorbit/ext-zillow/main/scraper/zillow-scraper'
import { ArvCacheRepo } from '@openorbit/ext-zillow/main/db/arv-cache-repo'
import type { GoHighLevel } from '../sdk/index'
import type Database from 'better-sqlite3'

const log = createLogger('ext:ghl:arv')

const DELAY_MIN_MS = 5_000
const DELAY_MAX_MS = 10_000

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function randomDelay(): number {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS)) + DELAY_MIN_MS
}

export interface ArvEnrichmentConfig {
  pipelineName: string
  arvFieldName: string
  force?: boolean
}

export interface ArvRunRow {
  id: string
  pipeline_id: string
  pipeline_name: string
  total: number
  enriched: number
  skipped: number
  errors: number
  status: string
  started_at: string
  finished_at: string | null
}

export interface ArvEnrichmentProgress {
  runId: string
  current: number
  total: number
  enriched: number
  skipped: number
  errors: number
  currentContact: string | null
  status: 'running' | 'completed' | 'failed'
}

export class ArvRunsRepo {
  constructor(private db: Database.Database) {}

  insert(data: { id: string; pipelineId: string; pipelineName: string; total: number }): void {
    this.db
      .prepare(
        `INSERT INTO ghl_arv_runs (id, pipeline_id, pipeline_name, total, enriched, skipped, errors, status)
         VALUES (?, ?, ?, ?, 0, 0, 0, 'running')`
      )
      .run(data.id, data.pipelineId, data.pipelineName, data.total)
  }

  updateProgress(id: string, enriched: number, skipped: number, errors: number): void {
    this.db
      .prepare('UPDATE ghl_arv_runs SET enriched = ?, skipped = ?, errors = ? WHERE id = ?')
      .run(enriched, skipped, errors, id)
  }

  finish(id: string, status: 'completed' | 'failed'): void {
    this.db
      .prepare("UPDATE ghl_arv_runs SET status = ?, finished_at = datetime('now') WHERE id = ?")
      .run(status, id)
  }

  getById(id: string): ArvRunRow | null {
    return (
      (this.db.prepare('SELECT * FROM ghl_arv_runs WHERE id = ?').get(id) as
        | ArvRunRow
        | undefined) ?? null
    )
  }

  listRecent(limit = 10): ArvRunRow[] {
    return this.db
      .prepare('SELECT * FROM ghl_arv_runs ORDER BY started_at DESC LIMIT ?')
      .all(limit) as ArvRunRow[]
  }

  getRunning(): ArvRunRow | null {
    return (
      (this.db.prepare("SELECT * FROM ghl_arv_runs WHERE status = 'running' LIMIT 1").get() as
        | ArvRunRow
        | undefined) ?? null
    )
  }
}

export class ArvEnrichmentRunner {
  private running = false
  private currentRunId: string | null = null

  constructor(
    private ghl: () => GoHighLevel,
    private locationId: () => string,
    private sessionManager: () => SessionManager,
    private db: Database.Database,
    private onProgress?: (progress: ArvEnrichmentProgress) => void
  ) {}

  isRunning(): boolean {
    return this.running
  }

  getCurrentRunId(): string | null {
    return this.currentRunId
  }

  async run(config: ArvEnrichmentConfig): Promise<ArvEnrichmentProgress> {
    if (this.running) {
      throw new Error('ARV enrichment is already running')
    }

    this.running = true
    const runsRepo = new ArvRunsRepo(this.db)
    const cacheRepo = new ArvCacheRepo(this.db)
    const runId = crypto.randomUUID()
    this.currentRunId = runId

    let enriched = 0
    let skipped = 0
    let errors = 0
    let total = 0

    try {
      const ghl = this.ghl()
      const locId = this.locationId()

      // Step 1: Ensure ARV custom field exists
      log.info(`Ensuring "${config.arvFieldName}" custom field exists...`)
      const arvField = await ghl.customFields.findOrCreate(locId, config.arvFieldName, 'MONETORY')
      log.info(`ARV field ID: ${arvField.id}`)

      // Step 2: Find pipeline
      log.info(`Fetching pipelines...`)
      const { pipelines } = await ghl.opportunities.getPipelines(locId)
      const pipeline = pipelines.find((p) => p.name === config.pipelineName)
      if (!pipeline) {
        throw new Error(`Pipeline "${config.pipelineName}" not found`)
      }
      log.info(`Found pipeline: ${pipeline.name} (${pipeline.id})`)

      // Step 3: Fetch all opportunities
      log.info(`Fetching opportunities from pipeline "${pipeline.name}"...`)
      const oppsRes = await ghl.opportunities.search({
        location_id: locId,
        pipeline_id: pipeline.id,
        limit: 100
      })
      const allOpps = oppsRes.opportunities
      total = allOpps.length
      log.info(`Found ${total} opportunities`)

      // Record the run
      runsRepo.insert({ id: runId, pipelineId: pipeline.id, pipelineName: pipeline.name, total })

      // Step 4: Get session and create scraper
      const session = this.sessionManager()
      const scraper = new ZillowScraper(session)

      // Step 5: Process each opportunity
      const processedContacts = new Set<string>()

      for (let i = 0; i < allOpps.length; i++) {
        const opp = allOpps[i]
        log.info(`[${i + 1}/${total}] ${opp.name}`)

        // Skip duplicate contacts
        if (processedContacts.has(opp.contactId)) {
          log.info(`  SKIP: Contact already processed in this run`)
          skipped++
          this.emitProgress(runId, i + 1, total, enriched, skipped, errors, opp.name, 'running')
          runsRepo.updateProgress(runId, enriched, skipped, errors)
          continue
        }
        processedContacts.add(opp.contactId)

        // Fetch contact
        const { contact } = await ghl.contacts.get(opp.contactId)

        // Check existing ARV
        if (!config.force) {
          const existingArv = contact.customFields?.find((cf) => cf.id === arvField.id)
          if (existingArv?.value) {
            log.info(`  SKIP: Already has ARV = ${existingArv.value}`)
            skipped++
            this.emitProgress(runId, i + 1, total, enriched, skipped, errors, opp.name, 'running')
            runsRepo.updateProgress(runId, enriched, skipped, errors)
            continue
          }
        }

        // Validate address
        if (!contact.address1 || !contact.city || !contact.state || !contact.postalCode) {
          log.info(`  SKIP: Incomplete address`)
          skipped++
          this.emitProgress(runId, i + 1, total, enriched, skipped, errors, opp.name, 'running')
          runsRepo.updateProgress(runId, enriched, skipped, errors)
          continue
        }

        const address: AddressInput = {
          address1: contact.address1,
          city: contact.city,
          state: contact.state,
          postalCode: contact.postalCode
        }

        // Check cache first
        const cached = cacheRepo.findByAddress(
          address.address1,
          address.city,
          address.state,
          address.postalCode
        )
        let result: ZillowResult

        if (cached && cached.zestimate) {
          log.info(`  Cache hit: $${cached.zestimate.toLocaleString()}`)
          result = { zestimate: cached.zestimate, zillowUrl: cached.zillow_url }
        } else {
          // Scrape Zillow
          log.info(
            `  Searching Zillow for: ${address.address1}, ${address.city}, ${address.state} ${address.postalCode}`
          )
          result = await scraper.scrape(address)

          // Cache the result
          cacheRepo.insert({
            address1: address.address1,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            zestimate: result.zestimate,
            zillowUrl: result.zillowUrl,
            error: result.error
          })
        }

        if (result.zestimate) {
          log.info(`  Zestimate: $${result.zestimate.toLocaleString()}`)

          // Update contact with ARV
          await ghl.contacts.update(opp.contactId, {
            customFields: [{ id: arvField.id, value: result.zestimate }]
          })
          log.info(`  Updated contact ${opp.contactId}`)
          enriched++
        } else {
          log.info(`  NO VALUE: ${result.error ?? 'Unknown'}`)
          errors++
        }

        this.emitProgress(runId, i + 1, total, enriched, skipped, errors, opp.name, 'running')
        runsRepo.updateProgress(runId, enriched, skipped, errors)

        // Random delay between requests (only if scraping, not cache hit)
        if (!cached) {
          const delay = randomDelay()
          log.info(`  Waiting ${(delay / 1000).toFixed(1)}s...`)
          await sleep(delay)
        }
      }

      // Finish
      runsRepo.finish(runId, 'completed')
      const finalProgress: ArvEnrichmentProgress = {
        runId,
        current: total,
        total,
        enriched,
        skipped,
        errors,
        currentContact: null,
        status: 'completed'
      }
      this.onProgress?.(finalProgress)

      log.info(
        `ARV enrichment complete: ${enriched} enriched, ${skipped} skipped, ${errors} errors out of ${total}`
      )
      return finalProgress
    } catch (err) {
      const runsRepo2 = new ArvRunsRepo(this.db)
      runsRepo2.finish(runId, 'failed')

      const failProgress: ArvEnrichmentProgress = {
        runId,
        current: enriched + skipped + errors,
        total,
        enriched,
        skipped,
        errors,
        currentContact: null,
        status: 'failed'
      }
      this.onProgress?.(failProgress)

      log.error('ARV enrichment failed', err)
      throw err
    } finally {
      this.running = false
      this.currentRunId = null
    }
  }

  private emitProgress(
    runId: string,
    current: number,
    total: number,
    enriched: number,
    skipped: number,
    errors: number,
    currentContact: string | null,
    status: 'running' | 'completed' | 'failed'
  ): void {
    this.onProgress?.({ runId, current, total, enriched, skipped, errors, currentContact, status })
  }
}
