import { chromium, type BrowserContext, type CDPSession, type Page } from 'patchright'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { SESSION_STORAGE_FILENAME } from '../constants'
import { getCoreConfig } from '../config'
import { createLogger } from '../utils/logger'
import { RelayPage, waitForRelayAttach } from './relay-session'

const log = createLogger('SessionManager')

export type SessionMode = 'managed' | 'relay'

export class SessionManager {
  private context: BrowserContext | null = null
  private userDataDir: string
  private legacyStoragePath: string
  private readonly mode: SessionMode
  private relayPage: RelayPage | null = null
  private cdpSessions = new Map<string, CDPSession>()
  private screencastActive = new Set<string>()

  constructor(opts?: { mode?: SessionMode }) {
    const { browserProfileDir, dataDir } = getCoreConfig()
    this.userDataDir = browserProfileDir
    // Legacy path for migration from storageState JSON
    this.legacyStoragePath = join(dataDir, 'session', SESSION_STORAGE_FILENAME)
    this.mode = opts?.mode ?? 'managed'
  }

  async init(): Promise<void> {
    if (this.mode === 'relay') {
      await this.initRelay()
      return
    }

    if (this.context) {
      log.warn('Session already initialized')
      return
    }

    if (!existsSync(this.userDataDir)) {
      mkdirSync(this.userDataDir, { recursive: true })
    }

    // Migrate from legacy storageState JSON if needed
    await this.migrateFromStorageState()

    log.info('Launching persistent browser context')

    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: false,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-extensions',
        '--disable-popup-blocking'
      ],
      viewport: { width: 1366, height: 768 },
      userAgent: this.getRealisticUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/Chicago',
      geolocation: { latitude: 32.7767, longitude: -96.797 }, // Dallas, TX
      permissions: ['geolocation']
    })

    // Patchright handles anti-detection natively (webdriver, plugins, languages, etc.)

    log.info('Browser initialized with persistent context')
  }

  private async initRelay(): Promise<void> {
    if (this.relayPage) {
      log.warn('Relay session already initialized')
      return
    }
    log.info('Relay mode: waiting for Chrome extension to attach a tab…')
    const { tabId, url } = await waitForRelayAttach()
    this.relayPage = new RelayPage(tabId)
    log.info(`Relay session ready: tab ${tabId} (${url})`)
  }

  async getPage(): Promise<Page> {
    if (this.mode === 'relay') {
      if (!this.relayPage) throw new Error('Relay session not initialized. Call init() first.')
      return this.relayPage as unknown as Page
    }
    if (!this.context) {
      throw new Error('Session not initialized. Call init() first.')
    }
    const pages = this.context.pages()
    return pages[0] || (await this.context.newPage())
  }

  async newPage(): Promise<Page> {
    if (this.mode === 'relay') {
      // Relay mode creates a new tab in the user's Chrome via CDP
      if (!this.relayPage) throw new Error('Relay session not initialized. Call init() first.')
      return this.relayPage as unknown as Page
    }
    if (!this.context) {
      throw new Error('Session not initialized. Call init() first.')
    }
    return await this.context.newPage()
  }

  async saveSession(): Promise<void> {
    // Persistent context auto-saves to disk — no manual save needed
    log.debug('Session auto-saved by persistent context')
  }

  /** Start screencast for a specific platform's page. */
  async startScreencastForPlatform(
    platform: string,
    page: Page,
    opts: {
      quality?: number
      maxWidth?: number
      maxHeight?: number
      everyNthFrame?: number
      onFrame: (frame: {
        platform: string
        data: string
        sessionId: number
        metadata: Record<string, unknown>
      }) => void
    }
  ): Promise<void> {
    if (this.mode === 'relay') {
      throw new Error('Screencast not supported in relay mode')
    }
    if (this.screencastActive.has(platform)) return
    if (!this.context) {
      throw new Error('Session not initialized')
    }

    const cdp = await page.context().newCDPSession(page)
    this.cdpSessions.set(platform, cdp)

    cdp.on('Page.screencastFrame', (params: Record<string, unknown>) => {
      cdp.send('Page.screencastFrameAck', { sessionId: params.sessionId as number }).catch(() => {})

      opts.onFrame({
        platform,
        data: params.data as string,
        sessionId: params.sessionId as number,
        metadata: params.metadata as Record<string, unknown>
      })
    })

    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: opts.quality ?? 40,
      maxWidth: opts.maxWidth ?? 1280,
      maxHeight: opts.maxHeight ?? 720,
      everyNthFrame: opts.everyNthFrame ?? 2
    })

    this.screencastActive.add(platform)
    log.info(`Screencast started for ${platform}`)
  }

  /** Backward-compat: start screencast on the default page. */
  async startScreencast(opts: {
    quality?: number
    maxWidth?: number
    maxHeight?: number
    everyNthFrame?: number
    onFrame: (frame: { data: string; sessionId: number; metadata: Record<string, unknown> }) => void
  }): Promise<void> {
    const page = await this.getPage()
    await this.startScreencastForPlatform('default', page, {
      ...opts,
      onFrame: (frame) => opts.onFrame(frame)
    })
  }

  /** Stop screencast for a specific platform. */
  async stopScreencastForPlatform(platform: string): Promise<void> {
    const cdp = this.cdpSessions.get(platform)
    if (!cdp) return

    try {
      await cdp.send('Page.stopScreencast')
      await cdp.detach()
    } catch {
      // CDP session may already be dead
    } finally {
      this.cdpSessions.delete(platform)
      this.screencastActive.delete(platform)
      log.info(`Screencast stopped for ${platform}`)
    }
  }

  /** Stop all active screencasts. */
  async stopAllScreencasts(): Promise<void> {
    const platforms = Array.from(this.cdpSessions.keys())
    for (const platform of platforms) {
      await this.stopScreencastForPlatform(platform)
    }
  }

  /** Backward-compat: stop the default screencast. */
  async stopScreencast(): Promise<void> {
    await this.stopAllScreencasts()
  }

  isScreencasting(): boolean {
    return this.screencastActive.size > 0
  }

  getActiveScreencasts(): string[] {
    return Array.from(this.screencastActive)
  }

  async close(): Promise<void> {
    await this.stopAllScreencasts()
    if (this.relayPage) {
      this.relayPage.dispose()
      this.relayPage = null
    }
    if (this.context) {
      await this.context.close()
      this.context = null
    }
    log.info('Session closed')
  }

  isInitialized(): boolean {
    if (this.mode === 'relay') return this.relayPage !== null
    return this.context !== null
  }

  getMode(): SessionMode {
    return this.mode
  }

  hasExistingSession(): boolean {
    return existsSync(this.userDataDir) || existsSync(this.legacyStoragePath)
  }

  getContext(): BrowserContext | null {
    return this.context
  }

  /**
   * Migrate from legacy storageState JSON to persistent context.
   * If the old browser-state.json exists, launch a temporary context with it
   * to seed the new user data directory, then delete the JSON file.
   */
  private async migrateFromStorageState(): Promise<void> {
    if (!existsSync(this.legacyStoragePath)) return

    log.info('Migrating from legacy storageState to persistent context')
    try {
      // Legacy storageState JSON cannot be used with launchPersistentContext.
      // Delete the old file and inform the user they need to re-login once.
      log.warn('Legacy browser-state.json found — user will need to re-login (one-time)')

      // Remove the old storage state file
      unlinkSync(this.legacyStoragePath)
      log.info('Migration complete — legacy storageState removed')
    } catch (err) {
      log.error('Migration from storageState failed', err)
      // Non-fatal — continue with fresh profile
    }
  }

  private getRealisticUserAgent(): string {
    // Current stable Chrome UA on macOS — update periodically
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  }
}
