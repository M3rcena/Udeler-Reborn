import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  AppSettings,
  Course,
  CurriculumItem,
  DownloadContextType
} from 'src/preload/types/ipc-types'

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
  const [downloadSpeeds, setDownloadSpeeds] = useState<Record<number, number>>({})
  const [activeDownloads, setActiveDownloads] = useState<
    Record<number, { title: string; courseTitle: string }>
  >({})

  const activeWorkers = useRef<number>(0)
  const isQueuePaused = useRef<boolean>(false)
  const manualOverride = useRef<boolean>(false)
  const totalSessionItems = useRef<number>(0)
  const completedSessionItems = useRef<number>(0)

  useEffect(() => {
    const unsubscribe = window.api.onDownloadProgress((data) => {
      setDownloadPercentages((prev) => ({
        ...prev,
        [data.lectureId]: data.percentage
      }))
      setDownloadSpeeds((prev) => ({
        ...prev,
        [data.lectureId]: data.speed
      }))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    window.api.invoke('os-update-queue-menu', queueStatus)

    const activeKeys = Object.keys(activeDownloads)
    const totalActive = activeKeys.length

    if (queueStatus === 'idle' && totalActive === 0) {
      totalSessionItems.current = 0
      completedSessionItems.current = 0
      window.api.invoke('os-set-progress', -1)
      window.api.invoke('os-set-tray-tooltip', 'Udeler Reborn - Idle')
    } else {
      const sumOfActivePercentages = activeKeys.reduce(
        (acc, key) => acc + (downloadPercentages[parseInt(key)] || 0),
        0
      )
      const total = totalSessionItems.current || 1
      const completed = completedSessionItems.current

      let globalProgress = (completed + sumOfActivePercentages / 100) / total
      globalProgress = Math.min(1, Math.max(0.01, globalProgress))

      window.api.invoke('os-set-progress', globalProgress)
      window.api.invoke(
        'os-set-tray-tooltip',
        `Udeler: ${totalActive} active, ${queueCount} queued`
      )
    }
  }, [activeDownloads, downloadPercentages, queueCount, queueStatus])

  useEffect(() => {
    const loadSavedQueue = async (): Promise<void> => {
      const savedQueue = (await window.api.invoke('store-get', 'saved_queue')) as
        typeof downloadQueue.current | undefined
      if (savedQueue && savedQueue.length > 0) {
        downloadQueue.current = savedQueue
        setQueueCount(savedQueue.length)
        totalSessionItems.current = savedQueue.length
        setQueueStatus('paused')
      }
    }
    loadSavedQueue()
  }, [])

  const syncQueueToDisk = (): void => {
    window.api.invoke('store-set', 'saved_queue', downloadQueue.current)
  }

  const validateDownloadPath = async (): Promise<boolean> => {
    const settings = (await window.api.invoke('store-get', 'app_settings')) as
      { downloadPath?: string } | undefined
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
    let isCanceled = false

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
        isCanceled = true
      } else if (errorMessage.includes('DRM protected')) {
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'drm' }))
        window.api.invoke('store-set', `drm_${course.id}.${item.id}`, true)
      } else {
        console.error('Download Failed:', error)
        setDownloadProgress((prev) => ({ ...prev, [item.id]: 'error' }))
      }
    } finally {
      if (!isPaused && !isCanceled) {
        completedSessionItems.current++
      } else if (isCanceled) {
        totalSessionItems.current--
      }

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
      if (activeWorkers.current === 0) {
        setQueueStatus('idle')
        manualOverride.current = false
      }
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
      syncQueueToDisk()
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

    const settings = (await window.api.invoke('store-get', 'app_settings')) as
      AppSettings | undefined
    let isWithinScheduleWindow = true

    if (settings?.scheduleEnabled && settings?.scheduleStart && settings?.scheduleEnd) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const [startH, startM] = settings.scheduleStart.split(':').map(Number)
      const [endH, endM] = settings.scheduleEnd.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM

      if (startMinutes < endMinutes) {
        isWithinScheduleWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes
      } else {
        isWithinScheduleWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes
      }
    }

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

    if (newTasks.length === 0) return 0

    totalSessionItems.current += newTasks.length
    downloadQueue.current = [...downloadQueue.current, ...newTasks]
    setQueueCount(downloadQueue.current.length)

    const shouldRun = isWithinScheduleWindow || manualOverride.current

    if (shouldRun) {
      isQueuePaused.current = false
      setQueueStatus('running')
      const availableWorkers = Math.max(0, 3 - activeWorkers.current)
      for (let i = 0; i < availableWorkers; i++) {
        setTimeout(processQueue, i * 500)
      }
    } else {
      isQueuePaused.current = true
      setQueueStatus('paused')
    }

    syncQueueToDisk()
    return newTasks.length
  }

  const startBatchDownloadQueue = async (
    courseList: { course: Course; curriculum: CurriculumItem[] }[]
  ): Promise<number> => {
    if (courseList.length === 0) return 0
    const isValid = await validateDownloadPath()
    if (!isValid) return 0

    const settings = (await window.api.invoke('store-get', 'app_settings')) as
      AppSettings | undefined

    let isWithinScheduleWindow = true
    if (settings?.scheduleEnabled && settings?.scheduleStart && settings?.scheduleEnd) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()
      const [startH, startM] = settings.scheduleStart.split(':').map(Number)
      const [endH, endM] = settings.scheduleEnd.split(':').map(Number)
      const startMinutes = startH * 60 + startM
      const endMinutes = endH * 60 + endM
      if (startMinutes < endMinutes) {
        isWithinScheduleWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes
      } else {
        isWithinScheduleWindow = currentMinutes >= startMinutes || currentMinutes < endMinutes
      }
    }

    const newTasks: typeof downloadQueue.current = []

    for (const entry of courseList) {
      const { course, curriculum } = entry
      let trackingTitle = 'Uncategorized'
      let lectureCounter = 1

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
    }

    if (newTasks.length === 0) return 0
    totalSessionItems.current += newTasks.length
    downloadQueue.current = [...downloadQueue.current, ...newTasks]
    setQueueCount(downloadQueue.current.length)

    const shouldRun = isWithinScheduleWindow || manualOverride.current
    if (shouldRun) {
      isQueuePaused.current = false
      setQueueStatus('running')
      const availableWorkers = Math.max(0, 3 - activeWorkers.current)
      for (let i = 0; i < availableWorkers; i++) {
        setTimeout(processQueue, i * 500)
      }
    } else {
      isQueuePaused.current = true
      setQueueStatus('paused')
    }
    syncQueueToDisk()
    return newTasks.length
  }

  const pauseQueue = useCallback((): void => {
    manualOverride.current = false
    isQueuePaused.current = true
    setQueueStatus('paused')

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.invoke('pause-download', id)
      }
    })
    syncQueueToDisk()
  }, [downloadProgress])

  const resumeQueue = useCallback((): void => {
    manualOverride.current = true
    isQueuePaused.current = false
    setQueueStatus('running')

    const availableWorkers = Math.max(0, 3 - activeWorkers.current)
    for (let i = 0; i < availableWorkers; i++) {
      setTimeout(processQueue, i * 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const schedulePause = useCallback((): void => {
    if (manualOverride.current || isQueuePaused.current) return
    isQueuePaused.current = true
    setQueueStatus('paused')

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.invoke('pause-download', id)
      }
    })
    syncQueueToDisk()
  }, [downloadProgress])

  const scheduleResume = useCallback((): void => {
    manualOverride.current = false
    if (!isQueuePaused.current) return

    isQueuePaused.current = false
    setQueueStatus('running')

    const availableWorkers = Math.max(0, 3 - activeWorkers.current)
    for (let i = 0; i < availableWorkers; i++) {
      setTimeout(processQueue, i * 500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cancelQueue = useCallback((): void => {
    manualOverride.current = false
    isQueuePaused.current = true
    setQueueStatus('idle')
    downloadQueue.current = []
    setQueueCount(0)

    Object.entries(downloadProgress).forEach(([idStr, status]) => {
      if (status === 'downloading') {
        const id = parseInt(idStr)
        window.api.invoke('cancel-download', id)

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

    syncQueueToDisk()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const unsubPause = window.api.onSchedulePause(() => {
      if (queueStatus === 'running') schedulePause()
    })

    const unsubResume = window.api.onScheduleResume(() => {
      if (queueStatus === 'paused' && downloadQueue.current.length > 0) {
        scheduleResume()
      } else {
        manualOverride.current = false
      }
    })

    const unsubTray = window.api.onTrayAction((action) => {
      if (action === 'pause') pauseQueue()
      else if (action === 'resume') resumeQueue()
      else if (action === 'cancel') cancelQueue()
    })

    return () => {
      unsubPause()
      unsubResume()
      unsubTray()
    }
  }, [queueStatus, schedulePause, scheduleResume, pauseQueue, resumeQueue, cancelQueue])

  return (
    <DownloadContext.Provider
      value={{
        downloadProgress,
        setDownloadProgress,
        downloadPercentages,
        downloadSpeeds,
        activeDownloads,
        queueStatus,
        queueCount,
        isPathAlertOpen,
        setIsPathAlertOpen,
        validateDownloadPath,
        handleDownloadItem,
        startDownloadQueue,
        startBatchDownloadQueue,
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
