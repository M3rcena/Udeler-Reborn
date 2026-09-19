export type PlatformId = 'udemy' | 'coursera' | 'skillshare' | 'edx'

export type UpdatePhase =
  'checking' | 'available' | 'not-available' | 'downloading' | 'verifying' | 'ready' | 'error'

export interface UpdateProgressPayload {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

export interface UpdaterStatusPayload {
  phase: UpdatePhase
  version?: string
  progress?: UpdateProgressPayload
  error?: string
}

export interface AppVersionInfo {
  version: string
  platform: string
}

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  subsystem: string
  message: string
  context?: Record<string, unknown>
}

// === Authentication & Platform Session Types ===

export interface PlatformSession {
  platformId: PlatformId
  username: string
  token: string
  cookies?: Record<string, string>
  expiresAt?: number
  subdomain?: string
  isBusiness?: boolean
}

export interface AuthResult {
  success: boolean
  session?: PlatformSession
  error?: string
}

export interface WebAuthOptions {
  platformId: PlatformId
  isBusiness?: boolean
  subdomain?: string
}
