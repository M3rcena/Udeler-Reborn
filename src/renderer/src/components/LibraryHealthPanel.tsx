import { useDownload } from '@renderer/contexts/DownloadContext'
import { useI18n } from '@renderer/contexts/I18nContext'
import React, { useEffect, useState } from 'react'
import {
  Course,
  CurriculumItem,
  IntegrityIssue,
  IntegrityProgress
} from 'src/preload/types/ipc-types'

export const LibraryHealthPanel: React.FC = () => {
  const { handleDownloadItem } = useDownload()
  const { t } = useI18n()
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState<IntegrityProgress | null>(null)
  const [issues, setIssues] = useState<IntegrityIssue[]>([])
  const [hasScanned, setHasScanned] = useState(false)

  useEffect(() => {
    const unsub = window.api.onIntegrityProgress((data) => {
      setProgress(data)
    })
    return () => unsub()
  }, [])

  const runScan = async (): Promise<void> => {
    setIsScanning(true)
    setProgress(null)
    setHasScanned(false)
    try {
      const results = await window.api.invoke('start-integrity-scan')
      setIssues(results)
      setHasScanned(true)
    } catch (err) {
      console.error('Integrity scan failed', err)
    } finally {
      setIsScanning(false)
    }
  }

  const handleRepair = async (issue: IntegrityIssue): Promise<void> => {
    try {
      await window.api.invoke('delete-lecture', issue.courseTitle, issue.lectureId)

      const cachedCourses = (await window.api.invoke('store-get', 'cached_courses')) as Course[]
      const course = cachedCourses.find(
        (c) => c.title.replace(/[<>:"/\\|?*]+/g, '-').trim() === issue.courseTitle
      )

      if (!course) throw new Error('Course not found in cache.')

      const curriculum = (await window.api.invoke(
        'fetch-curriculum',
        course.id
      )) as CurriculumItem[]

      const item = curriculum.find((i) => i.id === issue.lectureId)
      if (!item) throw new Error('Lecture not found in live curriculum.')

      setIssues((prev) => prev.filter((i) => i.lectureId !== issue.lectureId))

      await handleDownloadItem(course, item, issue.chapterTitle, 0)
    } catch (err) {
      console.error('Failed to initiate repair:', err)
      alert('Repair failed. The course might no longer be available on Udemy.')
    }
  }

  const percent = progress?.total ? Math.round((progress.scanned / progress.total) * 100) : 0

  return (
    <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl mt-6 relative z-10">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              ></path>
            </svg>
          </div>
          {t.components.libraryHealth.title}
        </h3>
        <button
          onClick={runScan}
          disabled={isScanning}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 cursor-pointer disabled:opacity-50"
        >
          {isScanning ? t.components.libraryHealth.scanning : t.components.libraryHealth.runCheck}
        </button>
      </div>

      {isScanning && progress && (
        <div className="mb-6 bg-gray-50 dark:bg-black/20 p-4 rounded-2xl border border-gray-200 dark:border-white/5">
          <div className="flex justify-between text-sm mb-2 font-medium text-gray-700 dark:text-gray-300">
            <span>{t.components.libraryHealth.verifyChecksums}</span>
            <span>{percent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 truncate font-mono">{progress.currentFile}</p>
        </div>
      )}

      {hasScanned && !isScanning && issues.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-2xl text-green-700 dark:text-green-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            ></path>
          </svg>
          <span className="font-bold">{t.components.libraryHealth.healthy}</span>
        </div>
      )}

      {issues.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="px-4 py-2 bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 font-bold rounded-xl text-sm border border-red-200 dark:border-red-500/30 flex items-center justify-between">
            <span>
              {t('components.libraryHealth.corruptedFiles', { issuesLength: issues.length })}
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-2">
            {issues.map((issue) => (
              <div
                key={issue.lectureId}
                className="p-4 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex-1 truncate">
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate">
                    {issue.fileName}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {issue.courseTitle} <span className="opacity-50">/</span> {issue.chapterTitle}
                  </p>
                  <p className="text-xs font-mono mt-1 text-red-500">
                    {t('components.libraryHealth.reason', {
                      reason: issue.status.replace('_', ' ').toUpperCase()
                    })}
                  </p>
                </div>

                {issue.status === 'archived_corrupted' ? (
                  <button
                    onClick={() => {
                      window.api.invoke('delete-lecture', issue.courseTitle, issue.lectureId)
                      setIssues((prev) => prev.filter((i) => i.lectureId !== issue.lectureId))
                    }}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg text-sm shadow-md cursor-pointer shrink-0"
                  >
                    {t.components.libraryHealth.delete}
                  </button>
                ) : (
                  <button
                    onClick={() => handleRepair(issue)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-sm shadow-md cursor-pointer shrink-0"
                  >
                    {t.components.libraryHealth.autoRepair}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
