import * as pty from 'node-pty'
import type { InstructionType } from './types.js'

const DEFAULT_SHELL = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
const INACTIVITY_TIMEOUT_MS = 300_000 // 5 minutes

export type PtySendFn = (msg: Record<string, unknown>) => void

export class PtySessions {
  private sessions = new Map<
    string,
    { process: pty.IPty; inactivityTimer: ReturnType<typeof setTimeout> }
  >()
  private allowedOps: Set<InstructionType>
  private send: PtySendFn

  constructor(allowedOps: InstructionType[], send: PtySendFn) {
    this.allowedOps = new Set(allowedOps)
    this.send = send
  }

  open(sessionId: string, cols: number, rows: number, shell?: string): void {
    if (!this.allowedOps.has('pty')) {
      this.send({ type: 'pty-close', sessionId, error: 'Operation not allowed: pty' })
      return
    }

    if (this.sessions.has(sessionId)) {
      console.warn(`[pty] Session ${sessionId} already exists`)
      return
    }

    const proc = pty.spawn(shell ?? DEFAULT_SHELL, [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: process.env.HOME ?? '/',
      env: process.env as Record<string, string>
    })

    console.log(`[pty] Opened session ${sessionId} (pid ${proc.pid})`)

    proc.onData((data: string) => {
      this.send({
        type: 'pty-output',
        sessionId,
        data: Buffer.from(data).toString('base64')
      })
    })

    proc.onExit(({ exitCode }) => {
      console.log(`[pty] Session ${sessionId} exited (code ${exitCode})`)
      this.cleanup(sessionId)
      this.send({ type: 'pty-close', sessionId })
    })

    const inactivityTimer = this.startInactivityTimer(sessionId)
    this.sessions.set(sessionId, { process: proc, inactivityTimer })
  }

  input(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) {
      console.warn(`[pty] Input for unknown session ${sessionId}`)
      return
    }
    // Reset inactivity timer on input
    clearTimeout(session.inactivityTimer)
    session.inactivityTimer = this.startInactivityTimer(sessionId)
    // Decode base64 input and write to PTY
    session.process.write(Buffer.from(data, 'base64').toString())
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.process.resize(cols, rows)
  }

  close(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    console.log(`[pty] Closing session ${sessionId}`)
    session.process.kill()
    this.cleanup(sessionId)
  }

  closeAll(): void {
    for (const [sessionId] of this.sessions) {
      this.close(sessionId)
    }
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      clearTimeout(session.inactivityTimer)
      this.sessions.delete(sessionId)
    }
  }

  private startInactivityTimer(sessionId: string): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      console.log(`[pty] Session ${sessionId} timed out (inactivity)`)
      this.close(sessionId)
      this.send({ type: 'pty-close', sessionId })
    }, INACTIVITY_TIMEOUT_MS)
  }
}
