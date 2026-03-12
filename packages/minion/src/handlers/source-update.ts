import {
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  existsSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import type { SourceUpdateInstruction, SourceUpdateResult } from '../types.js'

/** Resolve the minion install root (directory containing src/ and package.json). */
function getMinionRoot(): string {
  // When running via tsx, __dirname-like resolution won't work.
  // Use MINION_ROOT env or walk up from this file to find package.json.
  if (process.env.MINION_ROOT) return process.env.MINION_ROOT

  // Default for systemd installs
  if (existsSync('/opt/hive-minion/package.json')) return '/opt/hive-minion'

  // Dev fallback: walk up from process.cwd()
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'package.json'))) return cwd

  throw new Error('Cannot determine minion root — set MINION_ROOT env var')
}

function sha256Buffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

async function downloadBundle(
  url: string,
  apiKey: string
): Promise<{ data: Buffer; headerHash?: string }> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` }
  })
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`)
  const headerHash = res.headers.get('x-bundle-hash') ?? undefined
  const data = Buffer.from(await res.arrayBuffer())
  return { data, headerHash }
}

function extractTarball(tarballPath: string, destDir: string): void {
  execSync(`tar -xzf "${tarballPath}" -C "${destDir}"`, { timeout: 30_000 })
}

function packageJsonChanged(oldPath: string, newPath: string): boolean {
  if (!existsSync(oldPath) || !existsSync(newPath)) return true
  const oldHash = sha256Buffer(readFileSync(oldPath))
  const newHash = sha256Buffer(readFileSync(newPath))
  return oldHash !== newHash
}

function scheduleSwapAndRestart(
  minionRoot: string,
  extractDir: string,
  needsNpmInstall: boolean
): void {
  setTimeout(() => {
    const srcDir = join(minionRoot, 'src')
    const srcBak = join(minionRoot, 'src.bak')

    try {
      // Backup current source
      if (existsSync(srcBak)) rmSync(srcBak, { recursive: true })
      if (existsSync(srcDir)) renameSync(srcDir, srcBak)

      // Move new source into place
      renameSync(join(extractDir, 'src'), srcDir)

      // Copy package.json + tsconfig.json if present in bundle
      for (const f of ['package.json', 'tsconfig.json']) {
        const extracted = join(extractDir, f)
        if (existsSync(extracted)) {
          const dest = join(minionRoot, f)
          writeFileSync(dest, readFileSync(extracted))
        }
      }

      // Run npm install if package.json changed
      if (needsNpmInstall) {
        console.log('[source-update] package.json changed, running npm install...')
        try {
          execSync('npm install --production', { cwd: minionRoot, timeout: 120_000 })
        } catch (err) {
          console.error(
            '[source-update] npm install failed:',
            err instanceof Error ? err.message : err
          )
          // Continue with restart — dependencies may still work
        }
      }

      // Try systemd restart
      try {
        execSync('systemctl restart hive-minion', { timeout: 10_000 })
        // Wait 10s to check if the service stays up
        setTimeout(() => {
          try {
            const status = execSync('systemctl is-active hive-minion', {
              timeout: 5_000
            })
              .toString()
              .trim()
            if (status !== 'active') throw new Error(`Service status: ${status}`)
            // Success — clean up backup and temp
            try {
              rmSync(srcBak, { recursive: true })
            } catch {
              /* ignore */
            }
            try {
              rmSync(extractDir, { recursive: true })
            } catch {
              /* ignore */
            }
            console.log('[source-update] Restart successful, cleanup done')
          } catch {
            // Restart failed — rollback
            console.error('[source-update] Restart failed, rolling back...')
            rollback(minionRoot, srcBak)
          }
        }, 10_000)
        return
      } catch {
        // Not running under systemd — just exit and let the process manager restart
      }

      // Non-systemd: clean up and exit so process manager restarts us
      try {
        rmSync(srcBak, { recursive: true })
      } catch {
        /* ignore */
      }
      try {
        rmSync(extractDir, { recursive: true })
      } catch {
        /* ignore */
      }
      setTimeout(() => process.exit(0), 500)
    } catch (err) {
      console.error('[source-update] Swap failed:', err instanceof Error ? err.message : err)
      rollback(minionRoot, srcBak)
    }
  }, 2000)
}

function rollback(minionRoot: string, srcBak: string): void {
  const srcDir = join(minionRoot, 'src')
  try {
    if (existsSync(srcBak)) {
      if (existsSync(srcDir)) rmSync(srcDir, { recursive: true })
      renameSync(srcBak, srcDir)
      console.log('[source-update] Rolled back to previous source')
      try {
        execSync('systemctl restart hive-minion', { timeout: 10_000 })
      } catch {
        /* best effort */
      }
    }
  } catch (rollbackErr) {
    console.error(
      '[source-update] CRITICAL: Rollback failed:',
      rollbackErr instanceof Error ? rollbackErr.message : rollbackErr
    )
  }
}

export async function handleSourceUpdate(
  instruction: SourceUpdateInstruction
): Promise<SourceUpdateResult> {
  const { bundleUrl, checksum } = instruction
  const minionRoot = getMinionRoot()
  const tempDir = mkdtempSync(join(tmpdir(), 'source-update-'))
  const tarballPath = join(tempDir, 'bundle.tar.gz')

  try {
    // Resolve API key from env (same key minion uses for WS auth)
    const apiKey = process.env.HIVE_API_KEY ?? ''

    console.log(`[source-update] Downloading bundle from ${bundleUrl}`)
    const { data, headerHash } = await downloadBundle(bundleUrl, apiKey)
    writeFileSync(tarballPath, data)

    // Verify checksum
    const actualHash = sha256Buffer(data)
    const expectedHash = (checksum ?? headerHash ?? '')
      .replace(/^sha256:/i, '')
      .toLowerCase()
      .trim()

    if (expectedHash && actualHash !== expectedHash) {
      throw new Error(`Checksum mismatch: expected ${expectedHash}, got ${actualHash}`)
    }

    console.log(`[source-update] Verified, extracting to ${tempDir}`)
    extractTarball(tarballPath, tempDir)

    // Verify the extracted bundle has a src/ directory
    const extractedSrc = join(tempDir, 'src')
    if (!existsSync(extractedSrc) || !statSync(extractedSrc).isDirectory()) {
      throw new Error('Invalid bundle: missing src/ directory')
    }

    // Check if npm install is needed
    const needsNpmInstall = packageJsonChanged(
      join(minionRoot, 'package.json'),
      join(tempDir, 'package.json')
    )

    console.log(
      `[source-update] Staging swap of ${minionRoot}/src (npm install: ${needsNpmInstall})`
    )
    scheduleSwapAndRestart(minionRoot, tempDir, needsNpmInstall)

    return {
      updated: true,
      message: `Source update verified, swapping and restarting in 2s${needsNpmInstall ? ' (with npm install)' : ''}`
    }
  } catch (err) {
    // Clean up temp on failure
    try {
      rmSync(tempDir, { recursive: true })
    } catch {
      /* ignore */
    }
    throw err
  }
}
