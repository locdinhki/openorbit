import chalk from 'chalk'
import ora from 'ora'
import { request } from '../api.js'

interface Task {
  id: string
  status: string
  results?: Array<{
    status: string
    result?: { stdout?: string; stderr?: string }
    error?: string
    durationMs?: string
  }>
}

export async function exec(deviceId: string, command: string): Promise<void> {
  const spinner = ora(`Dispatching to ${deviceId}...`).start()

  try {
    const task = await request<Task>('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        targetDevice: deviceId,
        instruction: { type: 'exec', command }
      })
    })

    spinner.text = `Task ${task.id.slice(0, 8)} dispatched, waiting...`

    // Poll until complete
    const maxWait = 120_000
    const start = Date.now()
    const pollInterval = 2000

    while (Date.now() - start < maxWait) {
      await new Promise((r) => setTimeout(r, pollInterval))
      const updated = await request<Task>(`/api/tasks/${task.id}`)

      if (['completed', 'failed', 'timeout'].includes(updated.status)) {
        spinner.stop()

        if (updated.results && updated.results.length > 0) {
          const result = updated.results[0]
          if (result.result?.stdout) {
            process.stdout.write(result.result.stdout as string)
          }
          if (result.result?.stderr) {
            process.stderr.write(chalk.red(result.result.stderr as string))
          }
          if (result.error) {
            console.error(chalk.red(`Error: ${result.error}`))
          }
          if (result.durationMs) {
            console.log(chalk.gray(`\n(${result.durationMs}ms)`))
          }
        }

        if (updated.status === 'failed') {
          process.exitCode = 1
        }
        return
      }

      spinner.text = `Task ${task.id.slice(0, 8)} ${updated.status}...`
    }

    spinner.fail('Task timed out waiting for result')
    process.exitCode = 1
  } catch (err) {
    spinner.fail(err instanceof Error ? err.message : 'Failed')
    process.exitCode = 1
  }
}
