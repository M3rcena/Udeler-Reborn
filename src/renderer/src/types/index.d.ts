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
  queueStatus: 'idle' | 'running' | 'paused'
  isPathAlertOpen: boolean
  setIsPathAlertOpen: React.Dispatch<React.SetStateAction<boolean>>
  startDownloadQueue: (
    curriculum: CurriculumItem[],
    course: Course,
    startChapter: string
  ) => Promise<void>
  pauseQueue: () => void
  resumeQueue: () => void
  cancelQueue: () => void
  handleDownloadSingle: (
    item: CurriculumItem,
    chapterTitle: string,
    index: number,
    course: Course
  ) => Promise<void>
  validateDownloadPath: () => Promise<boolean>
}

export interface CurriculumModalProps {
  selectedCourse: Course
  curriculum: CurriculumItem[]
  isFetchingCurriculum: boolean
  onClose: () => void
}
