import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react'
import { Course, CurriculumItem, DownloadContextType } from 'src/preload/ipc-types'

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)

export const DownloadProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- GLOBAL STATES ---
  const [downloadProgress, setDownloadProgress] = useState<Record<number, string>>({})
  const [queueStatus, setQueueStatus] = useState<'idle' | 'running' | 'paused'>('idle')
  const [queueCount, setQueueCount] = useState<number>(0)
  const [isPathAlertOpen, setIsPathAlertOpen] = useState<boolean>(false)

  // --- QUEUE WORKERS ---
  const downloadQueue = useRef<
    { course: Course; item: CurriculumItem; chapterTitle: string; index: number }[]
  >([])
  const [downloadPercentages, setDownloadPercentages] = useState<Record<number, number>>({})
  const [activeDownloads, setActiveDownloads] = useState<
    Record<number, { title: string; courseTitle: string }>
  >({})
  const activeWorkers = useRef<number>(0)
  const isQueuePaused = useRef<boolean>(false)

  useEffect(() => {
    const unsubscribe = window.api.onDownloadProgress((data) => {
      setDownloadPercentages((prev) => ({
        ...prev,
        [data.lectureId]: data.percentage
      }))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  const validateDownloadPath = async (): Promise<boolean> => {
    const settings = (await window.api.invoke('store-get', 'app_settings')) as
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

    setActiveDownloads((prev) => ({
      ...prev,
      [item.id]: { title: item.title, courseTitle: course.title }
    }))

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
      type: downloadType as 'Video' | 'Article' | 'Quiz' | 'File' | 'E-Book',
      timeEstimation: item.asset?.time_estimation
    }

    let isPaused = false

    try {
      const result = await window.api.invoke('start-download', request)

      if (result === 'USER_PAUSED') throw new Error('USER_PAUSED')
      if (result === 'USER_CANCELED') throw new Error('USER_CANCELED')

      setDownloadProgress((prev) => ({ ...prev, [item.id]: 'success' }))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('USER_PAUSED')) {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'paused' }))
        downloadQueue.current.unshift({ course, item, chapterTitle, index: lectureIndex })
        isPaused = true
      } else if (errorMessage.includes('USER_CANCELED')) {
        isPaused = true
      } else if (errorMessage.includes('DRM protected')) {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'drm' }))
        window.api.invoke('store-set', `drm_${course.id}.${item.id}`, true)
      } else {
        console.error('Download Failed:', error)
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'error' }))
      }
    } finally {
      if (!isPaused) {
        setActiveDownloads((prev) => {
          const newMap = { ...prev }
          delete newMap[item.id]
          return newMap
        })
      }
    }
  }

  const processQueue = async (): Promise<void> => {
    if (isQueuePaused.current) return
    if (activeWorkers.current >= 3) return // Max 3 concurrent

    const nextTask = downloadQueue.current.shift()
    setQueueCount(downloadQueue.current.length)

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
  ): Promise<number> => {
    if (!course || curriculum.length === 0) return 0

    const isValid = await validateDownloadPath()
    if (!isValid) return 0

    let trackingTitle = currentChapterTitle
    let lectureCounter = 1
    const newTasks: typeof downloadQueue.current = []

    for (const item of curriculum) {
      if (item._class === 'chapter') {
        trackingTitle = item.title
        continue
      }

      const currentIndex = lectureCounter++
      if (item._class === 'quiz') continue

      const status = downloadProgress[item.id]

      const isAlreadyQueued = downloadQueue.current.some((q) => q.item.id === item.id)
      if (status === 'downloading' || status === 'success' || isAlreadyQueued) continue

      newTasks.push({ course, item, chapterTitle: trackingTitle, index: currentIndex })
    }

    if (newTasks.length === 0) return 0 // Stop early if there is nothing new to add

    downloadQueue.current = [...downloadQueue.current, ...newTasks]
    setQueueCount(downloadQueue.current.length)
    isQueuePaused.current = false
    setQueueStatus('running')

    const availableWorkers = Math.max(0, 3 - activeWorkers.current)
    for (let i = 0; i < availableWorkers; i++) {
      setTimeout(processQueue, i * 500)
    }

    return newTasks.length // Return the total items queued
  }

  const pauseQueue = (): void => {
    isQueuePaused.current = true
    setQueueStatus('paused')

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.invoke('pause-download', id)
      }
    })
  }

  const resumeQueue = (): void => {
    isQueuePaused.current = false
    setQueueStatus('running')

    const availableWorkers = Math.max(0, 3 - activeWorkers.current)
    for (let i = 0; i < availableWorkers; i++) {
      setTimeout(processQueue, i * 500)
    }
  }

  const cancelQueue = (): void => {
    isQueuePaused.current = true
    setQueueStatus('idle')
    downloadQueue.current = []
    setQueueCount(0)

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.invoke('cancel-download', id)

        // Clear it cleanly
        setDownloadProgress((prev) => {
          const newMap = { ...prev }
          delete newMap[id]
          return newMap
        })
        setActiveDownloads((prev) => {
          const newMap = { ...prev }
          delete newMap[id]
          return newMap
        })
      }
    })
  }

  return (
    <DownloadContext.Provider
      value={{
        downloadProgress,
        setDownloadProgress,
        downloadPercentages,
        activeDownloads,
        queueStatus,
        queueCount,
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
