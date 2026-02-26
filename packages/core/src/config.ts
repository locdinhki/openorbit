import { createLogger } from './utils/logger'

const log = createLogger('CoreConfig')

export interface CoreConfig {
  dataDir: string
  backupDir: string
  logDir: string
  hintsDir: string
  browserProfileDir: string
  isDev: boolean
}

let config: CoreConfig | null = null

export function initCore(cfg: CoreConfig): void {
  config = cfg
  log.info('Core initialized', {
    dataDir: cfg.dataDir,
    backupDir: cfg.backupDir,
    isDev: cfg.isDev
  })
}

export function getCoreConfig(): CoreConfig {
  if (!config) {
    throw new Error('Core not initialized. Call initCore() first.')
  }
  return config
}

export function isCoreInitialized(): boolean {
  return config !== null
}

/** Reset core config (for testing only) */
export function resetCoreConfig(): void {
  config = null
}
