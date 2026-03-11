import type { HttpInstruction, HttpResult } from '../types.js'

const DEFAULT_TIMEOUT = 10_000

export async function handleHttp(instruction: HttpInstruction): Promise<HttpResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), instruction.timeout ?? DEFAULT_TIMEOUT)

  try {
    const res = await fetch(instruction.url, {
      method: instruction.method,
      headers: instruction.headers,
      body: instruction.body,
      signal: controller.signal
    })

    const body = await res.text()
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => {
      headers[k] = v
    })

    return { status: res.status, headers, body }
  } finally {
    clearTimeout(timeout)
  }
}
