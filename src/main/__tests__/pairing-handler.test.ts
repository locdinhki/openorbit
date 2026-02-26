/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock `os` before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('os', () => ({
  networkInterfaces: vi.fn()
}))

// Mock Electron so ipc-handlers can be imported without the real Electron runtime
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: vi.fn()
}))

vi.mock('@openorbit/core/utils/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  getLogPath: () => '/tmp/test.log'
}))

vi.mock('@openorbit/core/ipc-schemas', () => ({
  ipcSchemas: new Proxy({}, { get: () => ({ safeParse: (v: unknown) => ({ success: true, data: v ?? {} }) }) })
}))

vi.mock('@openorbit/core/errors', () => ({
  errorToResponse: (err: unknown) => ({
    success: false,
    error: err instanceof Error ? err.message : String(err)
  })
}))

vi.mock('@openorbit/core/automation/session-manager', () => ({
  SessionManager: class { init = vi.fn(); close = vi.fn(); isInitialized = vi.fn().mockReturnValue(false); hasExistingSession = vi.fn().mockReturnValue(false); getPage = vi.fn(); saveSession = vi.fn() }
}))
vi.mock('@openorbit/core/automation/extraction-runner', () => ({
  ExtractionRunner: class { isRunning = vi.fn().mockReturnValue(false); stop = vi.fn() }
}))
vi.mock('@openorbit/core/automation/automation-coordinator', () => ({
  AutomationCoordinator: class { isRunning = vi.fn().mockReturnValue(false); stop = vi.fn() }
}))
vi.mock('@openorbit/core/db/settings-repo', () => ({
  SettingsRepo: class { get = vi.fn(); set = vi.fn() }
}))
vi.mock('@openorbit/core/ai/claude-service', () => ({
  getClaudeService: () => ({ resetClient: vi.fn() })
}))
vi.mock('../ipc-validation', () => ({
  validatedHandle: vi.fn()
}))
vi.mock('../updater', () => ({}))

import { networkInterfaces } from 'os'
import { getLocalIp, getTailscaleIp, resolvePairingInfo, type PairingContext } from '../ipc-handlers'

// ---------------------------------------------------------------------------

function mockNetworkInterfaces(ifaces: Record<string, any[]>): void {
  vi.mocked(networkInterfaces).mockReturnValue(ifaces as any)
}

// ---------------------------------------------------------------------------

describe('getLocalIp()', () => {
  beforeEach(() => {
    vi.mocked(networkInterfaces).mockReset()
  })

  it('returns the first non-loopback IPv4 address', () => {
    mockNetworkInterfaces({
      en0: [
        { family: 'IPv4', address: '192.168.1.10', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }
      ]
    })
    expect(getLocalIp()).toBe('192.168.1.10')
  })

  it('skips loopback addresses', () => {
    mockNetworkInterfaces({
      lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true, netmask: '255.0.0.0', mac: '', cidr: '' }],
      en0: [{ family: 'IPv4', address: '10.0.0.2', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }]
    })
    expect(getLocalIp()).toBe('10.0.0.2')
  })

  it('skips IPv6 addresses', () => {
    mockNetworkInterfaces({
      en0: [
        { family: 'IPv6', address: 'fe80::1', internal: false, netmask: '/64', mac: '', cidr: '' },
        { family: 'IPv4', address: '192.168.0.5', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }
      ]
    })
    expect(getLocalIp()).toBe('192.168.0.5')
  })

  it('falls back to 127.0.0.1 when no non-loopback IPv4 found', () => {
    mockNetworkInterfaces({})
    expect(getLocalIp()).toBe('127.0.0.1')
  })

  it('falls back to 127.0.0.1 when only loopback interfaces exist', () => {
    mockNetworkInterfaces({
      lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true, netmask: '255.0.0.0', mac: '', cidr: '' }]
    })
    expect(getLocalIp()).toBe('127.0.0.1')
  })
})

