import { Course, CurriculumItem, DownloadContextType } from '@renderer/types'
import { createContext, ReactNode, useContext, useRef, useState } from 'react'

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

export const DownloadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- GLOBAL STATES ---
  const [downloadProgress, setDownloadProgress] = useState<Record<number, string>>({})
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused'>('idle')
  const [isPathAlertOpen, setIsPathAlertOpen] = useState<boolean>(false)

  // --- QUEUE WORKERS ---
  const downloadQueue = useRef<
    { course: Course; item: CurriculumItem; chapterTitle: string; index: number }[]
  >([])
  const activeWorkers = useRef<number>(0)
  const isQueuePaused = useRef<boolean>(false)

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

  const handleDownloadItem = async (
    course: Course,
    item: CurriculumItem,
    chapterTitle: string,
    lectureIndex: number
  ): Promise<void> => {
    if (!course) return
    setDownloadProgress((prev) => ({ ...prev, [item.id]: 'downloading' }))

    let downloadType = 'Video'
    if (item._class === 'quiz') downloadType = 'Quiz'
    else if (item.asset?.asset_type === 'Article') downloadType = 'Article'
    else if (item.asset?.asset_type === 'E-Book') downloadType = 'E-Book'
    else if (item.asset?.asset_type === 'File') downloadType = 'File'

    const request = {
      courseId: course.id,
      courseTitle: course.title,
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
        window.api.setStore(`drm_${course.id}.${item.id}`, true)
      } else {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'error' }))
      }
    }
  }

  const processQueue = async (): Promise<void> => {
    if (isQueuePaused.current) return
    if (activeWorkers.current >= 3) return // Max 3 concurrent

    const nextTask = downloadQueue.current.shift()
    if (!nextTask) {
      if (activeWorkers.current === 0) setQueueStatus('idle')
      return
    }

    activeWorkers.current++
    processQueue()

    try {
      await handleDownloadItem(
        nextTask.course,
        nextTask.item,
        nextTask.chapterTitle,
        nextTask.index
      )
    } catch {
      console.error('Worker failed on item', nextTask.item.id)
    } finally {
      activeWorkers.current--
      processQueue()
    }
  }

  const startDownloadQueue = async (
    course: Course,
    curriculum: CurriculumItem[],
    currentChapterTitle: string
  ): Promise<void> => {
    if (!course || curriculum.length === 0) return

    const isValid = await validateDownloadPath()
    if (!isValid) return

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

      newQueue.push({ course, item, chapterTitle: trackingTitle, index: currentIndex })
    }

    downloadQueue.current = newQueue
    isQueuePaused.current = false
    setQueueStatus('running')

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
    processQueue()
  }

  const cancelQueue = (): void => {
    isQueuePaused.current = true
    setQueueStatus('idle')
    downloadQueue.current = []

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.cancelDownload(id)
        setDownloadProgress((prev) => {
          const newMap = { ...prev }
          delete newMap[id]
          return newMap
        })
      }
    })
    activeWorkers.current = 0
  }

  return (
    <DownloadContext.Provider
      value={{
        downloadProgress,
        setDownloadProgress,
        queueStatus,
        isPathAlertOpen,
        setIsPathAlertOpen,
        validateDownloadPath,
        handleDownloadItem,
        startDownloadQueue,
        pauseQueue,
        resumeQueue,
        cancelQueue
      }}
    >
      {children}
    </DownloadContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDownload = (): DownloadContextType => {
  const context = useContext(DownloadContext)
  if (context === undefined) {
    throw new Error('useDownload must be used within a DownloadProvider')
  }
  return context
}
