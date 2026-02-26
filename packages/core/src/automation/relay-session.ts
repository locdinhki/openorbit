/**
 * Relay session — CDP-based Page implementation for the Chrome extension relay.
 *
 * When SessionManager runs in relay mode it skips Patchright entirely and uses
 * the user's real Chrome (via the OpenOrbit extension) to execute CDP commands.
 *
 * The relay sender is injected from the Electron main process after the
 * RPCServer is created:
 *
 *   import { setRelaySender } from '@openorbit/core/automation/relay-session'
 *   setRelaySender((tabId, method, params) => rpcServer.sendRelayCommand(tabId, method, params))
 */

import { getCoreEventBus, type RelayAttachedData } from './core-events'

// ---------------------------------------------------------------------------
// Dependency injection — allows core to call RPC server without importing it
// ---------------------------------------------------------------------------

export type CDPCommandSender = (
  tabId: number,
  cdpMethod: string,
  cdpParams?: Record<string, unknown>
) => Promise<unknown>

let relaySender: CDPCommandSender | null = null

export function setRelaySender(fn: CDPCommandSender): void {
  relaySender = fn
}

export function getRelaySender(): CDPCommandSender {
  if (!relaySender) throw new Error('Relay sender not initialised. Is the RPC server running?')
  return relaySender
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type CDPResult<T = unknown> = { result: { value?: T; type?: string; objectId?: string } }

async function cdp(
  tabId: number,
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  return getRelaySender()(tabId, method, params)
}

// ---------------------------------------------------------------------------
// RelayElementHandle — wraps a CDP objectId to represent a DOM element
// ---------------------------------------------------------------------------

export class RelayElementHandle {
  constructor(
    private readonly tabId: number,
    private readonly objectId: string
  ) {}

  private async callFn<T>(fn: string): Promise<T> {
    const res = (await cdp(this.tabId, 'Runtime.callFunctionOn', {
      objectId: this.objectId,
      functionDeclaration: fn,
      returnByValue: true
    })) as CDPResult<T>
    return res.result.value as T
  }

  private async callFnObject(fn: string): Promise<string | null> {
    const res = (await cdp(this.tabId, 'Runtime.callFunctionOn', {
      objectId: this.objectId,
      functionDeclaration: fn,
      returnByValue: false
    })) as CDPResult
    return res.result.objectId ?? null
  }

  async innerText(): Promise<string> {
    return (await this.callFn<string>('function() { return this.innerText ?? "" }')) ?? ''
  }

  async textContent(): Promise<string | null> {
    return this.callFn<string>('function() { return this.textContent }')
  }

  async getAttribute(name: string): Promise<string | null> {
    return this.callFn<string | null>(
      `function() { return this.getAttribute(${JSON.stringify(name)}) }`
    )
  }

  async inputValue(): Promise<string> {
    return (await this.callFn<string>('function() { return this.value ?? "" }')) ?? ''
  }

  async click(): Promise<void> {
    await this.callFn<void>(
      'function() { this.click(); this.dispatchEvent(new MouseEvent("click", { bubbles: true })) }'
    )
  }

  async check(): Promise<void> {
    await this.callFn<void>(
      'function() { this.checked = true; this.dispatchEvent(new Event("change", { bubbles: true })) }'
    )
  }

  async setInputFiles(filePath: string): Promise<void> {
    // CDP cannot directly set file inputs; log a warning and skip
    console.warn(`[RelayPage] setInputFiles(${filePath}) not supported in relay mode`)
  }

  async $(selector: string): Promise<RelayElementHandle | null> {
    const oid = await this.callFnObject(
      `function() { return this.querySelector(${JSON.stringify(selector)}) }`
    )
    if (!oid) return null
    return new RelayElementHandle(this.tabId, oid)
  }

  async $$(selector: string): Promise<RelayElementHandle[]> {
    return queryAll(this.tabId, selector, this.objectId)
  }

  locator(selector: string): RelayLocator {
    return new RelayLocator(this.tabId, selector, this.objectId)
  }
}

// ---------------------------------------------------------------------------
// RelayLocator — lazy element query (mirrors Playwright's Locator API)
// ---------------------------------------------------------------------------

export class RelayLocator {
  constructor(
    private readonly tabId: number,
    private readonly selector: string,
    private readonly contextObjectId?: string
  ) {}

  first(): RelayLocator {
    return this
  }

  async isVisible(opts?: { timeout?: number }): Promise<boolean> {
    const timeout = opts?.timeout ?? 5000
    const start = Date.now()
    const expr = `(function() {
      const el = document.querySelector(${JSON.stringify(this.selector)})
      if (!el) return false
      const style = window.getComputedStyle(el)
      return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null
    })()`
    while (Date.now() - start < timeout) {
      const res = (await cdp(this.tabId, 'Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        contextId: this.contextObjectId
      })) as CDPResult<boolean>
      if (res.result.value === true) return true
      await sleep(100)
    }
    return false
  }

  async innerText(opts?: { timeout?: number }): Promise<string> {
    const timeout = opts?.timeout ?? 5000
    const start = Date.now()
    const expr = `document.querySelector(${JSON.stringify(this.selector)})?.innerText ?? ""`
    while (Date.now() - start < timeout) {
      const res = (await cdp(this.tabId, 'Runtime.evaluate', {
        expression: expr,
        returnByValue: true
      })) as CDPResult<string>
      if (res.result.value !== undefined) return res.result.value
      await sleep(100)
    }
    return ''
  }
}

