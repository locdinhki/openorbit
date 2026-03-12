// ============================================================================
// Alert Engine — threshold checking + Telegram notifications
// ============================================================================

import type { Store } from './store.js'
import type { TriggerEngine } from './trigger-engine.js'

export class AlertEngine {
  triggerEngine?: TriggerEngine

  constructor(private store: Store) {}

  /** Called on every heartbeat that includes metrics. */
  async checkMetrics(
    deviceId: string,
    deviceName: string,
    metrics: { cpuPercent: number; memPercent: number }
  ): Promise<void> {
    const rules = await this.store.listAlertRules({ forDevice: deviceId })

    for (const rule of rules) {
      if (rule.metric === 'cpu') {
        await this.evaluateThreshold(
          rule.id,
          deviceId,
          deviceName,
          metrics.cpuPercent,
          'CPU',
          rule.threshold
        )
      } else if (rule.metric === 'mem') {
        await this.evaluateThreshold(
          rule.id,
          deviceId,
          deviceName,
          metrics.memPercent,
          'RAM',
          rule.threshold
        )
      }
    }
  }

  /** Called when a device goes offline. */
  async checkOffline(deviceId: string, deviceName: string): Promise<void> {
    const rules = await this.store.listAlertRules({ forDevice: deviceId })
    for (const rule of rules) {
      if (rule.metric !== 'offline') continue
      const active = await this.store.getActiveAlert(rule.id, deviceId)
      if (!active) {
        const message = `Device "${deviceName}" is offline`
        const alert = await this.store.createAlert({ ruleId: rule.id, deviceId, message })
        await this.sendTelegram(`🔴 Open Hive Alert\n${message}`)
        await this.store.markAlertNotified(alert.id)
        this.triggerEngine
          ?.evaluate({
            type: 'alert.fired',
            ruleId: rule.id,
            deviceId,
            deviceName,
            message
          })
          .catch(() => {})
      }
    }
  }

  /** Called when a device comes back online — resolve any open offline alerts. */
  async resolveOffline(deviceId: string, deviceName: string): Promise<void> {
    const rules = await this.store.listAlertRules({ forDevice: deviceId })
    for (const rule of rules) {
      if (rule.metric !== 'offline') continue
      const active = await this.store.getActiveAlert(rule.id, deviceId)
      if (active) {
        await this.store.resolveAlert(active.id)
        await this.sendTelegram(`✅ Open Hive: Device "${deviceName}" is back online`)
        this.triggerEngine
          ?.evaluate({
            type: 'alert.resolved',
            ruleId: rule.id,
            deviceId,
            deviceName
          })
          .catch(() => {})
      }
    }
  }

  private async evaluateThreshold(
    ruleId: string,
    deviceId: string,
    deviceName: string,
    value: number,
    label: string,
    threshold: number
  ): Promise<void> {
    const active = await this.store.getActiveAlert(ruleId, deviceId)

    if (value > threshold) {
      // Fire if no active alert
      if (!active) {
        const message = `Device "${deviceName}" ${label} at ${value}% (threshold: ${threshold}%)`
        const alert = await this.store.createAlert({ ruleId, deviceId, message })
        await this.sendTelegram(`⚠️ Open Hive Alert\n${message}`)
        await this.store.markAlertNotified(alert.id)
        this.triggerEngine
          ?.evaluate({
            type: 'alert.fired',
            ruleId,
            deviceId,
            deviceName,
            message
          })
          .catch(() => {})
      }
    } else {
      // Resolve if threshold no longer exceeded
      if (active) {
        await this.store.resolveAlert(active.id)
        this.triggerEngine
          ?.evaluate({
            type: 'alert.resolved',
            ruleId,
            deviceId,
            deviceName
          })
          .catch(() => {})
      }
    }
  }

  private async sendTelegram(text: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!botToken || !chatId) return

    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
      })
    } catch (err) {
      console.error('[alerts] Telegram send failed:', err instanceof Error ? err.message : err)
    }
  }
}
