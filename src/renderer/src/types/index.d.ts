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

export interface DownloadContextType {
  downloadProgress: Record<number, string>
  setDownloadProgress: React.Dispatch<React.SetStateAction<Record<number, string>>>
  downloadPercentages?: Record<number, number>
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

interface SubtitleTrack {
  label: string
  srcLang: string
  path: string
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

export interface CurriculumModalProps {
  selectedCourse: Course
  curriculum: CurriculumItem[]
  isFetchingCurriculum: boolean
  onClose: () => void
}