// ---------------------------------------------------------------------------
// Helper: query multiple elements and return RelayElementHandles
// ---------------------------------------------------------------------------

async function queryAll(
  tabId: number,
  selector: string,
  contextObjectId?: string
): Promise<RelayElementHandle[]> {
  const expr = contextObjectId
    ? `Array.from(arguments[0].querySelectorAll(${JSON.stringify(selector)}))`
    : `Array.from(document.querySelectorAll(${JSON.stringify(selector)}))`

  const arrayRes = (await cdp(tabId, 'Runtime.evaluate', {
    expression: expr,
    returnByValue: false,
    objectGroup: 'relay'
  })) as CDPResult

  const arrayObjectId = arrayRes.result.objectId
  if (!arrayObjectId) return []

  // Get length
  const lenRes = (await cdp(tabId, 'Runtime.callFunctionOn', {
    objectId: arrayObjectId,
    functionDeclaration: 'function() { return this.length }',
    returnByValue: true
  })) as CDPResult<number>
  const length = lenRes.result.value ?? 0

  const handles: RelayElementHandle[] = []
  for (let i = 0; i < length; i++) {
    const itemRes = (await cdp(tabId, 'Runtime.callFunctionOn', {
      objectId: arrayObjectId,
      functionDeclaration: `function() { return this[${i}] }`,
      returnByValue: false
    })) as CDPResult
    if (itemRes.result.objectId) {
      handles.push(new RelayElementHandle(tabId, itemRes.result.objectId))
    }
  }
  return handles
}

// ---------------------------------------------------------------------------
// RelayPage — implements the Playwright Page methods used by platform adapters
// ---------------------------------------------------------------------------

export class RelayPage {
  private _url = ''
  private _cdpEventListeners: Array<{ event: string; handler: (...args: unknown[]) => void }> = []

  constructor(readonly tabId: number) {
    // Keep URL in sync via CDP events forwarded through CoreEventBus
    const onCDPEvent = (data: { tabId: number; cdpEvent: string; cdpParams: unknown }): void => {
      if (data.tabId !== this.tabId) return
      if (
        data.cdpEvent === 'Page.frameNavigated' ||
        data.cdpEvent === 'Page.navigatedWithinDocument'
      ) {
        const params = data.cdpParams as { frame?: { url?: string } }
        if (params?.frame?.url) this._url = params.frame.url
      }
    }
    getCoreEventBus().on('relay:cdp-event', onCDPEvent)
    this._cdpEventListeners.push({ event: 'relay:cdp-event', handler: onCDPEvent as never })
  }

  private async send(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return cdp(this.tabId, method, params)
  }

  url(): string {
    return this._url
  }

  async goto(url: string, opts?: { waitUntil?: string }): Promise<void> {
    await this.send('Page.navigate', { url })
    const state = opts?.waitUntil ?? 'domcontentloaded'
    await this.waitForLoadState(state as 'domcontentloaded' | 'load' | 'networkidle')
    this._url = url
  }

