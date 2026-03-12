import chalk from 'chalk'
import { request } from '../api.js'

interface Task {
  id: string
  targetDevice: string | null
  status: string
  instruction: { type?: string }
  createdAt: string
}

export async function tasks(opts: { device?: string; status?: string }): Promise<void> {
  const params = new URLSearchParams()
  if (opts.device) params.set('deviceId', opts.device)
  if (opts.status) params.set('status', opts.status)
  params.set('limit', '50')
  const qs = params.toString()

  const list = await request<Task[]>(`/api/tasks${qs ? `?${qs}` : ''}`)

  if (list.length === 0) {
    console.log(chalk.gray('No tasks found'))
    return
  }

  console.log(
    chalk.gray(
      `${'ID'.padEnd(14)} ${'STATUS'.padEnd(12)} ${'TYPE'.padEnd(16)} ${'DEVICE'.padEnd(14)} CREATED`
    )
  )
  console.log(chalk.gray('-'.repeat(80)))

  for (const t of list) {
    const statusColor =
      t.status === 'completed'
        ? chalk.green
        : t.status === 'failed'
          ? chalk.red
          : t.status === 'running'
            ? chalk.yellow
            : chalk.gray

    const id = t.id.slice(0, 12).padEnd(14)
    const status = statusColor(t.status.padEnd(12))
    const type = (t.instruction?.type ?? '-').slice(0, 14).padEnd(16)
    const device = (t.targetDevice?.slice(0, 12) ?? '-').padEnd(14)
    const created = new Date(t.createdAt).toLocaleString()

    console.log(`${id} ${status} ${type} ${device} ${created}`)
  }

  console.log(chalk.gray(`\n${list.length} task(s)`))
}
