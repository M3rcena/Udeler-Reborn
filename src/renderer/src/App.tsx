import { useState, useEffect, useCallback, useRef } from 'react'
import { Course, CurriculumItem } from './types'
import { useAuth } from './contexts/AuthContext'
import { LoginView } from './views/LoginView'

declare global {
  interface Window {
    api: {
      getStore: (key: string) => Promise<unknown>
      setStore: (key: string, value: unknown) => Promise<void>
      deleteStore: (key: string) => Promise<void>
      fetchCourses: () => Promise<unknown>
      fetchCurriculum: (courseId: number) => Promise<unknown>
      selectFolder: () => Promise<string | null>
      startDownload: (req: unknown) => Promise<string>
      cancelDownload: (lectureId: number) => Promise<boolean>
      checkLocalDownloads: (courseTitle: string) => Promise<Record<number, string>>
      deleteCourseFolder: (courseTitle: string) => Promise<boolean>
    }
  }
}

// TODO: WHEN YOU CHANGE THE FOLDER ON THE SETTING MOVE ALL THE DOWNLOADED THERE IF USER WANTS OTHERWISE KEEP IT THERE

function App(): React.JSX.Element {
  const { isLoggedIn, isAuthLoading, handleLogout } = useAuth()
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true)
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true)

  const [activeTab, setActiveTab] = useState<'courses' | 'downloads' | 'settings' | 'about'>(
    'courses'
  )

  // --- MY COURSES STATE ---
  const [courses, setCourses] = useState<Course[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isFetchingCourses, setIsFetchingCourses] = useState<boolean>(false)

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([])
  const [isFetchingCurriculum, setIsFetchingCurriculum] = useState<boolean>(false)

  const [downloadProgress, setDownloadProgress] = useState<Record<number, string>>({})
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [isPathAlertOpen, setIsPathAlertOpen] = useState<boolean>(false)
  const [hasLocalFiles, setHasLocalFiles] = useState<boolean>(true)

  // --- QUEUE MANAGER STATES ---
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused'>('idle')

  const downloadQueue = useRef<{ item: CurriculumItem; chapterTitle: string; index: number }[]>([])
  const activeWorkers = useRef<number>(0)
  const isQueuePaused = useRef<boolean>(false)

  // --- SETTINGS STATE ---
  const [appSettings, setAppSettings] = useState({
    downloadPath: '',
    videoQuality: 'Auto',
    skipAttachments: false,
    skipSubtitles: false,
    autoRetry: false
  })
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)

  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false)
  const qualityOptions = [
    { id: 'Auto', label: 'Auto (Best Available)' },
    { id: 'Highest', label: 'Highest Resolution' },
    { id: '1080p', label: '1080p' },
    { id: '720p', label: '720p' },
    { id: '480p', label: '480p' },
    { id: '360p', label: '360p' },
    { id: 'Lowest', label: 'Lowest (Save Space)' }
  ]

  const loadCourses = useCallback(async (): Promise<void> => {
    setIsFetchingCourses(true)
    try {
      const data = (await window.api.fetchCourses()) as Course[]
      setCourses(data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    } finally {
      setIsFetchingCourses(false)
    }
  }, [])

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleViewContent = async (course: Course): Promise<void> => {
    setSelectedCourse(course)
    setIsFetchingCurriculum(true)
    setDownloadProgress({})

    try {
      const [serverCurriculum, localDiskState, drmState] = await Promise.all([
        window.api.fetchCurriculum(course.id) as Promise<CurriculumItem[]>,
        window.api.checkLocalDownloads(course.title) as Promise<Record<number, string>>,
        window.api.getStore(`drm_${course.id}`) as Promise<Record<string, boolean> | undefined>
      ])

      const mergedState = { ...localDiskState }
      if (drmState) {
        Object.keys(drmState).forEach((lectureIdStr) => {
          mergedState[parseInt(lectureIdStr)] = 'drm'
        })
      }

      setCurriculum(serverCurriculum)
      setDownloadProgress(mergedState)
    } catch (error) {
      console.error('Failed to load curriculum or sync local state', error)
    } finally {
      setIsFetchingCurriculum(false)
    }
  }

  const handleDownloadItem = async (
    item: CurriculumItem,
    chapterTitle: string,
    lectureIndex: number
  ): Promise<void> => {
    if (!selectedCourse) return

    setDownloadProgress((prev) => ({ ...prev, [item.id]: 'downloading' }))

    let downloadType = 'Video'
    if (item._class === 'quiz') downloadType = 'Quiz'
    else if (item.asset?.asset_type === 'Article') downloadType = 'Article'
    else if (item.asset?.asset_type === 'E-Book') downloadType = 'E-Book'
    else if (item.asset?.asset_type === 'File') downloadType = 'File'

    const request = {
      courseId: selectedCourse.id,
      courseTitle: selectedCourse.title,
      chapterTitle: chapterTitle || 'Uncategorized',
      lectureId: item.id,
      lectureTitle: item.title,
      lectureIndex: lectureIndex,
      type: downloadType,
      timeEstimation: item.asset?.time_estimation
    }

    try {
      await window.api.startDownload(request)
      setDownloadProgress((prev) => ({ ...prev, [item.id]: 'success' }))
    } catch (error) {
      console.error('Download Failed:', error)

      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('DRM protected')) {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'drm' }))

        window.api.setStore(`drm_${selectedCourse.id}.${item.id}`, true)
      } else {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'error' }))
      }
    }
  }

  // The Worker Engine (Runs recursively up to 3 concurrent limits)
  const processQueue = async (): Promise<void> => {
    // Stop conditions
    if (isQueuePaused.current) return
    if (activeWorkers.current >= 3) return // MAX CONCURRENCY = 3

    // Get next item
    const nextTask = downloadQueue.current.shift()

    if (!nextTask) {
      if (activeWorkers.current === 0) setQueueStatus('idle') // Queue finished
      return
    }

    // Spin up a worker
    activeWorkers.current++

    // Immediately attempt to spin up another worker to fill the 3-slot concurrency limit
    processQueue()

    try {
      await handleDownloadItem(nextTask.item, nextTask.chapterTitle, nextTask.index)
    } catch {
      console.error('Worker failed on item', nextTask.item.id)
    } finally {
      activeWorkers.current--
      // Worker finished, grab the next item in line
      processQueue()
    }
  }

  const startDownloadQueue = async (currentChapterTitle: string): Promise<void> => {
    if (!selectedCourse || isFetchingCurriculum) return

    const isValid = await validateDownloadPath()
    if (!isValid) return

    // Populate the Queue
    let trackingTitle = currentChapterTitle
    let lectureCounter = 1
    const newQueue: typeof downloadQueue.current = []

    for (const item of curriculum) {
      if (item._class === 'chapter') {
        trackingTitle = item.title
        continue
      }

      const currentIndex = lectureCounter++
      if (item._class === 'quiz') continue

      const status = downloadProgress[item.id]
      if (status === 'downloading' || status === 'success') continue

      newQueue.push({ item, chapterTitle: trackingTitle, index: currentIndex })
    }

    downloadQueue.current = newQueue
    isQueuePaused.current = false
    setQueueStatus('running')

    // Kick off 3 workers, but stagger their start times by 500ms
    setTimeout(processQueue, 0)
    setTimeout(processQueue, 500)
    setTimeout(processQueue, 1000)
  }

  const pauseQueue = (): void => {
    isQueuePaused.current = true
    setQueueStatus('paused')
  }

  const resumeQueue = (): void => {
    isQueuePaused.current = false
    setQueueStatus('running')
    processQueue() // Kickstart idle workers
  }

  const cancelQueue = (): void => {
    isQueuePaused.current = true
    setQueueStatus('idle')
    downloadQueue.current = [] // Empty the queue

    // Abort all currently downloading items!
    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.cancelDownload(id)
        setDownloadProgress((prev) => {
          const newMap = { ...prev }
          delete newMap[id] // Reset UI status to idle
          return newMap
        })
      }
    })
    activeWorkers.current = 0
  }

  // Helper: Check if download path exists before starting any operations
  const validateDownloadPath = async (): Promise<boolean> => {
    const settings = (await window.api.getStore('app_settings')) as
      | { downloadPath?: string }
      | undefined
    if (!settings || !settings.downloadPath) {
      setIsPathAlertOpen(true)
      return false
    }
    return true
  }

  useEffect((): void => {
    const initializeApp = async (): Promise<void> => {
      // Load Settings
      const savedSettings = (await window.api.getStore('app_settings')) as
        | typeof appSettings
        | undefined
      if (savedSettings) {
        setAppSettings(savedSettings)
      }

      // Load Theme
      const savedTheme = await window.api.getStore('theme')
      if (savedTheme === 'light') {
        setIsDarkMode(false)
        document.documentElement.classList.remove('dark')
      } else {
        document.documentElement.classList.add('dark')
      }

      setIsAppLoading(false)
    }

    initializeApp()
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      setTimeout(() => {
        loadCourses()
      }, 0)
    }
  }, [isLoggedIn, loadCourses])

  const toggleTheme = async (): Promise<void> => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    if (newTheme) {
      document.documentElement.classList.add('dark')
      await window.api.setStore('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      await window.api.setStore('theme', 'light')
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    const path = await window.api.selectFolder()
    if (path) {
      setAppSettings((prev) => ({ ...prev, downloadPath: path }))
    }
  }

  const handleSaveSettings = async (): Promise<void> => {
    setIsSavingSettings(true)
    try {
      await window.api.setStore('app_settings', appSettings)
      setTimeout(() => setIsSavingSettings(false), 1000)
    } catch (error) {
      console.error('Failed to save settings', error)
      setIsSavingSettings(false)
    }
  }

  if (isAuthLoading || isAppLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">
        Loading...
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginView toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
  }

  return (
    <div className="relative flex h-screen w-full bg-slate-50 dark:bg-[#09090e] transition-colors duration-500 overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

      {/* --- SIDEBAR --- */}
      <aside className="relative w-64 flex flex-col bg-white/40 dark:bg-white/5 backdrop-blur-xl border-r border-gray-200 dark:border-white/10 z-10 transition-all duration-300">
        {/* Logo Area */}
        <div className="h-24 flex items-center justify-center border-b border-gray-200/50 dark:border-white/5">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Udeler{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
              Pro
            </span>
          </h1>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Courses Tab */}
          <button
            onClick={() => setActiveTab('courses')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
              activeTab === 'courses'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              ></path>
            </svg>
            My Courses
          </button>

          {/* Downloads Tab */}
          <button
            onClick={() => setActiveTab('downloads')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
              activeTab === 'downloads'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
            Downloads
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              ></path>
            </svg>
            Settings
          </button>

          {/* About Tab */}
          <button
            onClick={() => setActiveTab('about')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
              activeTab === 'about'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            About
          </button>
        </nav>

        {/* Sidebar Footer (Theme & Logout) */}
        <div className="p-4 border-t border-gray-200/50 dark:border-white/5 flex flex-col gap-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-200 dark:bg-white/5 text-gray-800 dark:text-white transition-all hover:bg-gray-300 dark:hover:bg-white/10 cursor-pointer font-medium"
          >
            {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 transition-all hover:bg-red-500 hover:text-white cursor-pointer font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              ></path>
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 relative z-10 overflow-y-auto p-8">
        {/* Courses View */}
        {activeTab === 'courses' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col">
            {/* Header Toolbar (Search & Refresh) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                My Courses{' '}
                <span className="text-lg text-gray-400 font-medium ml-2">
                  ({filteredCourses.length})
                </span>
              </h2>

              <div className="flex w-full sm:w-auto gap-3">
                {/* Glassy Search Bar */}
                <div className="relative flex-1 sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search courses..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm cursor-pointer"
                  />
                </div>

                {/* Refresh Button */}
                <button
                  onClick={loadCourses}
                  disabled={isFetchingCourses}
                  className="p-2.5 bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-700 dark:text-white hover:bg-white dark:hover:bg-white/10 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                  title="Refresh Courses"
                >
                  <svg
                    className={`w-5 h-5 ${isFetchingCourses ? 'animate-spin text-blue-500' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Course Grid Area */}
            <div className="flex-1 overflow-y-auto pb-8 pr-2 custom-scrollbar">
              {isFetchingCourses && courses.length === 0 ? (
                // Loading Skeleton Grid
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <div
                      key={n}
                      className="bg-white/40 dark:bg-white/5 border border-gray-200/50 dark:border-white/5 rounded-2xl h-64 animate-pulse"
                    ></div>
                  ))}
                </div>
              ) : filteredCourses.length > 0 ? (
                // Actual Course Grid
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredCourses.map((course: Course) => (
                    <div
                      key={course.id}
                      className="group flex flex-col bg-white/70 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500/30 cursor-pointer"
                    >
                      {/* Course Image */}
                      <div className="relative aspect-video overflow-hidden bg-gray-200 dark:bg-gray-800">
                        <img
                          src={course.image_480x270}
                          alt={course.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>

                      {/* Course Info */}
                      <div className="p-5 flex flex-col flex-1">
                        <h3 className="text-gray-900 dark:text-white font-bold text-sm line-clamp-2 mb-4 leading-snug group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                          {course.title}
                        </h3>
                        <div className="mt-auto">
                          <button
                            onClick={() => handleViewContent(course)}
                            className="w-full py-2.5 bg-gray-100 dark:bg-black/30 hover:bg-blue-600 hover:text-white text-gray-800 dark:text-gray-300 font-semibold rounded-xl transition-all duration-300 shadow-inner group-hover:shadow-[0_0_15px_rgba(37,99,235,0.4)] cursor-pointer text-sm"
                          >
                            View Content
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // Empty State
                <div className="h-full flex flex-col items-center justify-center p-8 bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl text-center">
                  <div className="w-20 h-20 mb-4 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <svg
                      className="w-10 h-10"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    No courses found
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Try adjusting your search query.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Downloads View */}
        {activeTab === 'downloads' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Downloads</h2>
            <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Download stats and list will go here...
              </p>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeTab === 'settings' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-10">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
              Application Settings
            </h2>

            <div className="flex flex-col gap-6">
              {/* Download Location Card */}
              <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      ></path>
                    </svg>
                  </div>
                  Download Location
                </h3>

                <div className="flex gap-4">
                  <input
                    type="text"
                    readOnly
                    value={appSettings.downloadPath}
                    placeholder="Select a folder to save your courses..."
                    className="flex-1 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none transition-all cursor-not-allowed"
                  />
                  <button
                    onClick={handleSelectFolder}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer whitespace-nowrap"
                  >
                    Browse...
                  </button>
                </div>
              </div>

              {/* Download Preferences Card */}
              <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl relative z-20">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      ></path>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      ></path>
                    </svg>
                  </div>
                  Download Preferences
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex flex-col gap-2 relative">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Video Quality
                    </label>

                    {/* Custom Select Button */}
                    <button
                      onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) setIsQualityMenuOpen(false)
                      }}
                      className="w-full flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner cursor-pointer"
                    >
                      <span className="font-medium">
                        {qualityOptions.find((opt) => opt.id === appSettings.videoQuality)?.label ||
                          'Auto (Best Available)'}
                      </span>
                      <svg
                        className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isQualityMenuOpen ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M19 9l-7 7-7-7"
                        ></path>
                      </svg>

                      {/* The Popup Menu */}
                      {isQualityMenuOpen && (
                        <div className="absolute top-[105%] left-0 w-full mt-2 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-2 flex flex-col gap-1">
                            {qualityOptions.map((option) => (
                              <div
                                key={option.id}
                                onClick={(e) => {
                                  e.stopPropagation() // Prevents the parent button from immediately re-toggling
                                  setAppSettings((prev) => ({ ...prev, videoQuality: option.id }))
                                  setIsQualityMenuOpen(false)
                                }}
                                className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group
                                    ${
                                      appSettings.videoQuality === option.id
                                        ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                    }`}
                              >
                                {option.label}
                                {/* Checkmark for the active item */}
                                {appSettings.videoQuality === option.id && (
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="3"
                                      d="M5 13l4 4L19 7"
                                    ></path>
                                  </svg>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </button>
                  </div>

                  <div className="flex flex-col gap-5 pt-2">
                    {[
                      { id: 'skipAttachments', label: 'Skip Course Attachments' },
                      { id: 'skipSubtitles', label: 'Skip Subtitles / Closed Captions' },
                      { id: 'autoRetry', label: 'Auto-Retry on Network Error' }
                    ].map((setting) => (
                      <label
                        key={setting.id}
                        className="flex items-center justify-between cursor-pointer group"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          {setting.label}
                        </span>
                        <div className="relative">
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={appSettings[setting.id as keyof typeof appSettings] as boolean}
                            onChange={(e) =>
                              setAppSettings((prev) => ({
                                ...prev,
                                [setting.id]: e.target.checked
                              }))
                            }
                          />
                          {/* The track */}
                          <div
                            className={`block w-12 h-7 rounded-full transition-all duration-300 ${appSettings[setting.id as keyof typeof appSettings] ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                          ></div>
                          {/* The dot */}
                          <div
                            className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${appSettings[setting.id as keyof typeof appSettings] ? 'translate-x-5' : ''}`}
                          ></div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-lg transform cursor-pointer
                    ${
                      isSavingSettings
                        ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-[0.99]'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                    }
                  `}
              >
                {isSavingSettings ? 'Settings Saved Successfully!' : 'Save All Settings'}
              </button>
            </div>
          </div>
        )}

        {/* About View */}
        {activeTab === 'about' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">About</h2>
            <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl text-center">
              <p className="text-gray-500 dark:text-gray-400">
                App info and your &apos;Remade By&apos; links will go here...
              </p>
            </div>
          </div>
        )}

        {/* --- CURRICULUM MODAL --- */}
        {selectedCourse && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-opacity">
            <div className="relative flex flex-col bg-white dark:bg-[#0b0b14] border border-gray-200 dark:border-white/10 rounded-[2rem] w-full max-w-5xl h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 backdrop-blur-xl z-10">
                <div className="flex items-center gap-4">
                  <img
                    src={selectedCourse.image_480x270}
                    alt="Thumbnail"
                    className="w-16 h-12 object-cover rounded-lg shadow-sm"
                  />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1">
                      {selectedCourse.title}
                    </h2>
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                      Course Curriculum
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Queue Controls */}
                  {queueStatus === 'idle' && (
                    <button
                      onClick={() => startDownloadQueue('Uncategorized')}
                      className="group flex items-center h-11 max-w-[44px] hover:max-w-[200px] bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg hover:shadow-blue-500/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                    >
                      <svg
                        className="w-5 h-5 min-w-[20px]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        ></path>
                      </svg>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                        Download All
                      </span>
                    </button>
                  )}

                  {queueStatus === 'running' && (
                    <button
                      onClick={pauseQueue}
                      className="group flex items-center h-11 max-w-[44px] hover:max-w-[200px] bg-yellow-500 hover:bg-yellow-400 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-yellow-500/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                    >
                      <svg
                        className="w-5 h-5 min-w-[20px]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                        Pause Downloads
                      </span>
                    </button>
                  )}

                  {queueStatus === 'paused' && (
                    <button
                      onClick={resumeQueue}
                      className="group flex items-center h-11 max-w-[44px] hover:max-w-[200px] bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-green-500/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                    >
                      <svg
                        className="w-5 h-5 min-w-[20px]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        ></path>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                        Resume Downloads
                      </span>
                    </button>
                  )}

                  {/* The Cancel Button (Only shows if queue is actively running or paused) */}
                  {queueStatus !== 'idle' && (
                    <button
                      onClick={cancelQueue}
                      className="group flex items-center h-11 max-w-[44px] hover:max-w-[200px] bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-red-600/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                    >
                      <svg
                        className="w-5 h-5 min-w-[20px]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M9 10l6 6m0-6l-6 6"
                        ></path>
                      </svg>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                        Stop Queue
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      const filesExist = Object.values(downloadProgress).some(
                        (status) => status === 'success' || status === 'drm'
                      )
                      setHasLocalFiles(filesExist)
                      setIsDeleteModalOpen(true)
                    }}
                    className="group flex items-center h-11 max-w-[44px] hover:max-w-[200px] bg-red-500/10 hover:bg-red-600 text-red-600 dark:text-red-400 hover:text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-md overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                  >
                    <svg
                      className="w-5 h-5 min-w-[20px]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      ></path>
                    </svg>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-75">
                      Remove Files
                    </span>
                  </button>

                  {/* Separator Line */}
                  <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

                  <button
                    onClick={() => setSelectedCourse(null)}
                    className="p-3 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-all cursor-pointer flex items-center justify-center"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Content / List */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-gray-50/30 dark:bg-transparent">
                {isFetchingCurriculum ? (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-500">
                    <svg
                      className="w-10 h-10 animate-spin text-blue-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    <p className="font-medium animate-pulse">Decrypting Course Curriculum...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {(() => {
                      let activeChapterName = 'Uncategorized'
                      let lectureCounter = 1

                      return curriculum.map((item) => {
                        if (item._class === 'chapter') {
                          activeChapterName = item.title
                          return (
                            <h3
                              key={item.id}
                              className="text-lg font-bold text-gray-900 dark:text-white mt-6 mb-2 flex items-center gap-2"
                            >
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              {item.title}
                            </h3>
                          )
                        }

                        const currentLectureIndex = lectureCounter++
                        const status = downloadProgress[item.id]
                        const chapterForThisItem = activeChapterName

                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 ml-4 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-xl hover:border-blue-500/30 transition-all group"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {item._class === 'quiz' ? (
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    ></path>
                                  </svg>
                                ) : item.asset?.asset_type === 'Video' ? (
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                    ></path>
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    ></path>
                                  </svg>
                                ) : (
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    ></path>
                                  </svg>
                                )}
                              </div>
                              <div>
                                <p className="text-gray-800 dark:text-gray-200 font-medium">
                                  {item.title}
                                </p>
                                {item.asset?.time_estimation && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {Math.ceil(item.asset.time_estimation / 60)} mins
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              {item._class === 'quiz' ? (
                                <button
                                  onClick={() =>
                                    window.open(
                                      `https://www.udemy.com/course/${selectedCourse.id}/learn/quiz/${item.id}`,
                                      '_blank'
                                    )
                                  }
                                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg text-sm transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth="2"
                                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                    ></path>
                                  </svg>
                                  Quiz
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const isValid = await validateDownloadPath()
                                    if (isValid) {
                                      handleDownloadItem(
                                        item,
                                        chapterForThisItem,
                                        currentLectureIndex
                                      )
                                    }
                                  }}
                                  disabled={
                                    status === 'downloading' ||
                                    status === 'success' ||
                                    status === 'drm'
                                  }
                                  className={`px-4 py-2 font-semibold rounded-lg text-sm transition-all shadow-sm flex items-center gap-2
                                      ${
                                        status === 'downloading'
                                          ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 cursor-wait opacity-100'
                                          : status === 'success'
                                            ? 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400 cursor-default opacity-100'
                                            : status === 'drm'
                                              ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-100'
                                              : status === 'error'
                                                ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 cursor-pointer opacity-100'
                                                : 'bg-gray-100 dark:bg-white/10 hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer'
                                      }
                                    `}
                                >
                                  {status === 'downloading' && (
                                    <>
                                      <svg
                                        className="w-4 h-4 animate-spin"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                        ></path>
                                      </svg>{' '}
                                      Fetching...
                                    </>
                                  )}
                                  {status === 'success' && '✓ Saved'}

                                  {/* DRM Locked State */}
                                  {status === 'drm' && (
                                    <>
                                      <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth="2"
                                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                        ></path>
                                      </svg>{' '}
                                      DRM Protected
                                    </>
                                  )}

                                  {status === 'error' && 'Retry'}
                                  {!status &&
                                    (item.asset?.asset_type === 'Video' ? 'Download' : 'Save')}
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    })()}
                  </div>
                )}
              </div>

              {isDeleteModalOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                  <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                    {hasLocalFiles ? (
                      <>
                        <div className="p-4 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl mb-5 shadow-inner">
                          <svg
                            className="w-10 h-10"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                          Delete Course Content?
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                          You are about to permanently erase all downloaded files for{' '}
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            &quot;{selectedCourse.title}&quot;
                          </span>{' '}
                          from your computer disk. This operation is irreversible.
                        </p>
                        <div className="grid grid-cols-2 gap-3 w-full">
                          <button
                            onClick={() => setIsDeleteModalOpen(false)}
                            className="py-3 px-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async () => {
                              setIsDeleteModalOpen(false)
                              await window.api.deleteCourseFolder(selectedCourse.title)
                              await window.api.deleteStore(`drm_${selectedCourse.id}`)
                              setDownloadProgress({})
                            }}
                            className="py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer"
                          >
                            Yes, Delete All
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-4 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl mb-5 shadow-inner">
                          <svg
                            className="w-10 h-10"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            ></path>
                          </svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                          No Downloads Found
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                          There are currently no downloaded local files detected on disk for{' '}
                          <span className="font-semibold text-gray-800 dark:text-gray-200">
                            &quot;{selectedCourse.title}&quot;
                          </span>{' '}
                          inside your designated workspace directory.
                        </p>
                        <button
                          onClick={() => setIsDeleteModalOpen(false)}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer"
                        >
                          Understood
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ---MISSING PATH ALERT MODAL --- */}
      {isPathAlertOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            {/* Warning Icon */}
            <div className="p-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-2xl mb-5 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Setup Required
            </h3>

            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
              You need to select a{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                Download Folder
              </span>{' '}
              in the Settings menu before you can save course content to your computer.
            </p>

            {/* Action Button */}
            <button
              onClick={() => setIsPathAlertOpen(false)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