  async waitForLoadState(
    state: 'domcontentloaded' | 'load' | 'networkidle' = 'domcontentloaded'
  ): Promise<void> {
    // Poll document.readyState
    const target = state === 'domcontentloaded' ? 'interactive' : 'complete'
    const timeout = 30_000
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const res = (await this.send('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true
      })) as CDPResult<string>
      const readyState = res.result.value ?? ''
      if (readyState === target || readyState === 'complete') return
      await sleep(200)
    }
    throw new Error(`waitForLoadState('${state}') timed out after 30s`)
  }

  async waitForSelector(selector: string, opts?: { timeout?: number }): Promise<void> {
    const timeout = opts?.timeout ?? 30_000
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const res = (await this.send('Runtime.evaluate', {
        expression: `!!document.querySelector(${JSON.stringify(selector)})`,
        returnByValue: true
      })) as CDPResult<boolean>
      if (res.result.value) return
      await sleep(200)
    }
    throw new Error(`waitForSelector('${selector}') timed out after ${timeout}ms`)
  }

  async evaluate<T>(fn: (arg?: unknown) => T, arg?: unknown): Promise<T> {
    const fnStr = fn.toString()
    const expr = arg !== undefined ? `(${fnStr})(${JSON.stringify(arg)})` : `(${fnStr})()`
    const res = (await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    })) as CDPResult<T>
    return res.result.value as T
  }

  async $(selector: string): Promise<RelayElementHandle | null> {
    const res = (await this.send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
      returnByValue: false,
      objectGroup: 'relay'
    })) as CDPResult
    if (!res.result.objectId) return null
    return new RelayElementHandle(this.tabId, res.result.objectId)
  }

  async $$(selector: string): Promise<RelayElementHandle[]> {
    return queryAll(this.tabId, selector)
  }

  async click(selector: string, opts?: { clickCount?: number }): Promise<void> {
    const count = opts?.clickCount ?? 1
    await this.send('Runtime.evaluate', {
      expression: `(function() {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) throw new Error('Element not found: ${selector.replace(/'/g, "\\'")}')
        for (let i = 0; i < ${count}; i++) el.click()
      })()`,
      returnByValue: true
    })
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.send('Runtime.evaluate', {
      expression: `(function() {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) throw new Error('Element not found: ${selector.replace(/'/g, "\\'")}')
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (nativeInputValueSetter) nativeInputValueSetter.call(el, ${JSON.stringify(value)})
        else el.value = ${JSON.stringify(value)}
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      })()`,
      returnByValue: true
    })
  }

  async check(selector: string): Promise<void> {
    await this.send('Runtime.evaluate', {
      expression: `(function() {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (el) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })) }
      })()`,
      returnByValue: true
    })
  }

  async selectOption(selector: string, value: string | { label: string }): Promise<string[]> {
    const valExpr =
      typeof value === 'string'
        ? JSON.stringify(value)
        : `{ label: ${JSON.stringify(value.label)} }`
    await this.send('Runtime.evaluate', {
      expression: `(function() {
        const el = document.querySelector(${JSON.stringify(selector)})
        if (!el) return
        const v = ${valExpr}
        if (typeof v === 'string') { el.value = v }
        else {
          for (const opt of el.options) {
            if (opt.text === v.label) { el.value = opt.value; break }
          }
        }
        el.dispatchEvent(new Event('change', { bubbles: true }))
      })()`,
      returnByValue: true
    })
    return []
  }

  locator(selector: string): RelayLocator {
    return new RelayLocator(this.tabId, selector)
  }

  async content(): Promise<string> {
    const res = (await this.send('Runtime.evaluate', {
      expression: 'document.documentElement.outerHTML',
      returnByValue: true
    })) as CDPResult<string>
    return res.result.value ?? ''
  }

  /** Destroy event listeners when done with this page. */
  dispose(): void {
    const bus = getCoreEventBus()
    for (const { event, handler } of this._cdpEventListeners) {
      bus.off(event as 'relay:cdp-event', handler as never)
    }
    this._cdpEventListeners = []
  }
}

// ---------------------------------------------------------------------------
// Wait for relay to attach to a tab (used by SessionManager relay mode)
// ---------------------------------------------------------------------------

export function waitForRelayAttach(timeoutMs = 60_000): Promise<RelayAttachedData> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for Chrome extension relay to attach a tab'))
    }, timeoutMs)

    getCoreEventBus().once('relay:attached', (data) => {
      clearTimeout(timer)
      resolve(data)
    })
  })
}
