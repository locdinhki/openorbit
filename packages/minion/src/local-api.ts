import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { MinionConfig, Instruction } from './types.js'
import type { Executor } from './executor.js'
import type { HardwareInfo } from './types.js'

export function startLocalApi(
  config: MinionConfig,
  executor: Executor,
  hardwareInfo: HardwareInfo
): ReturnType<typeof createServer> {
  const server = createServer(async (req, res) => {
    try {
      // GET /status — no auth required
      if (req.method === 'GET' && req.url === '/status') {
        return json(res, 200, {
          deviceName: config.deviceName,
          status: 'online',
          tags: config.tags,
          allowedOps: config.allowedOps,
          hardware: hardwareInfo
        })
      }

      // POST /exec — requires auth
      if (req.method === 'POST' && req.url === '/exec') {
        if (!authenticate(req, config.apiKey)) {
          return json(res, 401, { error: 'Unauthorized' })
        }

        const body = await readBody(req)
        let instruction: Instruction
        try {
          instruction = JSON.parse(body)
        } catch {
          return json(res, 400, { error: 'Invalid JSON' })
        }

        if (!instruction.type) {
          return json(res, 400, { error: 'Missing instruction type' })
        }

        const result = await executor.execute(instruction)
        return json(res, 200, { status: 'completed', result })
      }

      json(res, 404, { error: 'Not found' })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      json(res, 500, { status: 'error', error: message })
    }
  })

  const { port, bind } = config.localApi
  server.listen(port, bind, () => {
    console.log(`[local-api] Listening on ${bind}:${port}`)
  })

  return server
}

function authenticate(req: IncomingMessage, apiKey: string): boolean {
  if (!apiKey) return true // No key configured = no auth (dev mode)
  const auth = req.headers.authorization
  if (!auth) return false
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === apiKey
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}
