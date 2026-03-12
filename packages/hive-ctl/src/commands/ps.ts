import chalk from 'chalk'
import { request } from '../api.js'

interface Device {
  id: string
  name: string
  status: string
  type: string
  ipAddress: string | null
  minionVersion: string | null
  lastSeenAt: string | null
  locationTag: string | null
}

export async function ps(opts: { online?: boolean }): Promise<void> {
  let devices = await request<Device[]>('/api/devices')

  if (opts.online) {
    devices = devices.filter((d) => d.status === 'online')
  }

  if (devices.length === 0) {
    console.log(chalk.gray('No devices found'))
    return
  }

  // Table header
  console.log(
    chalk.gray(
      `${'ID'.padEnd(14)} ${'NAME'.padEnd(20)} ${'STATUS'.padEnd(10)} ${'TYPE'.padEnd(12)} ${'IP'.padEnd(18)} ${'VERSION'.padEnd(10)} TAG`
    )
  )
  console.log(chalk.gray('-'.repeat(100)))

  for (const d of devices) {
    const statusColor =
      d.status === 'online' ? chalk.green : d.status === 'busy' ? chalk.yellow : chalk.red
    const id = d.id.slice(0, 12)
    const name = d.name.slice(0, 18).padEnd(20)
    const status = statusColor(d.status.padEnd(10))
    const type = d.type.padEnd(12)
    const ip = (d.ipAddress ?? '-').padEnd(18)
    const version = (d.minionVersion ?? '-').padEnd(10)
    const tag = d.locationTag ?? '-'

    console.log(`${id.padEnd(14)} ${name} ${status} ${type} ${ip} ${version} ${tag}`)
  }

  console.log(chalk.gray(`\n${devices.length} device(s)`))
}
