import { getUrl, getApiKey } from './config.js'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = getUrl()
  const apiKey = getApiKey()

  const res = await fetch(`${url}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers
    }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }

  return res.json()
}
