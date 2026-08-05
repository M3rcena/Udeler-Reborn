import { useDownload } from '@renderer/contexts/DownloadContext'
import { useCallback, useEffect, useState } from 'react'
import {
  Course,
  CourseVolumeMapping,
  CurriculumItem,
  VolumeRow,
  WatchProgress
} from 'src/preload/types/ipc-types'

interface MyCoursesTabProps {
  navCourseId?: number | null
  onNavHandled?: () => void
}

export const MyCoursesTab: React.FC<MyCoursesTabProps> = ({ navCourseId, onNavHandled }) => {
  // --- GRAB THE BACKGROUND QUEUE ENGINE ---
  const {
    downloadProgress,
    setDownloadProgress,
    downloadPercentages = {},
    queueStatus,
    validateDownloadPath,
    handleDownloadItem,
    startDownloadQueue,
    pauseQueue,
    resumeQueue,
    cancelQueue
  } = useDownload()

  // --- LOCAL STATES ---
  const [courses, setCourses] = useState<Course[]>([])
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [isFetchingCourses, setIsFetchingCourses] = useState<boolean>(false)

  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [curriculum, setCurriculum] = useState<CurriculumItem[]>([])
  const [isFetchingCurriculum, setIsFetchingCurriculum] = useState<boolean>(false)
  const [newLectures, setNewLectures] = useState<Set<number>>(new Set())

  const [watchProgressMap, setWatchProgressMap] = useState<Record<number, WatchProgress>>({})

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [hasLocalFiles, setHasLocalFiles] = useState<boolean>(true)

  const [queuedCount, setQueuedCount] = useState<number | null>(null)

  const [volumeMappings, setVolumeMappings] = useState<Record<number, CourseVolumeMapping>>({})
  const [unpinModalConfig, setUnpinModalConfig] = useState<{
    isOpen: boolean
    type: 'online' | 'offline' | null
  }>({ isOpen: false, type: null })
  const [isUnpinning, setIsUnpinning] = useState<boolean>(false)
  const [pinModalConfig, setPinModalConfig] = useState<{
    isOpen: boolean
    volumeId: string
    volumeName: string
  } | null>(null)

  // --- DATA FETCHING ---
  const loadCourses = useCallback(async (): Promise<void> => {
    setIsFetchingCourses(true)
    try {
      const data = await window.api.invoke('fetch-courses')
      setCourses(data)

      window.api.invoke('store-set', 'cached_courses', data)
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    } finally {
      setIsFetchingCourses(false)
    }
  }, [])

  // Auto-load courses when this tab is opened
  useEffect(() => {
    setTimeout(() => {
      loadCourses()
    }, 0)
  }, [loadCourses])

  useEffect((): (() => void) => {
    window.api.invoke('get-volume-mappings').then(setVolumeMappings)
    const unsub = window.api.onVolumeMappingsUpdated(
      (newMappings: Record<number, CourseVolumeMapping>): void => {
        setVolumeMappings(newMappings)
      }
    )
    return (): void => unsub()
  }, [])

  const filteredCourses = courses.filter((course) =>
    course.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleViewContent = useCallback(async (course: Course): Promise<void> => {
    setSelectedCourse(course)
    setIsFetchingCurriculum(true)
    setNewLectures(new Set())

    try {
      const [serverCurriculum, localDiskState, drmState, knownLectures, progressData] =
        await Promise.all([
          window.api.invoke('fetch-curriculum', course.id),
          window.api.invoke('check-local-downloads', course.title),
          window.api.invoke('store-get', `drm_${course.id}`) as Promise<
            Record<string, boolean> | undefined
          >,
          window.api.invoke('store-get', `known_lectures_${course.id}`) as Promise<
            number[] | undefined
          >,
          window.api.invoke('store-get', 'watch_progress') as Promise<
            Record<number, WatchProgress> | undefined
          >
        ])

      const currentIds = serverCurriculum.map((item) => item.id)
      const detectedNew = new Set<number>()

      if (knownLectures && knownLectures.length > 0) {
        const knownSet = new Set(knownLectures)
        currentIds.forEach((id) => {
          if (!knownSet.has(id)) {
            detectedNew.add(id)
          }
        })
      }

      if (!knownLectures || detectedNew.size > 0) {
        await window.api.invoke('store-set', `known_lectures_${course.id}`, currentIds)
      }

      setNewLectures(detectedNew)

      const serverIds = new Set(currentIds)
      const orphanedLectures: CurriculumItem[] = []

      Object.keys(localDiskState).forEach((idStr) => {
        const id = parseInt(idStr)
        if (!serverIds.has(id) && localDiskState[id] === 'success') {
          orphanedLectures.push({
            _class: 'lecture',
            id: id,
            title: `Archived Video [ID: ${id}]`,
            asset: { asset_type: 'Video' }
          })
        }
      })

      if (orphanedLectures.length > 0) {
        serverCurriculum.push({
          _class: 'chapter',
          id: -999,
          title: '📦 Archived (Removed by Instructor)'
        })
        serverCurriculum.push(...orphanedLectures)
      }

      const mergedState = { ...localDiskState }
      if (drmState) {
        Object.keys(drmState).forEach((lectureIdStr) => {
          mergedState[parseInt(lectureIdStr)] = 'drm'
        })
      }

      setWatchProgressMap(progressData || {})
      setCurriculum(serverCurriculum)
      setDownloadProgress((prev) => {
        const newState = { ...prev }
        Object.keys(mergedState).forEach((idStr) => {
          const id = parseInt(idStr)
          if (newState[id] !== 'downloading') {
            newState[id] = mergedState[id]
          }
        })
        return newState
      })
    } catch (error) {
      console.error('Failed to load curriculum or sync local state', error)
    } finally {
      setIsFetchingCurriculum(false)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (navCourseId && courses.length > 0) {
      const course = courses.find((c) => c.id === navCourseId)
      if (course) {
        setTimeout(() => {
          handleViewContent(course)
        })
      }
      if (onNavHandled) onNavHandled()
    }
  }, [navCourseId, courses, onNavHandled, handleViewContent])

  const currentMapping = selectedCourse ? volumeMappings[selectedCourse.id] : undefined
  const isModalOffline = currentMapping ? !currentMapping.isAvailable : false

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col relative z-10">
      {/* Header Toolbar (Search & Refresh) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
          My Courses{' '}
          <span className="text-lg text-gray-400 font-medium ml-2">({filteredCourses.length})</span>
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
              className="w-full pl-10 pr-4 py-2.5 bg-white/60 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-sm cursor-pointer"
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
            {filteredCourses.map((course: Course) => {
              const mapping = volumeMappings[course.id]
              const isOffline = mapping && !mapping.isAvailable

              return (
                <div
                  key={course.id}
                  className="group relative flex flex-col bg-white/70 dark:bg-white/5 backdrop-blur-md border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:border-blue-500/30 cursor-pointer"
                >
                  {/* --- OFFLINE STATE OVERLAY --- */}
                  {isOffline && (
                    <div className="absolute top-3 right-3 z-20 pointer-events-none">
                      <span className="px-2.5 py-1.5 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg border border-red-400/50 flex items-center gap-1.5">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243-4.242a5 5 0 00-1.415 7.072m0 0L3 21m2.828-9.9a9 9 0 01-1.414-7.071"
                          />
                        </svg>
                        Drive Offline
                      </span>
                    </div>
                  )}

                  {/* Course Image */}
                  <div
                    className={`relative aspect-video overflow-hidden bg-gray-200 dark:bg-gray-800 ${isOffline ? 'grayscale opacity-75' : ''}`}
                  >
                    <img
                      src={course.image_480x270}
                      alt={course.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  </div>

                  {/* Course Info */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3
                      className={`font-bold text-sm line-clamp-2 leading-snug transition-colors ${isOffline ? 'text-gray-500 mb-1' : 'text-gray-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-400 mb-4'}`}
                    >
                      {course.title}
                    </h3>

                    {isOffline && (
                      <p className="text-xs text-red-500/80 font-bold line-clamp-1 mb-3">
                        Archived on: {mapping.name}
                      </p>
                    )}

                    <div className="mt-auto z-30">
                      <button
                        onClick={(): void => {
                          handleViewContent(course)
                        }}
                        className={`w-full py-2.5 font-semibold rounded-xl transition-all duration-300 shadow-inner cursor-pointer text-sm ${isOffline ? 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-600 hover:bg-gray-300 dark:hover:bg-white/10' : 'bg-gray-100 dark:bg-black/30 hover:bg-blue-600 hover:text-white text-gray-800 dark:text-gray-300 group-hover:shadow-[0_0_15px_rgba(37,99,235,0.4)]'}`}
                      >
                        {isOffline ? 'View (Offline)' : 'View Content'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Empty State
          <div className="h-full flex flex-col items-center justify-center p-8 bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl text-center">
            <div className="w-20 h-20 mb-4 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search query.</p>
          </div>
        )}
      </div>

      {/* --- CURRICULUM MODAL --- */}
      {selectedCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/50 dark:bg-black/80 backdrop-blur-md transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedCourse(null)
          }}
        >
          <div className="relative flex flex-col bg-white dark:bg-[#0b0b14] border border-gray-200 dark:border-white/10 rounded-4xl w-full max-w-5xl h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 backdrop-blur-xl z-10">
              <div className="flex items-center gap-4">
                <img
                  src={selectedCourse.image_480x270}
                  alt="Thumbnail"
                  className={`w-16 h-12 object-cover rounded-lg shadow-sm ${isModalOffline ? 'grayscale opacity-50' : ''}`}
                />
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1 flex items-center gap-2">
                    {selectedCourse.title}
                  </h2>
                  <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    Course Curriculum {currentMapping && `- Saved to ${currentMapping.name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Queue Controls */}
                <button
                  onClick={async () => {
                    if (isModalOffline) return
                    const addedCount = await startDownloadQueue(
                      selectedCourse,
                      curriculum,
                      'Uncategorized'
                    )
                    if (addedCount > 0) {
                      setQueuedCount(addedCount)
                      setTimeout(() => setQueuedCount(null), 3000)
                    }
                  }}
                  disabled={isModalOffline}
                  className={`group flex items-center h-11 max-w-11 hover:max-w-50 ${isModalOffline ? 'bg-gray-400 dark:bg-gray-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 cursor-pointer'} text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg overflow-hidden px-3 whitespace-nowrap gap-2`}
                >
                  <svg
                    className="w-5 h-5 min-w-5"
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
                    {queueStatus === 'idle' ? 'Download All' : 'Add to Queue'}
                  </span>
                </button>

                {queueStatus === 'running' && (
                  <button
                    onClick={pauseQueue}
                    className="group flex items-center h-11 max-w-11 hover:max-w-50 bg-yellow-500 hover:bg-yellow-400 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-yellow-500/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                  >
                    <svg
                      className="w-5 h-5 min-w-5"
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
                    className="group flex items-center h-11 max-w-11 hover:max-w-50 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-green-500/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                  >
                    <svg
                      className="w-5 h-5 min-w-5"
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

                {queueStatus !== 'idle' && (
                  <button
                    onClick={cancelQueue}
                    className="group flex items-center h-11 max-w-11 hover:max-w-50 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg shadow-red-600/30 overflow-hidden cursor-pointer px-3 whitespace-nowrap gap-2"
                  >
                    <svg
                      className="w-5 h-5 min-w-5"
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
                    if (isModalOffline) return

                    const filesExist = Object.values(downloadProgress).some(
                      (status) => status === 'success' || status === 'drm'
                    )
                    setHasLocalFiles(filesExist)
                    setIsDeleteModalOpen(true)
                  }}
                  className={`group flex items-center h-11 max-w-11 hover:max-w-50 ${isModalOffline ? 'bg-gray-400 dark:bg-gray-800 cursor-not-allowed' : 'bg-red-500/10 hover:bg-red-600 cursor-pointer'} text-red-600 dark:text-red-400 hover:text-white font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-md overflow-hidden px-3 whitespace-nowrap gap-2`}
                >
                  <svg
                    className="w-5 h-5 min-w-5"
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

                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-1"></div>

                <button
                  onClick={async (): Promise<void> => {
                    if (currentMapping) {
                      setUnpinModalConfig({
                        isOpen: true,
                        type: isModalOffline ? 'offline' : 'online'
                      })
                    } else {
                      const volId = await window.api.invoke('register-volume')
                      if (volId && selectedCourse) {
                        const allVols = (await window.api.invoke('get-all-volumes')) as VolumeRow[]
                        const vol = allVols.find((v) => v.id === volId)
                        setPinModalConfig({
                          isOpen: true,
                          volumeId: volId,
                          volumeName: vol?.name || 'External Drive'
                        })
                      }
                    }
                  }}
                  className={`group flex items-center h-11 ${currentMapping ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-500/30'} font-semibold rounded-xl text-sm transition-all duration-300 ease-out shadow-lg cursor-pointer px-4 whitespace-nowrap gap-2`}
                >
                  {currentMapping ? (
                    <svg
                      className="w-5 h-5 min-w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243-4.242a5 5 0 00-1.415 7.072m0 0L3 21m2.828-9.9a9 9 0 01-1.414-7.071"
                      ></path>
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5 min-w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      ></path>
                    </svg>
                  )}
                  <span>{currentMapping ? `Unpin: ${currentMapping.name}` : 'Pin to Drive'}</span>
                </button>

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
                      const percent = downloadPercentages[item.id] || 0

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
                            <div className="flex-1 w-full">
                              {/* Title & Duration Row */}
                              <div className="flex justify-between items-start gap-4 mb-2">
                                <p className="text-gray-800 dark:text-gray-200 font-medium flex items-center gap-2 leading-tight">
                                  {item.title}
                                  {newLectures.has(item.id) && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-linear-to-r from-pink-500 to-purple-500 rounded-full shadow-[0_0_10px_rgba(236,72,153,0.4)] animate-pulse shrink-0">
                                      New
                                    </span>
                                  )}
                                </p>
                                {item.asset?.time_estimation &&
                                  (item.asset.asset_type === 'Video' ||
                                    item.asset.asset_type === 'VideoMashup') && (
                                    <span className="text-xs text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-md font-semibold shrink-0 flex items-center gap-1 shadow-sm">
                                      {Math.ceil(item.asset.time_estimation / 60)}m
                                    </span>
                                  )}
                              </div>

                              {/* Clean Progress Bar Row */}
                              {watchProgressMap[item.id] && (
                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden mt-1">
                                  <div
                                    className={`h-full transition-all duration-500 ${
                                      watchProgressMap[item.id].isCompleted
                                        ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                                        : 'bg-blue-500'
                                    }`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (watchProgressMap[item.id].currentTime / watchProgressMap[item.id].duration) * 100))}%`
                                    }}
                                  />
                                </div>
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
                                </svg>{' '}
                                Quiz
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    if (isModalOffline) return
                                    const isValid = await validateDownloadPath()
                                    if (isValid)
                                      handleDownloadItem(
                                        selectedCourse,
                                        item,
                                        chapterForThisItem,
                                        currentLectureIndex
                                      )
                                  }}
                                  disabled={
                                    status === 'downloading' ||
                                    status === 'success' ||
                                    status === 'drm' ||
                                    isModalOffline
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
                                              : isModalOffline
                                                ? 'bg-gray-200 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-100'
                                                : 'bg-gray-100 dark:bg-white/10 hover:bg-blue-600 hover:text-white text-gray-700 dark:text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer'
                                    }`}
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
                                      {percent}%
                                    </>
                                  )}
                                  {status === 'success' && '✓ Saved'}
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
                                {(status === 'success' ||
                                  status === 'drm' ||
                                  status === 'error') && (
                                  <button
                                    onClick={async () => {
                                      await window.api.invoke(
                                        'delete-lecture',
                                        selectedCourse.title,
                                        item.id
                                      )
                                      await window.api.invoke(
                                        'store-delete',
                                        `drm_${selectedCourse.id}.${item.id}`
                                      )
                                      setDownloadProgress((prev) => {
                                        const newMap = { ...prev }
                                        delete newMap[item.id]
                                        return newMap
                                      })
                                    }}
                                    className="p-2 text-red-500 hover:text-white hover:bg-red-500 bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                                    title="Delete File"
                                  >
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
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      ></path>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>

            {/* DELETE MODAL */}
            {isDeleteModalOpen && (
              <div
                className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setIsDeleteModalOpen(false)
                }}
              >
                <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
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
                            await window.api.invoke('delete-course-folder', selectedCourse.title)
                            await window.api.invoke('store-delete', `drm_${selectedCourse.id}`)
                            setDownloadProgress((prev) => {
                              const newMap = { ...prev }
                              curriculum.forEach((item) => {
                                delete newMap[item.id]
                              })
                              return newMap
                            })
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

            {/* --- PIN CUSTOM MODAL --- */}
            {pinModalConfig?.isOpen && (
              <div
                className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isUnpinning) setPinModalConfig(null)
                }}
              >
                <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                  <div className="p-4 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-2xl mb-5 shadow-inner">
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
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      ></path>
                    </svg>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Pin Course?
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                    You are about to pin this course to{' '}
                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                      {pinModalConfig.volumeName}
                    </span>
                    . Would you like to automatically transfer any existing downloaded files to this
                    drive?
                  </p>

                  <div className="flex flex-col gap-3 w-full">
                    <button
                      onClick={async () => {
                        setIsUnpinning(true)
                        const success = await window.api.invoke(
                          'pin-course',
                          selectedCourse.id,
                          selectedCourse.title,
                          pinModalConfig.volumeId,
                          true
                        )
                        if (success) {
                          const newMappings = await window.api.invoke('get-volume-mappings')
                          setVolumeMappings(newMappings)
                        }
                        setIsUnpinning(false)
                        setPinModalConfig(null)
                      }}
                      disabled={isUnpinning}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-purple-500/30 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                      {isUnpinning ? (
                        <>
                          <svg
                            className="w-5 h-5 animate-spin"
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
                          Moving...
                        </>
                      ) : (
                        'Yes, Move Files & Pin'
                      )}
                    </button>

                    {!isUnpinning && (
                      <>
                        <button
                          onClick={async () => {
                            setIsUnpinning(true)
                            const success = await window.api.invoke(
                              'pin-course',
                              selectedCourse.id,
                              selectedCourse.title,
                              pinModalConfig.volumeId,
                              false
                            )
                            if (success) {
                              const newMappings = await window.api.invoke('get-volume-mappings')
                              setVolumeMappings(newMappings)
                            }
                            setIsUnpinning(false)
                            setPinModalConfig(null)
                          }}
                          className="w-full py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white font-semibold rounded-xl transition-all cursor-pointer"
                        >
                          No, Pin Only (New Downloads)
                        </button>
                        <button
                          onClick={() => setPinModalConfig(null)}
                          className="w-full py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- UNPIN CUSTOM MODALS --- */}
            {unpinModalConfig.isOpen && (
              <div
                className="absolute inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                onClick={(e) => {
                  if (e.target === e.currentTarget && !isUnpinning)
                    setUnpinModalConfig({ isOpen: false, type: null })
                }}
              >
                <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                  {unpinModalConfig.type === 'offline' ? (
                    <>
                      <div className="p-4 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 rounded-2xl mb-5 shadow-inner">
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
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          ></path>
                        </svg>
                      </div>
                      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        Drive is Offline
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                        The pinned drive is currently unplugged. You can unpin the course, but any
                        existing files{' '}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          cannot be moved
                        </span>{' '}
                        and will remain permanently on the offline drive.
                      </p>

                      <div className="flex flex-col gap-3 w-full">
                        <button
                          onClick={async () => {
                            setIsUnpinning(true)
                            const success = await window.api.invoke(
                              'unpin-course',
                              selectedCourse.id,
                              selectedCourse.title,
                              false
                            )
                            if (success) {
                              const newMappings = await window.api.invoke('get-volume-mappings')
                              setVolumeMappings(newMappings)
                            }
                            setIsUnpinning(false)
                            setUnpinModalConfig({ isOpen: false, type: null })
                          }}
                          disabled={isUnpinning}
                          className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer disabled:opacity-70"
                        >
                          {isUnpinning ? 'Unpinning...' : 'Yes, Unpin & Leave Files Behind'}
                        </button>
                        <button
                          onClick={() => setUnpinModalConfig({ isOpen: false, type: null })}
                          disabled={isUnpinning}
                          className="w-full py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
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
                        Unpin Course?
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
                        You are about to remove this course from its pinned drive. Would you like to
                        automatically transfer the downloaded files back to your local folder?
                      </p>

                      <div className="flex flex-col gap-3 w-full">
                        <button
                          onClick={async () => {
                            setIsUnpinning(true)
                            const success = await window.api.invoke(
                              'unpin-course',
                              selectedCourse.id,
                              selectedCourse.title,
                              true
                            )
                            if (success) {
                              const newMappings = await window.api.invoke('get-volume-mappings')
                              setVolumeMappings(newMappings)
                            }
                            setIsUnpinning(false)
                            setUnpinModalConfig({ isOpen: false, type: null })
                          }}
                          disabled={isUnpinning}
                          className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-70"
                        >
                          {isUnpinning ? (
                            <>
                              <svg
                                className="w-5 h-5 animate-spin"
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
                              Moving...
                            </>
                          ) : (
                            'Yes, Move Files & Unpin'
                          )}
                        </button>

                        {!isUnpinning && (
                          <>
                            <button
                              onClick={async () => {
                                setIsUnpinning(true)
                                const success = await window.api.invoke(
                                  'unpin-course',
                                  selectedCourse.id,
                                  selectedCourse.title,
                                  false
                                )
                                if (success) {
                                  const newMappings = await window.api.invoke('get-volume-mappings')
                                  setVolumeMappings(newMappings)
                                }
                                setIsUnpinning(false)
                                setUnpinModalConfig({ isOpen: false, type: null })
                              }}
                              className="w-full py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white font-semibold rounded-xl transition-all cursor-pointer"
                            >
                              No, Unpin Only (Leave Files)
                            </button>
                            <button
                              onClick={() => setUnpinModalConfig({ isOpen: false, type: null })}
                              className="w-full py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer text-sm"
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* --- SUCCESS TOAST --- */}
            {queuedCount !== null && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-110 animate-in slide-in-from-bottom-8 fade-in duration-300">
                <div className="flex items-center gap-3 px-6 py-4 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-xl border border-green-200 dark:border-green-500/30 rounded-2xl shadow-2xl shadow-green-500/10 max-w-md w-full">
                  <div className="shrink-0 w-10 h-10 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center text-green-600 dark:text-green-400 shadow-inner">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-gray-900 dark:text-white font-bold text-sm">
                      Successfully Queued
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                      Added{' '}
                      <span className="font-bold text-green-600 dark:text-green-400">
                        {queuedCount}
                      </span>{' '}
                      new item{queuedCount !== 1 ? 's' : ''} to the background queue.
                    </p>
                  </div>
                  <button
                    onClick={() => setQueuedCount(null)}
                    className="text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors cursor-pointer"
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
            )}
          </div>
        </div>
      )}
    </div>
  )
}
