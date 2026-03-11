import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import {
  platform,
  hostname,
  arch,
  release,
  cpus,
  totalmem,
  freemem,
  networkInterfaces,
  uptime
} from 'node:os'
import type { HardwareInfo } from './types.js'

// ── Fingerprint sources (priority order) ────────────────────────────────────

function getPiSerial(): string {
  try {
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf-8')
    const match = cpuinfo.match(/Serial\s*:\s*(\w+)/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

function _getPiModel(): string {
  try {
    return readFileSync('/proc/device-tree/model', 'utf-8').replace(/\0/g, '').trim()
  } catch {
    return ''
  }
}

function _getPiRevision(): string {
  try {
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf-8')
    const match = cpuinfo.match(/Revision\s*:\s*(\w+)/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

function getDmiUuid(): string {
  try {
    return readFileSync('/sys/class/dmi/id/product_uuid', 'utf-8').trim()
  } catch {
    return ''
  }
}

function getMachineId(): string {
  try {
    return readFileSync('/etc/machine-id', 'utf-8').trim()
  } catch {
    return ''
  }
}

function getMacOsHardwareUuid(): string {
  try {
    const out = execSync('system_profiler SPHardwareDataType', { encoding: 'utf-8' })
    const match = out.match(/Hardware UUID:\s*([\w-]+)/)
    return match?.[1] ?? ''
  } catch {
    return ''
  }
}

function getPrimaryMac(): { mac: string; iface: string; ip: string } {
  const ifaces = networkInterfaces()
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs || name === 'lo' || name === 'lo0') continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // Find MAC for this interface
        const macAddr = addrs.find((a) => a.mac && a.mac !== '00:00:00:00:00:00')
        return {
          mac: macAddr?.mac ?? '',
          iface: name,
          ip: addr.address
        }
      }
    }
  }
  return { mac: '', iface: '', ip: '' }
}

// ── Disk info ───────────────────────────────────────────────────────────────

function getDiskInfo(): { totalGb: number; usedGb: number; freeGb: number } {
  try {
    const out = execSync('df -BG / 2>/dev/null || df -g / 2>/dev/null', {
      encoding: 'utf-8'
    })
    const lines = out.trim().split('\n')
    if (lines.length < 2) return { totalGb: 0, usedGb: 0, freeGb: 0 }
    const parts = lines[1].split(/\s+/)
    return {
      totalGb: parseInt(parts[1]) || 0,
      usedGb: parseInt(parts[2]) || 0,
      freeGb: parseInt(parts[3]) || 0
    }
  } catch {
    return { totalGb: 0, usedGb: 0, freeGb: 0 }
  }
}

// ── CPU model ───────────────────────────────────────────────────────────────

function getCpuModel(): string {
  const cpuList = cpus()
  if (cpuList.length > 0) return cpuList[0].model
  try {
    const cpuinfo = readFileSync('/proc/cpuinfo', 'utf-8')
    const match = cpuinfo.match(/model name\s*:\s*(.+)/) || cpuinfo.match(/Hardware\s*:\s*(.+)/)
    return match?.[1]?.trim() ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

// ── OS name ─────────────────────────────────────────────────────────────────

function getOsName(): string {
  if (existsSync('/etc/os-release')) {
    try {
      const content = readFileSync('/etc/os-release', 'utf-8')
      const match = content.match(/PRETTY_NAME="(.+)"/)
      return match?.[1] ?? `${platform()} ${release()}`
    } catch {
      /* fall through */
    }
  }
  return `${platform()} ${release()}`
}

// ── Software versions ───────────────────────────────────────────────────────

function getSoftwareVersions(): Record<string, string> {
  const versions: Record<string, string> = {}
  const checks: [string, string][] = [
    ['node', 'node --version'],
    ['python', 'python3 --version'],
    ['docker', 'docker --version'],
    ['bun', 'bun --version']
  ]
  for (const [name, cmd] of checks) {
    try {
      const out = execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim()
      // Normalize: "Python 3.9.2" → "3.9.2", "v20.10.0" → "v20.10.0"
      const ver = out
        .replace(/^[a-zA-Z]+\s+/, '')
        .replace(/,.*$/, '')
        .trim()
      versions[name] = ver
    } catch {
      versions[name] = 'not installed'
    }
  }
  return versions
}

// ── Public API ──────────────────────────────────────────────────────────────

export function computeHardwareId(): string {
  const parts: string[] = []

  const piSerial = getPiSerial()
  if (piSerial) parts.push(piSerial)

  if (platform() === 'darwin') {
    const uuid = getMacOsHardwareUuid()
    if (uuid) parts.push(uuid)
  } else {
    const dmi = getDmiUuid()
    if (dmi) parts.push(dmi)
  }

  const machineId = getMachineId()
  if (machineId) parts.push(machineId)

  const { mac } = getPrimaryMac()
  if (mac) parts.push(mac)

  if (parts.length === 0) {
    throw new Error('Cannot compute hardware ID: no identity sources available')
  }

  return createHash('sha256').update(parts.join('')).digest('hex')
}

export function collectHardwareInfo(): HardwareInfo {
  const { mac, iface, ip } = getPrimaryMac()

  return {
    hardwareId: computeHardwareId(),
    hostname: hostname(),
    platform: platform(),
    arch: arch(),
    kernel: release(),
    os: getOsName(),
    cpu: {
      model: getCpuModel(),
      cores: cpus().length || 1
    },
    memory: {
      totalMb: Math.round(totalmem() / 1024 / 1024),
      availableMb: Math.round(freemem() / 1024 / 1024)
    },
    storage: getDiskInfo(),
    network: { ip, interface: iface, mac },
    software: getSoftwareVersions(),
    uptimeSeconds: Math.round(uptime())
  }
}
