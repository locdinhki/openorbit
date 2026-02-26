// ============================================================================
// GHL API Client — ported from go-high-level-connector test project
// Removed cache: 'no-store' (incompatible with Node.js/Electron)
// ============================================================================

const BASE_URL = 'https://services.leadconnectorhq.com'

export class GHLError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`GHL API error ${status}: ${message}`)
    this.name = 'GHLError'
  }
}

export interface GHLClientConfig {
  apiToken: string
  apiVersion?: string
}

export class GHLClient {
  private token: string
  private version: string

  constructor(config: GHLClientConfig) {
    this.token = config.apiToken
    this.version = config.apiVersion ?? '2021-07-28'
  }

  private headers(contentType = false): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/json',
      Version: this.version
    }
    if (contentType) {
      h['Content-Type'] = 'application/json'
    }
    return h
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string>
  ): Promise<T> {
    let url = `${BASE_URL}${path}`
    if (query) {
      const params = new URLSearchParams(query)
      url += `?${params.toString()}`
    }

    const res = await fetch(url, {
      method,
      headers: this.headers(!!body),
      body: body ? JSON.stringify(body) : undefined
    })

    if (!res.ok) {
      const text = await res.text()
      let message: string
      try {
        const json = JSON.parse(text)
        message = json.message ?? json.msg ?? text
      } catch {
        message = text
      }
      throw new GHLError(res.status, message)
    }

    if (res.status === 204) return undefined as T
    return res.json() as Promise<T>
  }

  get<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, query)
  }

  post<T>(path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    return this.request<T>('POST', path, body, query)
  }

  put<T>(path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    return this.request<T>('PUT', path, body, query)
  }

  patch<T>(path: string, body?: unknown, query?: Record<string, string>): Promise<T> {
    return this.request<T>('PATCH', path, body, query)
  }

  delete<T>(path: string, query?: Record<string, string>): Promise<T> {
    return this.request<T>('DELETE', path, undefined, query)
  }
}
