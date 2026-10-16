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

// ============= Settings Types ===============
export type PlatformFolderStrategy = 'subfolder' | 'prefix' | 'flat'
export type FileConflictAction = 'skip' | 'overwrite' | 'rename'
export type VideoQuality = 'Auto' | 'Highest' | '1080p' | '720p' | '480p' | '360p' | 'Lowest'
export type VideoFormat = 'mp4' | 'mkv'
export type SubtitleFormat = 'srt' | 'vtt'
export type ProxyMode = 'none' | 'system' | 'custom'
export type AppTheme = 'violet' | 'midnight' | 'cyberpunk' | 'light'
export type CardLayout = 'grid' | 'compact'

export interface AppSettings {
  // Downloads & Storage
  downloadPath: string
  organizeByPlatform: boolean
  platformFolderStrategy: PlatformFolderStrategy
  createSectionFolders: boolean
  autoNumberLectures: boolean
  zeroPadLectures: boolean
  fileConflictAction: FileConflictAction
  organizeByInstructor: boolean

  // Video & Audio Quality
  videoQuality: VideoQuality
  qualityFallback: boolean
  videoFormat: VideoFormat
  extractAudioOnly: boolean

  // Subtitles & Attachments
  downloadSubtitles: boolean
  subtitleLanguage: string
  downloadAllSubtitles: boolean
  subtitleFormat: SubtitleFormat
  downloadAttachments: boolean
  downloadDescriptions: boolean
  downloadSyllabus: boolean
  maxAttachmentSizeMb: number

  // Network & Bandwidth
  maxConcurrentDownloads: number
  enableSpeedLimit: boolean
  maxDownloadSpeedKbps: number
  autoRetry: boolean
  maxRetryAttempts: number
  requestTimeoutSec: number
  proxyMode: ProxyMode
  proxyHost: string
  proxyPort: string

  // Scheduler
  scheduleEnabled: boolean
  scheduleStart: string
  scheduleEnd: string
  scheduleDays: string[]
  pauseOutsideSchedule: boolean
  preventSleepWhileDownloading: boolean

  // Interface & Appearance
  theme: AppTheme
  locale: string
  cardLayout: CardLayout
  showPlatformBadge: boolean
  startOnBoot: boolean
  closeToTray: boolean
  minimizeToTray: boolean
  notifyOnCompletion: boolean
  hardwareAcceleration: boolean

  // Maintenance & Security
  vaultMode: boolean
}

export interface CategorizedSettings {
  downloads: Pick<
    AppSettings,
    | 'downloadPath'
    | 'organizeByPlatform'
    | 'platformFolderStrategy'
    | 'createSectionFolders'
    | 'autoNumberLectures'
    | 'zeroPadLectures'
    | 'fileConflictAction'
    | 'organizeByInstructor'
  >
  media: Pick<
    AppSettings,
    | 'videoQuality'
    | 'qualityFallback'
    | 'videoFormat'
    | 'extractAudioOnly'
    | 'downloadSubtitles'
    | 'subtitleLanguage'
    | 'downloadAllSubtitles'
    | 'subtitleFormat'
    | 'downloadAttachments'
    | 'downloadDescriptions'
    | 'downloadSyllabus'
    | 'maxAttachmentSizeMb'
  >
  network: Pick<
    AppSettings,
    | 'maxConcurrentDownloads'
    | 'enableSpeedLimit'
    | 'maxDownloadSpeedKbps'
    | 'autoRetry'
    | 'maxRetryAttempts'
    | 'requestTimeoutSec'
    | 'proxyMode'
    | 'proxyHost'
    | 'proxyPort'
  >
  scheduler: Pick<
    AppSettings,
    | 'scheduleEnabled'
    | 'scheduleStart'
    | 'scheduleEnd'
    | 'scheduleDays'
    | 'pauseOutsideSchedule'
    | 'preventSleepWhileDownloading'
  >
  interface: Pick<
    AppSettings,
    | 'theme'
    | 'locale'
    | 'cardLayout'
    | 'showPlatformBadge'
    | 'startOnBoot'
    | 'closeToTray'
    | 'minimizeToTray'
    | 'notifyOnCompletion'
    | 'hardwareAcceleration'
  >
  security: Pick<AppSettings, 'vaultMode'>
}

export interface PersistedSettingsEnvelope {
  schemaVersion: number
  updatedAt: string
  isEncrypted: boolean
  settings?: CategorizedSettings
  encryptedData?: string
}

export interface DiskSpaceInfo {
  freeBytes: number
  totalBytes: number
}

export interface CacheClearResult {
  reclaimedBytes: number
}

export interface IntegrityCheckResult {
  totalFiles: number
  healthyFiles: number
  corruptFiles: number
  summary: string
}
