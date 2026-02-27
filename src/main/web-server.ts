import { createServer, type Server } from 'http'
import { readFileSync, existsSync, statSync } from 'fs'
import { join, extname } from 'path'
import { createLogger } from '@openorbit/core/utils/logger'

const log = createLogger('WebServer')

export const WEB_PORT = 18791

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
}

export class WebServer {
  private server: Server | null = null
  private readonly host: string
  private readonly port: number
  private readonly staticDir: string

  constructor(opts: { staticDir: string; host?: string; port?: number }) {
    this.staticDir = opts.staticDir
    this.host = opts.host ?? '0.0.0.0'
    this.port = opts.port ?? WEB_PORT
  }

  start(): void {
    if (!existsSync(this.staticDir)) {
      log.warn(`Web UI dir not found: ${this.staticDir} — server not started`)
      return
    }

    this.server = createServer((req, res) => {
      const url = req.url ?? '/'
      const pathname = url.split('?')[0]

      const filePath = join(this.staticDir, pathname)

      if (existsSync(filePath) && statSync(filePath).isFile()) {
        const ext = extname(filePath)
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream'
        const content = readFileSync(filePath)
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000'
        })
        res.end(content)
        return
      }

      // SPA fallback
      const indexPath = join(this.staticDir, 'index.html')
      if (existsSync(indexPath)) {
        const content = readFileSync(indexPath)
        res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' })
        res.end(content)
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    this.server.listen(this.port, this.host, () => {
      log.info(`Web UI serving on http://${this.host}:${this.port}`)
    })

    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        log.warn(`Web UI port ${this.port} in use — server not started`)
      } else {
        log.error('Web UI server error', err)
      }
    })
  }

  getPort(): number {
    return this.port
  }

  destroy(): void {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}
