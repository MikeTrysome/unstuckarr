export interface IgnoreEntry {
  id: number
  download_hash: string
  instance_name: string
  title: string
  expires_at: string | null
  created_at: string
}

export interface CleanupEvent {
  id: number
  timestamp: string
  instance_name: string
  arr_queue_id: number | null
  title: string
  download_hash: string | null
  error_type: string | null
  error_message: string | null
  action: string
  search_type: string | null
  dry_run: boolean
  triggered_by: string
  run_id: string | null
}

export interface EventListResponse {
  items: CleanupEvent[]
  total: number
  page: number
  page_size: number
}

export interface MonitoringItem {
  arr_queue_id: number | null
  title: string
  instance_name: string
  download_hash: string | null
  arr_error_message: string | null
  added_at: string | null
  strike_count: number
  strike_threshold: number
}

export interface StuckItem {
  arr_queue_id: number | null
  title: string
  instance_name: string
  download_hash: string | null
  error_type: string
  error_message: string
  added_at: string | null
  retry_count: number
  strike_count: number
  strike_threshold: number
  speed_bytes: number | null
}

export interface Run {
  run_id: string
  started_at: string
  finished_at: string | null
  dry_run: boolean
  total_checked: number
  total_stuck: number
  total_removed: number
  status: string
  error_message: string | null
}

export interface RunListResponse {
  items: Run[]
  total: number
}

export interface DashboardData {
  total_removed_24h: number
  total_stuck_24h: number
  by_instance: Record<string, { removed: number; dry_run: number }>
  last_run: {
    run_id: string | null
    started_at: string | null
    status: string | null
    total_stuck: number | null
    total_removed: number | null
    dry_run: boolean | null
  }
  next_run_at: string | null
  scheduler_enabled: boolean
}

export interface NotificationProvider {
  id: string
  type: string
  name: string
  enabled: boolean
  url: string
  events: string[]
}

export const NOTIFICATION_EVENTS: { key: string; label: string; description: string }[] = [
  { key: 'strike',      label: 'Strike (Error)',  description: 'Item gets a strike for an infringing file or task canceled error' },
  { key: 'slow_strike', label: 'Strike (Slow)',   description: 'Item gets a strike for being below the speed threshold' },
  { key: 'removed',     label: 'Removed',         description: 'Item is removed from the ARR queue and re-queued automatically' },
  { key: 'retry',       label: 'Retry',           description: 'Soft retry is triggered via RDT (task canceled only)' },
]

export interface DbConfig {
  detection_infringing_min_age_minutes: number
  detection_canceled_min_age_minutes: number
  detection_min_retry_count: number
  scheduler_dry_run: boolean
  scheduler_enabled: boolean
  scheduler_interval_minutes: number
  notifications_providers: NotificationProvider[]
  strikes_enabled: boolean
  strikes_infringing_threshold: number
  strikes_canceled_threshold: number
  detection_slow_speed_enabled: boolean
  detection_slow_speed_threshold_kb: number
  detection_slow_speed_min_age_minutes: number
  detection_slow_min_completion_pct: number
  detection_slow_max_completion_pct: number
  strikes_slow_threshold: number
}

export interface ConnectionConfig {
  sonarr_host: string
  sonarr_port: number
  sonarr_api_key_set: boolean
  sonarr_enabled: boolean
  sonarr4k_host: string
  sonarr4k_port: number
  sonarr4k_api_key_set: boolean
  sonarr4k_enabled: boolean
  radarr_host: string
  radarr_port: number
  radarr_api_key_set: boolean
  radarr_enabled: boolean
  radarr4k_host: string
  radarr4k_port: number
  radarr4k_api_key_set: boolean
  radarr4k_enabled: boolean
  rdt_host: string
  rdt_port: number
  rdt_username: string
  rdt_password_set: boolean
  rdt_enabled: boolean
}

export interface ConnectionConfigUpdate {
  sonarr_host?: string
  sonarr_port?: number
  sonarr_api_key?: string
  sonarr_enabled?: boolean
  sonarr4k_host?: string
  sonarr4k_port?: number
  sonarr4k_api_key?: string
  sonarr4k_enabled?: boolean
  radarr_host?: string
  radarr_port?: number
  radarr_api_key?: string
  radarr_enabled?: boolean
  radarr4k_host?: string
  radarr4k_port?: number
  radarr4k_api_key?: string
  radarr4k_enabled?: boolean
  rdt_host?: string
  rdt_port?: number
  rdt_username?: string
  rdt_password?: string
  rdt_enabled?: boolean
}

export interface FullConfig {
  connections: ConnectionConfig
  db: DbConfig
}

export interface LogMessage {
  level: string
  msg: string
  ts: string
  run_id?: string
  type?: string
}
