import { useDownload } from '@renderer/contexts/DownloadContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Course, DownloadedFile, WatchProgress, WatchProgressControls } from 'src/preload/ipc-types'

function useWatchProgress(
  lectureId: number | null,
  videoRef: React.RefObject<HTMLVideoElement | null>
): WatchProgressControls {
  const lastSavedTime = useRef<number>(0)

  useEffect(() => {
    const videoElement = videoRef.current
    if (!videoElement || !lectureId) return

    const loadProgress = async (): Promise<void> => {
      const progress = (await window.api.invoke('store-get', `watch_progress.${lectureId}`)) as
        WatchProgress | undefined

      if (progress && !progress.isCompleted && videoRef.current) {
        videoRef.current.currentTime = progress.currentTime
        lastSavedTime.current = progress.currentTime
      }
    }

    loadProgress()
  }, [lectureId, videoRef])

  const handleTimeUpdate = async (): Promise<void> => {
    const videoElement = videoRef.current
    if (!videoElement || !lectureId) return

    const currentTime = videoElement.currentTime
    const duration = videoElement.duration

    if (!duration || isNaN(duration)) return

    if (Math.abs(currentTime - lastSavedTime.current) > 5) {
      lastSavedTime.current = currentTime
      const isCompleted = currentTime / duration > 0.95

      await window.api.invoke('store-set', `watch_progress.${lectureId}`, {
        currentTime,
        duration,
        isCompleted
      })
    }
  }

  const forceSave = async (): Promise<void> => {
    const videoElement = videoRef.current
    if (!videoElement || !lectureId || isNaN(videoElement.duration)) return

    const isCompleted = videoElement.currentTime / videoElement.duration > 0.95

    await window.api.invoke('store-set', `watch_progress.${lectureId}`, {
      currentTime: videoElement.currentTime,
      duration: videoElement.duration,
      isCompleted
    })
  }

  return { handleTimeUpdate, forceSave }
}

interface DownloadsTabProps {
  playMediaItem?: DownloadedFile | null
  onMediaHandled?: () => void
  searchLectureId?: number | null
  onSearchHandled?: () => void
}

