function getCsrfToken(): string | undefined {
  if (typeof document === "undefined") return undefined
  const el = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null
  return el?.content
}

export class ApiClient {
  constructor(private readonly baseUrl: string = "") {}

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const url = this.buildUrl(path, params)
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
    })
    return this.handleJson<T>(res)
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const csrf = getCsrfToken()
    const res = await fetch(this.buildUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    })
    return this.handleJson<T>(res)
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const csrf = getCsrfToken()
    const res = await fetch(this.buildUrl(path), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      },
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    })
    return this.handleJson<T>(res)
  }

  private buildUrl(path: string, params?: Record<string, unknown>): string {
    const usp = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return
        usp.set(k, String(v))
      })
    }
    const qs = usp.toString()
    if (!this.baseUrl) {
      return qs ? `${path}?${qs}` : path
    }
    const base = this.baseUrl.endsWith("/")
      ? this.baseUrl.slice(0, -1)
      : this.baseUrl
    const p = path.startsWith("/") ? path : `/${path}`
    return qs ? `${base}${p}?${qs}` : `${base}${p}`
  }

  private async handleJson<T>(res: Response): Promise<T> {
    const text = await res.text()
    const data = text ? JSON.parse(text) : null
    if (!res.ok) {
      const err: any = new Error(
        data?.message || `HTTP ${res.status} ${res.statusText}`
      )
      err.status = res.status
      err.details = data
      throw err
    }
    return data as T
  }
}

export const apiClient = new ApiClient()


