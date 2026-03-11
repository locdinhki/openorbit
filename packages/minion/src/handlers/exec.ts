import { spawn } from 'node:child_process'
import type { ExecInstruction, ExecResult } from '../types.js'

const DEFAULT_TIMEOUT = 60_000
const MAX_TIMEOUT = 600_000 // 10 minutes

export async function handleExec(
  instruction: ExecInstruction,
  maxOutputBytes: number
): Promise<ExecResult> {
  const timeout = Math.min(instruction.timeout ?? DEFAULT_TIMEOUT, MAX_TIMEOUT)
  const start = Date.now()

  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', instruction.command], {
      cwd: instruction.cwd,
      env: instruction.env ? { ...process.env, ...instruction.env } : process.env,
      timeout
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let stdoutLen = 0
    let stderrLen = 0

    child.stdout.on('data', (chunk: Buffer) => {
      if (stdoutLen < maxOutputBytes) {
        stdout.push(chunk)
        stdoutLen += chunk.length
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      if (stderrLen < maxOutputBytes) {
        stderr.push(chunk)
        stderrLen += chunk.length
      }
    })

    child.on('error', (err) => {
      reject(new Error(`exec failed: ${err.message}`))
    })

    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf-8').slice(0, maxOutputBytes),
        stderr: Buffer.concat(stderr).toString('utf-8').slice(0, maxOutputBytes),
        durationMs: Date.now() - start
      })
    })
  })
}