describe('getTailscaleIp()', () => {
  beforeEach(() => {
    vi.mocked(networkInterfaces).mockReset()
  })

  it('returns tailscale IP in the 100.64-127.x.x range', () => {
    mockNetworkInterfaces({
      en0: [{ family: 'IPv4', address: '192.168.1.10', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }],
      utun3: [{ family: 'IPv4', address: '100.100.50.1', internal: false, netmask: '255.255.255.255', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBe('100.100.50.1')
  })

  it('returns null when no tailscale interface exists', () => {
    mockNetworkInterfaces({
      en0: [{ family: 'IPv4', address: '192.168.1.10', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBeNull()
  })

  it('returns null for 100.x addresses outside CGNAT range', () => {
    mockNetworkInterfaces({
      en0: [{ family: 'IPv4', address: '100.50.0.1', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBeNull()
  })

  it('detects 100.64.x.x as lowest tailscale range', () => {
    mockNetworkInterfaces({
      utun0: [{ family: 'IPv4', address: '100.64.0.1', internal: false, netmask: '255.255.255.255', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBe('100.64.0.1')
  })

  it('detects 100.127.x.x as highest tailscale range', () => {
    mockNetworkInterfaces({
      utun0: [{ family: 'IPv4', address: '100.127.255.254', internal: false, netmask: '255.255.255.255', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBe('100.127.255.254')
  })

  it('ignores 100.128+ addresses (outside CGNAT)', () => {
    mockNetworkInterfaces({
      en0: [{ family: 'IPv4', address: '100.128.0.1', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }]
    })
    expect(getTailscaleIp()).toBeNull()
  })
})

describe('resolvePairingInfo()', () => {
  beforeEach(() => {
    vi.mocked(networkInterfaces).mockReturnValue({
      en0: [
        { family: 'IPv4', address: '10.1.2.3', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }
      ]
    } as any)
  })

  it('returns provided wsUrl and token when pairing context is given', () => {
    const pairing: PairingContext = { wsUrl: 'ws://192.168.1.5:18790', token: 'my-token' }
    const result = resolvePairingInfo(pairing)
    expect(result.wsUrl).toBe('ws://192.168.1.5:18790')
    expect(result.token).toBe('my-token')
  })

  it('builds wsUrl from local IP when no pairing context provided', () => {
    const result = resolvePairingInfo()
    expect(result.wsUrl).toBe('ws://10.1.2.3:18790')
  })

  it('returns empty token when no pairing context provided', () => {
    const result = resolvePairingInfo()
    expect(result.token).toBe('')
  })

  it('uses port 18790 in the fallback URL', () => {
    const result = resolvePairingInfo()
    expect(result.wsUrl).toMatch(/:18790$/)
  })

  it('uses ws:// scheme in the fallback URL', () => {
    const result = resolvePairingInfo()
    expect(result.wsUrl).toMatch(/^ws:\/\//)
  })

  it('includes tailnetUrl when tailscale IP is available', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      en0: [
        { family: 'IPv4', address: '10.1.2.3', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }
      ],
      utun3: [
        { family: 'IPv4', address: '100.100.50.1', internal: false, netmask: '255.255.255.255', mac: '', cidr: '' }
      ]
    } as any)

    const result = resolvePairingInfo()
    expect(result.tailnetUrl).toBe('ws://100.100.50.1:18790')
  })

  it('omits tailnetUrl when no tailscale interface', () => {
    const result = resolvePairingInfo()
    expect(result.tailnetUrl).toBeUndefined()
  })

  it('uses correct port in tailnet URL from pairing context', () => {
    vi.mocked(networkInterfaces).mockReturnValue({
      en0: [
        { family: 'IPv4', address: '10.1.2.3', internal: false, netmask: '255.255.255.0', mac: '', cidr: '' }
      ],
      utun3: [
        { family: 'IPv4', address: '100.64.0.5', internal: false, netmask: '255.255.255.255', mac: '', cidr: '' }
      ]
    } as any)

    const pairing: PairingContext = { wsUrl: 'ws://10.1.2.3:19000', token: 'tok' }
    const result = resolvePairingInfo(pairing)
    expect(result.tailnetUrl).toBe('ws://100.64.0.5:19000')
  })
})