export const DownloadsTab: React.FC<DownloadsTabProps> = ({
  playMediaItem,
  onMediaHandled,
  searchLectureId,
  onSearchHandled
}) => {
  const {
    downloadProgress,
    setDownloadProgress,
    queueStatus,
    queueCount,
    pauseQueue,
    resumeQueue,
    cancelQueue
  } = useDownload()

  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([])
  const [watchProgressMap, setWatchProgressMap] = useState<Record<number, WatchProgress>>({})
  const [isScanning, setIsScanning] = useState(true)

  const [selectedMedia, setSelectedMedia] = useState<DownloadedFile | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const lectureIdMatch = selectedMedia?.file.match(/\[ID_(\d+)\]/)
  const selectedLectureId = lectureIdMatch ? parseInt(lectureIdMatch[1], 10) : null

  const { handleTimeUpdate, forceSave } = useWatchProgress(selectedLectureId, videoRef)

  const [isDeleteAllModalOpen, setIsDeleteAllModalOpen] = useState<boolean>(false)
  const [isDeletingAll, setIsDeletingAll] = useState<boolean>(false)

  const [activeCourse, setActiveCourse] = useState<string | null>(null)
  const [activeChapter, setActiveChapter] = useState<string | null>(null)

  const [glowLectureId, setGlowLectureId] = useState<number | null>(null)

  const coursesList = useMemo(
    () => Array.from(new Set(downloadedFiles.map((f) => f.course))),
    [downloadedFiles]
  )
  const chaptersList = useMemo(
    () =>
      activeCourse
        ? Array.from(
            new Set(downloadedFiles.filter((f) => f.course === activeCourse).map((f) => f.chapter))
          )
        : [],
    [downloadedFiles, activeCourse]
  )
  const filesList = useMemo(
    () =>
      activeChapter
        ? downloadedFiles.filter((f) => f.course === activeCourse && f.chapter === activeChapter)
        : [],
    [downloadedFiles, activeCourse, activeChapter]
  )

  useEffect(() => {
    if (activeCourse && !coursesList.includes(activeCourse)) {
      setTimeout(() => {
        setActiveCourse(null)
        setActiveChapter(null)
      }, 0)
    } else if (activeChapter && !chaptersList.includes(activeChapter)) {
      setTimeout(() => {
        setActiveChapter(null)
      }, 0)
    }
  }, [coursesList, chaptersList, activeCourse, activeChapter])

  useEffect(() => {
    if (searchLectureId && downloadedFiles.length > 0) {
      const targetFile = downloadedFiles.find(
        (f) =>
          f.file.includes(`[ID_${searchLectureId}]`) && (f.type === 'Video' || f.type === 'Article')
      )

      if (targetFile) {
        setTimeout(() => {
          setActiveCourse(targetFile.course)
          setActiveChapter(targetFile.chapter)

          setSelectedMedia(targetFile)

          setGlowLectureId(searchLectureId)
        })

        setTimeout(() => setGlowLectureId(null), 4000)
      }

      if (onSearchHandled) onSearchHandled()
    }
  }, [searchLectureId, downloadedFiles, onSearchHandled])

  const stats = useMemo(() => {
    const statuses = Object.values(downloadProgress)
    return {
      total: statuses.length,
      downloading: statuses.filter((s) => s === 'downloading').length,
      success: statuses.filter((s) => s === 'success').length,
      error: statuses.filter((s) => s === 'error').length,
      drm: statuses.filter((s) => s === 'drm').length
    }
  }, [downloadProgress])

  const fetchDiskData = async (): Promise<void> => {
    setIsScanning(true)
    try {
      const [files, progress] = await Promise.all([
        window.api.invoke('get-all-downloads'),
        window.api.invoke('store-get', 'watch_progress') as Promise<
          Record<number, WatchProgress> | undefined
        >
      ])
      setDownloadedFiles(files)
      if (progress) setWatchProgressMap(progress)
    } catch (err) {
      console.error('Failed to scan downloads', err)
    } finally {
      setIsScanning(false)
    }
  }

  useEffect(() => {
    setTimeout(() => {
      fetchDiskData()
    }, 0)
  }, [])

  useEffect(() => {
    if (playMediaItem) {
      setTimeout(() => {
        setSelectedMedia(playMediaItem)
      })
      if (onMediaHandled) onMediaHandled()
    }
  }, [playMediaItem, onMediaHandled])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-10 flex flex-col h-full relative z-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            Queue & Library
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Monitor active downloads and play saved media.
          </p>
        </div>

        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm font-semibold text-sm ${queueStatus === 'running' ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400' : queueStatus === 'paused' ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400'}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${queueStatus === 'running' ? 'bg-blue-500 animate-pulse' : queueStatus === 'paused' ? 'bg-yellow-500' : 'bg-gray-400'}`}
          ></div>
          Queue: {queueStatus.charAt(0).toUpperCase() + queueStatus.slice(1)}
        </div>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        <div className="p-6 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-linear-to-tr from-blue-600 to-purple-600 rounded-2xl text-white shadow-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Master Controls</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage the background worker engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={queueStatus === 'paused' ? resumeQueue : pauseQueue}
              disabled={queueStatus === 'idle'}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${queueStatus === 'paused' ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/30 cursor-pointer' : 'bg-yellow-500 hover:bg-yellow-400 text-white shadow-yellow-500/30 cursor-pointer'}`}
            >
              {queueStatus === 'paused' ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  </svg>{' '}
                  Resume
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>{' '}
                  Pause
                </>
              )}
            </button>
            <button
              onClick={cancelQueue}
              disabled={queueStatus === 'idle'}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 ${queueStatus === 'idle' ? 'cursor-not-allowed' : 'cursor-pointer'} disabled:opacity-50`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              </svg>{' '}
              Stop All
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-purple-200 dark:border-purple-500/20 rounded-4xl shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
              Waiting
            </h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{queueCount}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-blue-200 dark:border-blue-500/20 rounded-4xl shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">In Progress</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.downloading}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-green-200 dark:border-green-500/20 rounded-4xl shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">Completed</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.success}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-red-200 dark:border-red-500/20 rounded-4xl shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">Failed</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.error}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">DRM Locked</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.drm}</p>
          </div>
        </div>

        <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl p-8 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white">
              <button
                onClick={() => {
                  setActiveCourse(null)
                  setActiveChapter(null)
                }}
                className={`hover:text-blue-500 transition-colors flex items-center gap-2 cursor-pointer ${!activeCourse ? '' : 'text-gray-400 dark:text-gray-500 text-lg'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  ></path>
                </svg>{' '}
                Library
              </button>
              {activeCourse && (
                <>
                  <svg
                    className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                  <button
                    onClick={() => setActiveChapter(null)}
                    className={`truncate max-w-37.5 sm:max-w-xs hover:text-blue-500 cursor-pointer transition-colors ${!activeChapter ? '' : 'text-gray-400 dark:text-gray-500 text-lg'}`}
                    title={activeCourse}
                  >
                    {activeCourse}
                  </button>
                </>
              )}
              {activeChapter && (
                <>
                  <svg
                    className="w-5 h-5 text-gray-300 dark:text-gray-600 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                  <span className="truncate max-w-37.5 sm:max-w-xs" title={activeChapter}>
                    {activeChapter}
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              {downloadedFiles.length > 0 && (
                <button
                  onClick={() => setIsDeleteAllModalOpen(true)}
                  className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    ></path>
                  </svg>{' '}
                  Remove All
                </button>
              )}
              {downloadedFiles.length > 0 && (
                <div className="w-px h-4 bg-gray-300 dark:bg-white/10"></div>
              )}
              <button
                onClick={fetchDiskData}
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold cursor-pointer flex items-center gap-2 transition-colors"
              >
                <svg
                  className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`}
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
                Refresh Disk
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
            {activeCourse && (
              <div
                onClick={() => (activeChapter ? setActiveChapter(null) : setActiveCourse(null))}
                className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-white/5 border border-dashed border-gray-200 dark:border-white/10 rounded-xl hover:border-gray-400 dark:hover:border-white/30 hover:bg-gray-100 dark:hover:bg-white/10 transition-all cursor-pointer text-gray-500 dark:text-gray-400 font-medium text-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  ></path>
                </svg>{' '}
                Go Back
              </div>
            )}

            {isScanning ? (
              <div className="flex items-center justify-center h-40 text-gray-500">
                Scanning local disk...
              </div>
            ) : downloadedFiles.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-500">
                No downloaded files found in your settings path.
              </div>
            ) : (
              <>
                {!activeCourse &&
                  coursesList.map((course) => {
                    const count = downloadedFiles.filter((f) => f.course === course).length
                    return (
                      <div
                        key={course}
                        onClick={() => setActiveCourse(course)}
                        className="flex items-center gap-4 p-4 bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all cursor-pointer group"
                      >
                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            ></path>
                          </svg>
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                            {course}
                          </p>
                          <p className="text-xs text-gray-500">
                            {count} file{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
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
                              d="M9 5l7 7-7 7"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    )
                  })}

                {activeCourse &&
                  !activeChapter &&
                  chaptersList.map((chapter) => {
                    const count = downloadedFiles.filter(
                      (f) => f.course === activeCourse && f.chapter === chapter
                    ).length
                    return (
                      <div
                        key={chapter}
                        onClick={() => setActiveChapter(chapter)}
                        className="flex items-center gap-4 p-4 bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl hover:border-blue-500/30 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all cursor-pointer group"
                      >
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400">
                          <svg
                            className="w-6 h-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
                            ></path>
                          </svg>
                        </div>
                        <div className="flex-1 truncate">
                          <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                            {chapter}
                          </p>
                          <p className="text-xs text-gray-500">
                            {count} file{count !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
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
                              d="M9 5l7 7-7 7"
                            ></path>
                          </svg>
                        </div>
                      </div>
                    )
                  })}

                {activeCourse &&
                  activeChapter &&
                  filesList.map((item, index) => {
                    const match = item.file.match(/\[ID_(\d+)\]/)
                    const lectureId = match ? parseInt(match[1], 10) : null
                    const progressData = lectureId ? watchProgressMap[lectureId] : null
                    const isGlowing = glowLectureId !== null && glowLectureId === lectureId

                    return (
                      <div
                        key={index}
                        className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-xl hover:border-blue-500/30 transition-all group gap-4 ${
                          isGlowing
                            ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] animate-pulse duration-1000'
                            : 'bg-white dark:bg-black/20 border-gray-100 dark:border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0 w-full pr-4">
                          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                            {item.type === 'Video' ? (
                              <svg
                                className="w-6 h-6"
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
                              </svg>
                            ) : (
                              <svg
                                className="w-6 h-6"
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
                          <div className="truncate w-full">
                            <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                              {item.file}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-xs text-gray-500 truncate">
                                {item.type} • {item.size} MB
                              </p>
                              {progressData && (
                                <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-500 ${progressData.isCompleted ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-blue-500'}`}
                                    style={{
                                      width: `${Math.min(100, Math.max(0, (progressData.currentTime / progressData.duration) * 100))}%`
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-auto">
                          <button
                            onClick={async (): Promise<void> => {
                              try {
                                const savedCourses = (await window.api.invoke(
                                  'store-get',
                                  'cached_courses'
                                )) as Course[] | undefined

                                const matchedCourse = savedCourses?.find(
                                  (c: Course) =>
                                    c.title.replace(/[<>:"/\\|?*]+/g, '-').trim() === item.course
                                )

                                if (matchedCourse && matchedCourse.id) {
                                  window.api.invoke('os-set-recent-course', {
                                    title: item.file,
                                    id: matchedCourse.id,
                                    file: item
                                  })
                                }
                              } catch (err) {
                                console.error('Failed to set recent course for OS tray:', err)
                              }

                              setSelectedMedia(item)
                              await fetchDiskData()
                            }}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-all shadow-md cursor-pointer"
                          >
                            {item.type === 'Video' ? 'Play Video' : 'Read Content'}
                          </button>
                          <button
                            onClick={async () => {
                              const success = await window.api.invoke(
                                'delete-file-by-path',
                                item.path
                              )
                              if (success) {
                                if (lectureId)
                                  setDownloadProgress((prev) => {
                                    const newMap = { ...prev }
                                    delete newMap[lectureId]
                                    return newMap
                                  })
                                setDownloadedFiles((prev) =>
                                  prev.filter((f) => f.path !== item.path)
                                )
                              }
                            }}
                            className="p-2 text-red-500 hover:text-white hover:bg-red-500 bg-red-500/10 rounded-lg transition-colors cursor-pointer shadow-md"
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
                        </div>
                      </div>
                    )
                  })}
              </>
            )}
          </div>
        </div>
      </div>

      {selectedMedia && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              forceSave()
              setSelectedMedia(null)
              fetchDiskData()
            }
          }}
        >
          <button
            onClick={async () => {
              await forceSave()
              setSelectedMedia(null)
              fetchDiskData()
            }}
            className="absolute top-6 right-6 z-110 p-4 bg-red-600/90 hover:bg-red-500 rounded-full text-white shadow-[0_0_30px_rgba(220,38,38,0.5)] transition-all cursor-pointer backdrop-blur-md hover:scale-110"
            title="Close Player"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>

          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-4xl border border-white/10 shadow-2xl overflow-hidden flex flex-col group/player">
            <div className="absolute top-0 left-0 right-0 p-6 bg-linear-to-b from-black/90 via-black/50 to-transparent z-10 pointer-events-none">
              <h3 className="text-white font-bold text-lg truncate pr-4 drop-shadow-md">
                {selectedMedia.file}
              </h3>
            </div>

            <div className="flex-1 bg-black flex items-center justify-center">
              {selectedMedia.type === 'Video' ? (
                <video
                  ref={videoRef}
                  key={selectedMedia.path}
                  src={`local://${encodeURIComponent(selectedMedia.path)}`}
                  controls
                  autoPlay
                  onTimeUpdate={handleTimeUpdate}
                  onPause={forceSave}
                  onEnded={forceSave}
                  className="w-full h-full object-contain"
                >
                  {selectedMedia.subtitles?.map((sub, idx) => (
                    <track
                      key={idx}
                      kind="captions"
                      label={sub.label}
                      srcLang={sub.srcLang}
                      src={sub.path}
                    />
                  ))}
                </video>
              ) : (
                <iframe
                  src={`local://${encodeURIComponent(selectedMedia.path)}`}
                  className="w-full h-full bg-white rounded-xl m-4 mt-20"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE ALL MODAL --- */}
      {isDeleteAllModalOpen && (
        <div
          className="absolute inset-0 z-120 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingAll) setIsDeleteAllModalOpen(false)
          }}
        >
          <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-2xl mb-5 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                ></path>
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Delete All Library Files?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
              You are about to permanently erase{' '}
              <span className="font-bold text-gray-800 dark:text-gray-200">
                {downloadedFiles.length} files
              </span>{' '}
              from your local disk. This will clear your entire downloaded library.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => setIsDeleteAllModalOpen(false)}
                disabled={isDeletingAll}
                className="py-3 px-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setIsDeletingAll(true)
                  const uniqueCourses = Array.from(new Set(downloadedFiles.map((f) => f.course)))
                  for (const course of uniqueCourses) {
                    await window.api.invoke('delete-course-folder', course)
                  }
                  setDownloadedFiles([])
                  setDownloadProgress({})
                  setIsDeletingAll(false)
                  setIsDeleteAllModalOpen(false)
                }}
                disabled={isDeletingAll}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-red-600/30 cursor-pointer disabled:opacity-70"
              >
                {isDeletingAll ? (
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
                    Deleting...
                  </>
                ) : (
                  'Yes, Delete All'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
