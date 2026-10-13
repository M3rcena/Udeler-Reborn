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

// ============= Main Content =============
export interface CourseAuthor {
  id: string
  name: string
  avatarUrl?: string
}

export interface CourseItem {
  id: string
  platformId: PlatformId
  title: string
  headline?: string
  thumbnailUrl: string
  instructors: CourseAuthor[]
  totalLectures: number
  totalDurationSeconds: number
  progressPercent: number
  isDownloaded: boolean
  downloadedLecturesCount: number
  lastAccessedAt?: number
  url: string
}

export type CourseFilterStatus = 'all' | 'downloaded' | 'in-progress' | 'completed'
export type CourseSortOption = 'recent' | 'title' | 'progress' | 'lectures'

// ============= Udemy Types ===============
export interface UdemyRawCourse {
  id: number
  title: string
  headline?: string
  url: string
  image_480x270?: string
  image_240x135?: string
  visible_instructors?: Array<{
    id: number
    title: string
    display_name?: string
    image_50x50?: string
  }>
  num_published_lectures?: number
  estimated_content_length?: number
  completion_ratio?: number
  last_accessed_time?: string
}

export interface UdemyPaginatedResponse {
  count: number
  next: string | null
  previous: string | null
  results: UdemyRawCourse[]
}

// ============= About Types ===============
export interface AppVersionInfo {
  version: string
  platform: string
  arch?: string
  electron?: string
  node?: string
  chrome?: string
}
