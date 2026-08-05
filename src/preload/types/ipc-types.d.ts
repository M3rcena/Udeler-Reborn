import type { DownloadRequest } from '../../main/download'

// ---- Courses / Downloads Types

export interface Course {
  id: number
  title: string
  url: string
  image_480x270: string
}

export interface CurriculumItem {
  _class: 'chapter' | 'lecture' | 'quiz' | 'practice'
  id: number
  title: string
  asset?: {
    asset_type: string
    time_estimation?: number
  }
}

export interface DownloadedFile {
  course: string
  chapter: string
  file: string
  path: string
  type: 'Video' | 'Article' | 'File'
  size: number
  subtitles?: SubtitleTrack[]
}

export interface DownloadContextType {
  downloadProgress: Record<number, string>
  setDownloadProgress: React.Dispatch<React.SetStateAction<Record<number, string>>>
  downloadPercentages?: Record<number, number>
  downloadSpeeds?: Record<number, number>
  activeDownloads: Record<number, { title: string; courseTitle: string }>
  queueStatus: 'idle' | 'running' | 'paused'
  queueCount: number
  isPathAlertOpen: boolean
  setIsPathAlertOpen: React.Dispatch<React.SetStateAction<boolean>>
  validateDownloadPath: () => Promise<boolean>
  handleDownloadItem: (
    course: Course,
    item: CurriculumItem,
    chapterTitle: string,
    lectureIndex: number
  ) => Promise<void>
  startDownloadQueue: (
    course: Course,
    curriculum: CurriculumItem[],
    currentChapterTitle: string
  ) => Promise<number>
  pauseQueue: () => void
  resumeQueue: () => void
  cancelQueue: () => void
}

export interface DownloadedFile {
  course: string
  chapter: string
  file: string
  path: string
  type: 'Video' | 'Article' | 'File'
  size: number
  subtitles?: SubtitleTrack[]
  volumeId?: string
  volumeName?: string
  isOffline?: boolean
}

export interface DownloadRequest {
  token: string
  downloadPath: string
  videoQuality: string
  skipAttachments: boolean
  skipSubtitles: boolean
  autoRetry: boolean
  courseId: number
  courseTitle: string
  chapterTitle: string
  lectureId: number
  lectureTitle: string
  lectureIndex: number
  type: 'Video' | 'Article' | 'Quiz' | 'File' | 'E-Book'
  timeEstimation?: number
  maxKbps?: number
}

export interface SubtitleTrack {
  label: string
  srcLang: string
  path: string
}

export interface CurriculumModalProps {
  selectedCourse: Course
  curriculum: CurriculumItem[]
  isFetchingCurriculum: boolean
  onClose: () => void
}

// ---- Settings Types
export interface SafeStore {
  get: (key: string) => unknown
  set: (key: string, value: unknown) => void
  delete: (key: string) => void
}

export interface AppSettings {
  downloadPath: string
  videoQuality: string
  skipAttachments: boolean
  skipSubtitles: boolean
  autoRetry: boolean
  scheduleEnabled: boolean
  scheduleStart: string
  scheduleEnd: string
  maxKbps: number
  closeToTray?: boolean
  vaultMode?: boolean
}

// ---- Sidebar Types
interface SidebarProps {
  activeTab: 'courses' | 'downloads' | 'settings' | 'about'
  setActiveTab: React.Dispatch<React.SetStateAction<'courses' | 'downloads' | 'settings' | 'about'>>
  isDarkMode: boolean
  toggleTheme: () => Promise<void>
  handleLogout: () => Promise<void>
}

// ---- Path Alert Modal
export interface PathAlertModalProps {
  isOpen: boolean
  onClose: () => void
}

// ---- Auth Types
export interface AuthContextType {
  token: string
  setToken: React.Dispatch<React.SetStateAction<string>>
  authStatus: 'idle' | 'validating' | 'success' | 'error'
  authErrorMsg: string
  isLoggedIn: boolean
  isAuthLoading: boolean
  handleLogin: (tokenInput: string) => Promise<void>
  handleLogout: () => Promise<void>
}

export interface HelpModalProps {
  onClose: () => void
}

export interface LoginViewProps {
  toggleTheme: () => void
  isDarkMode: boolean
}

// ---- Media Player
export interface WatchProgress {
  currentTime: number
  duration: number
  isCompleted: boolean
}

interface WatchProgressControls {
  handleTimeUpdate: () => Promise<void>
  forceSave: () => Promise<void>
}

