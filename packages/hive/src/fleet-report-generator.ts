// ============================================================================
// Fleet Report Generator — AI-powered daily fleet health summary
// ============================================================================

import type { Store, FleetReport } from './store.js'

/**
 * Generate a fleet health report for the last 24 hours.
 * Uses ANTHROPIC_API_KEY to call Claude for the AI analysis.
 */
export async function generateFleetReport(store: Store): Promise<FleetReport> {
  const periodEnd = new Date()
  const periodStart = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Gather data
  const devices = await store.listDevices()
  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.length - onlineCount

  // Per-device metrics summary
  const deviceSummaries: string[] = []
  for (const device of devices) {
    const metrics = await store.getMetrics(device.id, 120) // ~1h at 30s intervals, more for 24h
    if (metrics.length === 0) {
      deviceSummaries.push(`- **${device.name}** (${device.status}): No metrics available`)
      continue
    }
    const cpuValues = metrics.map((m) => m.cpuPercent ?? 0)
    const memValues = metrics.map((m) => m.memPercent ?? 0)
    const avgCpu = cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length
    const peakCpu = Math.max(...cpuValues)
    const avgMem = memValues.reduce((a, b) => a + b, 0) / memValues.length
    const peakMem = Math.max(...memValues)
    deviceSummaries.push(
      `- **${device.name}** (${device.status}): CPU avg ${avgCpu.toFixed(1)}% / peak ${peakCpu.toFixed(1)}%, RAM avg ${avgMem.toFixed(1)}% / peak ${peakMem.toFixed(1)}%`
    )
  }

  // Alerts summary
  const allAlerts = await store.listAlerts({})
  const recentAlerts = allAlerts.filter(
    (a) => new Date(a.triggeredAt).getTime() >= periodStart.getTime()
  )
  const resolvedCount = recentAlerts.filter((a) => a.resolvedAt).length

  // Task summary
  const tasks = await store.listTasks({ limit: 5000 })
  const recentTasks = tasks.filter((t) => new Date(t.createdAt).getTime() >= periodStart.getTime())
  const completedTasks = recentTasks.filter((t) => t.status === 'completed').length
  const failedTasks = recentTasks.filter((t) => t.status === 'failed').length

  // Health checks summary
  const checks = await store.listHealthChecks()
  const checkSummaries: string[] = []
  for (const check of checks) {
    const latest = await store.getLatestHealthCheckResult(check.id)
    const device = devices.find((d) => d.id === check.deviceId)
    checkSummaries.push(
      `- ${check.name} (${device?.name ?? check.deviceId}): ${latest?.status ?? 'no data'}`
    )
  }

  // Build the data context
  const dataContext = `## Fleet Status
- Online: ${onlineCount}, Offline: ${offlineCount}, Total: ${devices.length}
- Uptime: ${devices.length > 0 ? ((onlineCount / devices.length) * 100).toFixed(1) : 0}%

## Device Metrics (recent readings)
${deviceSummaries.join('\n')}

## Alerts (last 24h)
- Total fired: ${recentAlerts.length}
- Resolved: ${resolvedCount}
- Still active: ${recentAlerts.length - resolvedCount}

## Tasks (last 24h)
- Total: ${recentTasks.length}
- Completed: ${completedTasks}
- Failed: ${failedTasks}
- Success rate: ${recentTasks.length > 0 ? ((completedTasks / recentTasks.length) * 100).toFixed(1) : 'N/A'}%

## Health Checks
${checkSummaries.length > 0 ? checkSummaries.join('\n') : 'No health checks configured.'}`

  // Try AI generation, fallback to raw data
  let content: string

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    try {
      content = await generateWithAI(apiKey, dataContext)
    } catch (err) {
      console.error('[fleet-report] AI generation failed, using raw data:', err)
      content = `# Fleet Health Report\n\n${dataContext}`
    }
  } else {
    content = `# Fleet Health Report\n\n${dataContext}`
  }

  const report = await store.createFleetReport({
    content,
    periodStart,
    periodEnd
  })

  console.log(`[fleet-report] Generated report ${report.id}`)
  return report
}

async function generateWithAI(apiKey: string, dataContext: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are a fleet operations analyst. Generate a concise daily health report in Markdown based on the following data. Include:
1. Fleet status snapshot
2. Per-device metric summary with notable trends
3. Alert summary and resolution rate
4. Task performance overview
5. Any anomalies or recommendations

Data:
${dataContext}

Write the report in a clear, professional tone. Keep it concise — one screen of content.`
        }
      ]
    })
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${text}`)
  }

  const body = (await res.json()) as { content: Array<{ type: string; text: string }> }
  return body.content[0]?.text ?? '(empty response)'
}

/**
 * Send report to Telegram.
 */
export async function sendReportToTelegram(content: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!botToken || !chatId) return

  // Truncate for Telegram's 4096 char limit
  const truncated = content.length > 4000 ? content.slice(0, 3997) + '...' : content

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: truncated, parse_mode: 'Markdown' })
    })
  } catch (err) {
    console.error('[fleet-report] Telegram send failed:', err instanceof Error ? err.message : err)
  }
}
