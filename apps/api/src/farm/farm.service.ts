import { Injectable, Logger } from '@nestjs/common'
import { Phone, Account } from '@atome/shared'

@Injectable()
export class FarmService {
  private readonly logger  = new Logger(FarmService.name)
  private readonly baseUrl = process.env.ORCHESTRATOR_URL ?? 'http://localhost:8001'

  private async get<T>(path: string): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch {
      this.logger.warn(`Orchestrator unavailable: GET ${path}`)
      return null
    }
  }

  private async post<T>(path: string, body?: unknown): Promise<T | null> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method:  'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body:    body ? JSON.stringify(body) : undefined,
        signal:  AbortSignal.timeout(5000),
      })
      if (!res.ok) return null
      return res.json() as Promise<T>
    } catch {
      this.logger.warn(`Orchestrator unavailable: POST ${path}`)
      return null
    }
  }

  getPhones(): Promise<Phone[]> {
    return this.get<Phone[]>('/api/devices').then(r => r ?? [])
  }

  getPhone(id: string): Promise<Phone | null> {
    return this.get<Phone>(`/api/devices/${id}`)
  }

  pausePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/devices/${id}/pause`).then(r => ({ ok: r !== null }))
  }

  resumePhone(id: string): Promise<{ ok: boolean }> {
    return this.post(`/api/devices/${id}/resume`).then(r => ({ ok: r !== null }))
  }

  getAccounts(): Promise<Account[]> {
    return this.get<Account[]>('/api/accounts').then(r => r ?? [])
  }

  createAccount(data: Partial<Account>): Promise<Account | null> {
    return this.post<Account>('/api/accounts', data)
  }
}