// ---- Search Types
export interface SearchResult {
  id: string
  courseTitle: string
  chapterTitle: string
  lectureTitle: string
  lectureId: number
  textSnippet: string
  score: number
  filePath: string
  matchType: 'title' | 'transcript'
}

export interface SearchDocument {
  id: string
  courseTitle: string
  chapterTitle: string
  lectureTitle: string
  lectureId: number
  text: string
  filePath: string
}

// ---- Integrity Scans Types
export type IntegrityStatus = 'size_mismatch' | 'hash_mismatch' | 'archived_corrupted'

export interface IntegrityIssue {
  lectureId: number
  courseTitle: string
  chapterTitle: string
  fileName: string
  filePath: string
  status: IntegrityStatus
  expectedHash?: string
}

export interface IntegrityProgress {
  scanned: number
  total: number
  currentFile: string
  issuesFound: number
}

// ---- Volume Types
export interface CourseVolumeMapping {
  volumeId: string
  name: string
  isAvailable: boolean
  rootPath: string
}

export interface VolumeRow {
  id: string
  name: string
  root_path: string
  is_available: number
}

export interface CourseVolumeRow {
  course_id: number
  volumeId: string
  name: string
  is_available: number
  root_path: string
}

export interface RawVolume {
  id: string
  name: string
  isOffline: boolean
  course?: string
}

export interface GroupedVolume {
  id: string
  name: string
  isOffline: boolean
  courses: Set<string>
  isPinned: boolean
}

// ---- Audit Types
export type RiskTier = 'read-only-metadata' | 'filesystem-write' | 'network' | 'credential-access'

export interface IpcManifestEntry {
  tier: RiskTier
  maxCallsPerSecond: number
}

// ---- Ipc Types

export interface IpcChannels {
  'export-debug-logs': { args: []; returns: boolean }
  'store-get': { args: [key: string]; returns: unknown }
  'store-set': { args: [key: string, value: unknown]; returns: void }
  'store-delete': { args: [key: string]; returns: void }
  'get-storage-stats': { args: []; returns: number }
  'run-garbage-collector': {
    args: []
    returns: { purgedCount: number; freedBytes: number; newTotalReclaimed: number }
  }
  'fetch-courses': { args: []; returns: Course[] }
  'fetch-curriculum': { args: [courseId: number]; returns: CurriculumItem[] }
  'select-folder': { args: []; returns: string | null }
  'start-download': {
    args: [
      req: Omit<
        DownloadRequest,
        | 'token'
        | 'downloadPath'
        | 'videoQuality'
        | 'skipAttachments'
        | 'skipSubtitles'
        | 'autoRetry'
      >
    ]
    returns: string
  }
  'get-all-downloads': { args: []; returns: DownloadedFile[] }
  'check-local-downloads': { args: [courseTitle: string]; returns: Record<number, string> }
  'delete-course-folder': { args: [courseTitle: string]; returns: boolean }
  'cancel-download': { args: [lectureId: number]; returns: boolean }
  'pause-download': { args: [lectureId: number]; returns: boolean }
  moveDownloadsFolder: { args: [oldPath: string, newPath: string]; returns: boolean }
  'delete-lecture': { args: [courseTitle: string, lectureId: number]; returns: boolean }
  'delete-file-by-path': { args: [filePath: string]; returns: boolean }
  'login-udemy': { args: [subdomain?: string]; returns: string | null }
  'os-set-progress': { args: [progress: number]; returns: boolean }
  'os-set-tray-tooltip': { args: [text: string]; returns: boolean }
  'os-set-recent-course': {
    args: [payload: { title: string; id: number; file?: DownloadedFile }]
    returns: boolean
  }
  'os-hide-to-tray': { args: []; returns: boolean }
  'os-update-queue-menu': { args: [status: 'idle' | 'running' | 'paused']; returns: boolean }
  'os-show-item-in-folder': { args: [filePath: string]; returns: void }
  'search-index': { args: [query: string]; returns: SearchResult[] }
  'rebuild-search-index': { args: []; returns: boolean }
  'start-integrity-scan': { args: []; returns: IntegrityIssue[] }
  'get-volume-mappings': { args: []; returns: Record<number, CourseVolumeMapping> }
  'register-volume': { args: []; returns: string | null }
  'pin-course': {
    args: [courseId: number, courseTitle: string, volumeId: string, shouldMove: boolean]
    returns: boolean
  }
  'get-all-volumes': { args: []; returns: VolumeRow[] }
  'unpin-course': {
    args: [courseId: number, courseTitle: string, shouldMove: boolean]
    returns: boolean
  }
  'get-security-audit-stats': {
    args: []
    returns: { passedChecks: number; anomalies: number }
  }
}
