import type { HelpNestConfig } from './types'

export class HttpClient {
  private baseUrl: string
  private workspace: string
  private apiKey: string

  constructor(config: HelpNestConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://helpnest.cloud').replace(/\/$/, '')
    this.workspace = config.workspace
    this.apiKey = config.apiKey
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}/api${path}`)
    url.searchParams.set('workspace', this.workspace)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }
    return url.toString()
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      'X-HelpNest-Workspace': this.workspace,
    }
  }

  async get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const res = await fetch(this.buildUrl(path, params), {
      method: 'GET',
      headers: this.headers,
    })
    return this.handleResponse<T>(res)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(res)
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.buildUrl(path), {
      method: 'PATCH',
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    return this.handleResponse<T>(res)
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(this.buildUrl(path), {
      method: 'DELETE',
      headers: this.headers,
    })
    return this.handleResponse<T>(res)
  }

  private async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let message = `HelpNest API error: ${res.status} ${res.statusText}`
      try {
        const err = await res.json() as { error?: string }
        if (err.error) message = `HelpNest API error: ${err.error}`
      } catch {}
      throw new HelpNestError(message, res.status)
    }
    return res.json() as Promise<T>
  }
}

export class HelpNestError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
    this.name = 'HelpNestError'
  }
}
