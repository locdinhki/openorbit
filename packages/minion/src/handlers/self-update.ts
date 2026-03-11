import { writeFileSync, copyFileSync, unlinkSync, chmodSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn, execSync } from 'node:child_process'
import type { SelfUpdateInstruction, SelfUpdateResult } from '../types.js'

/** Resolve the path to the running minion binary. */
function getBinaryPath(): string {
  const ep = process.execPath
  if (ep.includes('hive-minion')) return ep
  // Fallback for systemd installs
  return '/usr/local/bin/hive-minion'
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`)
  const buf = await res.arrayBuffer()
  writeFileSync(destPath, Buffer.from(buf))
}

function sha256File(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

function scheduleReplaceAndRestart(tempPath: string, binaryPath: string): void {
  setTimeout(() => {
    try {
      copyFileSync(tempPath, binaryPath)
      chmodSync(binaryPath, 0o755)
      try {
        unlinkSync(tempPath)
      } catch {
        /* ignore */
      }

      // Try systemd restart first
      try {
        execSync('systemctl restart hive-minion', { timeout: 5000 })
        return // systemd will restart us
      } catch {
        // Not running under systemd — spawn new process then exit
      }

      const child = spawn(binaryPath, process.argv.slice(2), {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()
      setTimeout(() => process.exit(0), 500)
    } catch (err) {
      console.error(
        '[self-update] Replace/restart failed:',
        err instanceof Error ? err.message : err
      )
    }
  }, 2000)
}

export async function handleSelfUpdate(
  instruction: SelfUpdateInstruction
): Promise<SelfUpdateResult> {
  const { version, downloadUrl, checksum } = instruction
  const expectedHash = checksum
    .replace(/^sha256:/i, '')
    .toLowerCase()
    .trim()

  const tempPath = join(tmpdir(), `hive-minion-update-${Date.now()}`)

  try {
    console.log(`[self-update] Downloading v${version} from ${downloadUrl}`)
    await downloadToFile(downloadUrl, tempPath)

    const actualHash = sha256File(tempPath)
    if (actualHash !== expectedHash) {
      try {
        unlinkSync(tempPath)
      } catch {
        /* ignore */
      }
      throw new Error(`Checksum mismatch: expected ${expectedHash}, got ${actualHash}`)
    }

    chmodSync(tempPath, 0o755)

    const binaryPath = getBinaryPath()
    console.log(`[self-update] Verified v${version}, staging replace of ${binaryPath}`)
    scheduleReplaceAndRestart(tempPath, binaryPath)

    return {
      updated: true,
      version,
      message: `Update to v${version} verified, replacing binary and restarting in 2s`
    }
  } catch (err) {
    try {
      unlinkSync(tempPath)
    } catch {
      /* ignore */
    }
    throw err
  }
}
