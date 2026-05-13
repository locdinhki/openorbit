// ============================================================================
// ext-hive — AI Chat Handler (context-enriched chat + action dispatch)
// ============================================================================

import type { AIService, AIMessage } from '@openorbit/core/ai/provider-types'
import type { SkillService } from '@openorbit/core/skills/skill-types'
import { HIVE_SYSTEM_PROMPT } from './hive-tools'
import type { HiveClient } from '../hive-client'
import type { Device } from '../types'
import { dispatchAndPoll } from '../skills/poll-task'

const MAX_HISTORY = 20

export class HiveChatHandler {
  private history: AIMessage[] = []
  private cachedDevices: Device[] = []

  constructor(
    private ai: AIService,
    private getClient: () => HiveClient | null,
    private _skills?: SkillService
  ) {}

  async sendMessage(message: string): Promise<string> {
    this.history.push({ role: 'user', content: message })
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY)
    }

    // Step 1: Gather fleet context (also caches device list for name resolution)
    const snapshot = await this.buildSnapshot()

    // Step 2: Ask AI to either answer or request an action
    const systemPrompt = [
      HIVE_SYSTEM_PROMPT,
      '\n\nCurrent fleet state:\n' + snapshot,
      "\n\nIMPORTANT: Answer the user's question using the fleet state above.",
      'If the user wants to run a command on a device, respond with EXACTLY this format on the FIRST line:',
      'ACTION: exec [device] command here',
      'ACTION: read [device] /path/to/file',
      'ACTION: write [device] /path/to/file',
      'Put the device name or nickname in brackets — it does not need to be exact, the system will fuzzy-match it.',
      'Examples: [pi4], [raspberry], [macbook], [Pi 4] all work.',
      'Then explain what you are doing on the next line.',
      'Only use ACTION when the user explicitly asks to run/execute/install/check something on a device.',
      'For informational questions, just answer directly — no ACTION needed.'
    ].join('\n')

    const response = await this.chatWithRetry({
      systemPrompt,
      messages: this.history,
      tier: 'standard',
      task: 'hive-chat'
    })

    let reply = response.content

    // Step 3: If AI requested an action, resolve device name and execute
    const actionMatch = reply.match(/^ACTION:\s*(exec|read|write)\s+\[([^\]]+)\]\s+(.+)$/m)
    if (actionMatch) {
      const [, action, deviceRef, arg] = actionMatch

      // Fuzzy-resolve device name
      const resolved = this.resolveDevice(deviceRef)
      if (resolved.error) {
        reply = resolved.error
      } else {
        try {
          const rawResult = await this.executeAction(action, resolved.name!, arg)
          reply = await this.summarizeResult(message, resolved.name!, arg, rawResult)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          reply = `Failed to run \`${arg}\` on ${resolved.name}: ${errMsg}`
        }
      }
    }

    this.history.push({ role: 'assistant', content: reply })
    return reply
  }

  // ---------------------------------------------------------------------------
  // AI call with retry for transient errors
  // ---------------------------------------------------------------------------

  private async chatWithRetry(
    request: Parameters<AIService['chat']>[0],
    retries = 1
  ): ReturnType<AIService['chat']> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.ai.chat(request)
      } catch (err) {
        const isRecoverable =
          err != null &&
          typeof err === 'object' &&
          'recoverable' in err &&
          (err as Record<string, unknown>).recoverable === true
        if (isRecoverable && attempt < retries) {
          // Wait briefly then retry
          await new Promise((r) => setTimeout(r, 2000))
          continue
        }
        throw err
      }
    }
    throw new Error('AI request failed after retries')
  }

  // ---------------------------------------------------------------------------
  // Device name resolution — fuzzy matches user input to actual device names
  // ---------------------------------------------------------------------------

  private resolveDevice(ref: string): { name?: string; error?: string } {
    const devices = this.cachedDevices
    if (devices.length === 0) {
      return { error: 'No devices found in the fleet.' }
    }

    const needle = ref.toLowerCase().replace(/[^a-z0-9]/g, '')

    // 1. Exact match (case-insensitive)
    const exact = devices.find((d) => d.name.toLowerCase() === ref.toLowerCase())
    if (exact) return { name: exact.name }

    // 2. Exact ID match
    const byId = devices.find((d) => d.id.toLowerCase() === ref.toLowerCase())
    if (byId) return { name: byId.name }

    // 3. Fuzzy: normalized name contains needle or needle contains normalized name
    const fuzzy = devices.filter((d) => {
      const norm = d.name.toLowerCase().replace(/[^a-z0-9]/g, '')
      return norm.includes(needle) || needle.includes(norm)
    })
    if (fuzzy.length === 1) return { name: fuzzy[0].name }

    // 4. Partial: any word in the device name starts with needle
    const partial = devices.filter((d) =>
      d.name
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.startsWith(needle) || needle.startsWith(w))
    )
    if (partial.length === 1) return { name: partial[0].name }

    // 5. Substring match anywhere
    const substr = devices.filter((d) => d.name.toLowerCase().includes(ref.toLowerCase()))
    if (substr.length === 1) return { name: substr[0].name }

    // Ambiguous or no match
    const names = devices.map((d) => d.name).join(', ')
    if (fuzzy.length > 1 || partial.length > 1 || substr.length > 1) {
      const matches = [...new Set([...fuzzy, ...partial, ...substr])].map((d) => d.name)
      return {
        error: `"${ref}" matches multiple devices: ${matches.join(', ')}. Please be more specific.`
      }
    }

    return { error: `No device matching "${ref}" found. Available devices: ${names}` }
  }

  // ---------------------------------------------------------------------------
  // Fleet snapshot
  // ---------------------------------------------------------------------------

  private async buildSnapshot(): Promise<string> {
    const client = this.getClient()
    if (!client) return 'Hive not configured — set hive.url and hive.api-key in settings.'

    const sections: string[] = []

    try {
      const [devices, tasks, health] = await Promise.all([
        client.listDevices().catch(() => [] as Device[]),
        client.listTasks({ limit: 10 }).catch(() => []),
        client.health().catch(() => null)
      ])

      // Cache for device name resolution
      this.cachedDevices = devices

      // Server health
      if (health) {
        const h = Math.floor(health.uptime / 3600)
        const m = Math.floor((health.uptime % 3600) / 60)
        sections.push(`Server: ${health.status}, uptime ${h}h ${m}m`)
      }

      // Devices
      const online = devices.filter((d) => d.status === 'online')
      const offline = devices.filter((d) => d.status !== 'online')
      sections.push(
        `Devices (${devices.length} total, ${online.length} online, ${offline.length} offline):`
      )
      for (const d of devices) {
        const hw = d.hardwareInfo as Record<string, unknown> | undefined
        const parts = [
          `  - ${d.name} [${d.status}]`,
          hw?.os ? `OS: ${hw.os}` : null,
          hw?.cpu ? `CPU: ${(hw.cpu as Record<string, unknown>).model ?? 'unknown'}` : null,
          d.ipAddress ? `IP: ${d.ipAddress}` : null,
          (d as Record<string, unknown>).minionVersion
            ? `v${(d as Record<string, unknown>).minionVersion}`
            : null
        ]
        sections.push(parts.filter(Boolean).join(' | '))
      }

      // Recent tasks
      if (tasks.length > 0) {
        sections.push(`\nRecent tasks (${tasks.length}):`)
        for (const t of tasks as Array<Record<string, unknown>>) {
          const id = String(t.id ?? '').slice(0, 8)
          sections.push(`  - ${id} → ${t.targetDevice ?? '?'} [${t.status}] ${t.type ?? ''}`)
        }
      } else {
        sections.push('\nNo recent tasks.')
      }

      // Fetch additional context in parallel (non-critical)
      const [schedules, groups, alerts] = await Promise.all([
        client.listSchedules().catch(() => []),
        client.listGroups().catch(() => []),
        client.listAlerts({ active: true }).catch(() => [])
      ])

      if (schedules.length > 0) {
        sections.push(`\nSchedules (${schedules.length}):`)
        for (const s of schedules as Array<Record<string, unknown>>) {
          sections.push(`  - ${s.name}: ${s.cronExpression} → ${s.deviceId}`)
        }
      }

      if (groups.length > 0) {
        sections.push(`\nGroups (${groups.length}):`)
        for (const g of groups as Array<Record<string, unknown>>) {
          sections.push(`  - ${g.name} (tag: ${g.tagFilter})`)
        }
      }

      if (alerts.length > 0) {
        sections.push(`\nActive alerts (${alerts.length}):`)
        for (const a of alerts as Array<Record<string, unknown>>) {
          sections.push(`  - ${a.severity}: ${a.message} (${a.deviceId})`)
        }
      }
    } catch {
      sections.push('Could not reach Hive server.')
    }

    return sections.join('\n')
  }

  // ---------------------------------------------------------------------------
  // Action execution + summarization
  // ---------------------------------------------------------------------------

  private async summarizeResult(
    userMessage: string,
    device: string,
    command: string,
    rawOutput: string
  ): Promise<string> {
    const summaryResponse = await this.ai.chat({
      systemPrompt: [
        'You are a fleet management assistant. The user asked something, and a command was run on a device.',
        'Summarize the result in a clear, concise, human-readable way.',
        'Use plain text, not markdown tables. Use bullet points or short paragraphs.',
        'If it is disk space output, summarize the key filesystems and usage percentages.',
        'If it is a process list, highlight the important ones.',
        'Always mention which device the command ran on.',
        'Keep it brief — 2-5 lines max for simple results.'
      ].join('\n'),
      messages: [
        {
          role: 'user',
          content: `User asked: "${userMessage}"\n\nRan \`${command}\` on ${device}. Raw output:\n${rawOutput}`
        }
      ],
      tier: 'fast',
      task: 'hive-summarize'
    })
    return summaryResponse.content
  }

  private async executeAction(action: string, device: string, arg: string): Promise<string> {
    const client = this.requireClient()

    const instruction: Record<string, unknown> =
      action === 'exec'
        ? { type: 'exec', command: arg, timeout: 60000 }
        : action === 'read'
          ? { type: 'read', path: arg }
          : { type: 'write', path: arg, content: '' }

    const task = await dispatchAndPoll(client, device, instruction)

    if (task.status === 'failed' || task.status === 'timeout') {
      throw new Error(task.results?.[0]?.error ?? `Task ${task.status}`)
    }

    const result = task.results?.[0]?.result
    // Extract stdout from exec results ({ stdout, stderr, exitCode })
    if (result != null && typeof result === 'object') {
      const r = result as Record<string, unknown>
      if (typeof r.stdout === 'string') {
        const parts: string[] = []
        if (r.stdout.trim()) parts.push(r.stdout.trim())
        if (typeof r.stderr === 'string' && r.stderr.trim()) {
          parts.push(`stderr: ${r.stderr.trim()}`)
        }
        return parts.join('\n') || `Command completed (exit code ${r.exitCode ?? 0})`
      }
      return JSON.stringify(result, null, 2)
    }
    if (typeof result === 'string') return result
    return `Task completed (${task.status})`
  }

  private requireClient(): HiveClient {
    const client = this.getClient()
    if (!client) throw new Error('Hive not configured — set hive.url and hive.api-key in settings')
    return client
  }

  clearHistory(): void {
    this.history = []
  }
}
