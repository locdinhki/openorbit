import chalk from 'chalk'
import { request } from '../api.js'

interface Alert {
  id: string
  ruleId: string
  deviceId: string
  triggeredAt: string
  resolvedAt: string | null
  message: string | null
}

export async function alerts(opts: { all?: boolean }): Promise<void> {
  const params = new URLSearchParams()
  if (!opts.all) params.set('active', 'true')
  const qs = params.toString()

  const list = await request<Alert[]>(`/api/alerts${qs ? `?${qs}` : ''}`)

  if (list.length === 0) {
    console.log(chalk.gray(opts.all ? 'No alerts found' : 'No active alerts'))
    return
  }

  console.log(
    chalk.gray(
      `${'ID'.padEnd(14)} ${'DEVICE'.padEnd(14)} ${'STATUS'.padEnd(10)} ${'TRIGGERED'.padEnd(22)} MESSAGE`
    )
  )
  console.log(chalk.gray('-'.repeat(90)))

  for (const a of list) {
    const id = a.id.slice(0, 12).padEnd(14)
    const device = a.deviceId.slice(0, 12).padEnd(14)
    const status = a.resolvedAt
      ? chalk.green('resolved'.padEnd(10))
      : chalk.red('active'.padEnd(10))
    const triggered = new Date(a.triggeredAt).toLocaleString().padEnd(22)
    const message = a.message ?? '-'

    console.log(`${id} ${device} ${status} ${triggered} ${message}`)
  }

  console.log(chalk.gray(`\n${list.length} alert(s)`))
}
