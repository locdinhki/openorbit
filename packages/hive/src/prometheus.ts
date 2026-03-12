// ============================================================================
// Prometheus Metrics — /metrics endpoint in text exposition format
// ============================================================================

import type { Store } from './store.js'

/**
 * Build Prometheus text exposition format from current fleet state.
 */
export async function buildPrometheusText(store: Store): Promise<string> {
  const lines: string[] = []

  // Device counts
  const devices = await store.listDevices()
  const online = devices.filter((d) => d.status === 'online').length
  const offline = devices.filter((d) => d.status !== 'online').length
  lines.push(`# HELP hive_device_count Number of devices by status`)
  lines.push(`# TYPE hive_device_count gauge`)
  lines.push(`hive_device_count{status="online"} ${online}`)
  lines.push(`hive_device_count{status="offline"} ${offline}`)

  // Task totals
  const allTasks = await store.listTasks({ limit: 10000 })
  const tasksByStatus = new Map<string, number>()
  for (const t of allTasks) {
    tasksByStatus.set(t.status, (tasksByStatus.get(t.status) ?? 0) + 1)
  }
  lines.push(`# HELP hive_task_total Total tasks by status`)
  lines.push(`# TYPE hive_task_total gauge`)
  for (const [status, count] of tasksByStatus) {
    lines.push(`hive_task_total{status="${status}"} ${count}`)
  }

  // Per-device CPU/RAM from latest metrics
  lines.push(`# HELP hive_device_cpu_percent Latest CPU percent by device`)
  lines.push(`# TYPE hive_device_cpu_percent gauge`)
  lines.push(`# HELP hive_device_mem_percent Latest memory percent by device`)
  lines.push(`# TYPE hive_device_mem_percent gauge`)

  for (const device of devices) {
    const metrics = await store.getMetrics(device.id, 1)
    if (metrics.length > 0) {
      const m = metrics[0]
      const label = device.name.replace(/"/g, '\\"')
      if (m.cpuPercent != null) {
        lines.push(`hive_device_cpu_percent{device="${label}"} ${m.cpuPercent}`)
      }
      if (m.memPercent != null) {
        lines.push(`hive_device_mem_percent{device="${label}"} ${m.memPercent}`)
      }
    }
  }

  // Active alerts
  const activeAlerts = await store.listAlerts({ activeOnly: true })
  lines.push(`# HELP hive_alert_active Number of active alerts`)
  lines.push(`# TYPE hive_alert_active gauge`)
  lines.push(`hive_alert_active ${activeAlerts.length}`)

  // Health check status (1 = pass, 0 = fail)
  const checks = await store.listHealthChecks()
  if (checks.length > 0) {
    lines.push(`# HELP hive_health_check_status Health check status (1=pass, 0=fail)`)
    lines.push(`# TYPE hive_health_check_status gauge`)
    for (const check of checks) {
      if (!check.enabled) continue
      const latest = await store.getLatestHealthCheckResult(check.id)
      const device = devices.find((d) => d.id === check.deviceId)
      const deviceLabel = (device?.name ?? check.deviceId).replace(/"/g, '\\"')
      const checkLabel = check.name.replace(/"/g, '\\"')
      const value = latest?.status === 'pass' ? 1 : latest?.status === 'fail' ? 0 : -1
      if (value >= 0) {
        lines.push(
          `hive_health_check_status{check="${checkLabel}",device="${deviceLabel}"} ${value}`
        )
      }
    }
  }

  return lines.join('\n') + '\n'
}
