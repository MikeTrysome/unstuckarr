import type { CleanupEvent, ConnectionConfigUpdate, DashboardData, DbConfig, EventListResponse, FullConfig, Run, RunListResponse, StuckItem } from '../types'
import { clearToken, getToken } from './auth'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new Error('401: Unauthorized')
  }
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  dashboard: {
    get: () => req<DashboardData>('/dashboard'),
  },

  queue: {
    getStuck: (instance?: string) =>
      req<StuckItem[]>(`/queue${instance ? `?instance=${encodeURIComponent(instance)}` : ''}`),
    getRdtTorrents: () => req<unknown[]>('/queue/rdt-torrents'),
  },

  events: {
    list: (params?: { instance?: string; action?: string; page?: number; page_size?: number }) => {
      const q = new URLSearchParams()
      if (params?.instance) q.set('instance', params.instance)
      if (params?.action) q.set('action', params.action)
      if (params?.page) q.set('page', String(params.page))
      if (params?.page_size) q.set('page_size', String(params.page_size))
      return req<EventListResponse>(`/events${q.size ? `?${q}` : ''}`)
    },
    get: (id: number) => req<CleanupEvent>(`/events/${id}`),
  },

  actions: {
    dryRun: () => req<{ status: string; dry_run: boolean }>('/actions/dry-run', { method: 'POST' }),
    execute: () => req<{ status: string; dry_run: boolean }>('/actions/execute', { method: 'POST' }),
    getRuns: (page?: number) => req<RunListResponse>(`/actions/runs${page ? `?page=${page}` : ''}`),
    getRun: (id: string) => req<Run>(`/actions/runs/${id}`),
  },

  config: {
    get: () => req<FullConfig>('/config'),
    update: (data: { connections?: ConnectionConfigUpdate; db?: Partial<DbConfig> }) =>
      req<FullConfig>('/config', { method: 'PUT', body: JSON.stringify(data) }),
    testAll: () => req<Record<string, boolean>>('/config/test-connection', { method: 'POST' }),
    testOne: (name: string, creds?: { host?: string; port?: number; api_key?: string }) =>
      req<{ ok: boolean }>(`/config/test-connection/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: JSON.stringify(creds ?? {}),
      }),
  },

  auth: {
    status: () => req<{ configured: boolean }>('/auth/status'),
    setup: (username: string, password: string) =>
      req<{ ok: boolean }>('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password }) }),
    login: (username: string, password: string) =>
      req<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    changePassword: (current_password: string, new_password: string) =>
      req<{ ok: boolean }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password, new_password }) }),
    changeUsername: (current_password: string, new_username: string) =>
      req<{ ok: boolean }>('/auth/change-username', { method: 'POST', body: JSON.stringify({ current_password, new_username }) }),
  },
}
