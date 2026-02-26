import { join } from 'path'
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { getDatabase } from './database'
import { getCoreConfig } from '../config'
import { createLogger } from '../utils/logger'

const log = createLogger('DBBackup')

function getBackupDir(): string {
  const { backupDir } = getCoreConfig()
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true })
  }
  return backupDir
}

/**
 * Create a backup of the current database.
 * Uses better-sqlite3's built-in backup API.
 */
export async function createBackup(): Promise<string> {
  const db = getDatabase()
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = join(getBackupDir(), `openorbit-${timestamp}.db`)

  await db.backup(backupPath)
  log.info('Database backup created', { path: backupPath })

  return backupPath
}

/**
 * Create a backup before running migrations.
 * Only creates a backup if the database file exists (not on first run).
 */
export async function backupBeforeMigration(dbPath: string): Promise<void> {
  if (!existsSync(dbPath)) return

  try {
    await createBackup()
    log.info('Pre-migration backup created')
  } catch (err) {
    log.error('Failed to create pre-migration backup', err)
    // Don't block migration on backup failure
  }
}

/**
 * Remove old backups, keeping the most recent `keep` files.
 */
export function pruneBackups(keep: number = 5): void {
  const dir = getBackupDir()
  const files = readdirSync(dir)
    .filter(
      (f) => (f.startsWith('openorbit-') || f.startsWith('contractor-os-')) && f.endsWith('.db')
    )
    .sort()
    .reverse()

  const toDelete = files.slice(keep)
  for (const file of toDelete) {
    const filePath = join(dir, file)
    unlinkSync(filePath)
    log.info('Pruned old backup', { file })
  }

  if (toDelete.length > 0) {
    log.info(`Pruned ${toDelete.length} old backups, kept ${Math.min(keep, files.length)}`)
  }
}
