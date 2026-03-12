import chalk from 'chalk'
import ora from 'ora'
import { request } from '../api.js'

export async function update(deviceId?: string, opts?: { all?: boolean }): Promise<void> {
  if (opts?.all) {
    const spinner = ora('Updating all outdated devices...').start()
    try {
      const result = await request<{ version: string; deviceCount: number }>(
        '/api/minion/update-all',
        { method: 'POST', body: '{}' }
      )
      spinner.succeed(`Update dispatched to ${result.deviceCount} device(s) → v${result.version}`)
    } catch (err) {
      spinner.fail(err instanceof Error ? err.message : 'Failed')
      process.exitCode = 1
    }
    return
  }

  if (!deviceId) {
    console.error(chalk.red('Usage: hive-ctl update <device-id> or hive-ctl update --all'))
    process.exitCode = 1
    return
  }

  const spinner = ora(`Updating device ${deviceId}...`).start()
  try {
    await request(`/api/minion/update/${deviceId}`, { method: 'POST', body: '{}' })
    spinner.succeed(`Update dispatched to ${deviceId}`)
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : 'Failed')
    process.exitCode = 1
  }
}
