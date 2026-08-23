import { useDownload } from '@renderer/contexts/DownloadContext'
import { useI18n } from '@renderer/contexts/I18nContext'
import React, { useRef, useState } from 'react'

export const GlobalDownloadWidget: React.FC = () => {
  const {
    activeDownloads,
    downloadPercentages,
    queueCount,
    queueStatus,
    pauseQueue,
    resumeQueue,
    cancelQueue,
    downloadSpeeds
  } = useDownload()
  const { t } = useI18n()

  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = (): void => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current)
    setIsHovered(true)
  }

  const handleMouseLeave = (): void => {
    hoverTimeout.current = setTimeout(() => {
      setIsHovered(false)
    }, 150)
  }

  const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '0 KB/s'
    if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
    return `${Math.round(bytesPerSec / 1024)} KB/s`
  }

  const activeKeys = Object.keys(activeDownloads)
  const totalItems = activeKeys.length + queueCount

  if (totalItems === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-100 flex flex-col items-end"
      onMouseLeave={handleMouseLeave}
    >
      {/* --- EXPANDED PANEL --- */}
      <div
        onMouseEnter={handleMouseEnter}
        className={`absolute bottom-18 right-0 w-85 bg-white/80 dark:bg-[#0b0b14]/90 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl origin-bottom-right transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.15)] flex flex-col overflow-hidden
        ${
          isHovered
            ? 'scale-100 opacity-100 pointer-events-auto translate-y-0'
            : 'scale-75 opacity-0 pointer-events-none translate-y-4'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200/50 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {t.globalDownloads.active}
            </h3>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/20 px-2.5 py-1 rounded-lg">
            {t('globalDownloads.queued', { queueCount })}
          </span>
        </div>

        {/* Active Downloads List */}
        <div className="p-3 max-h-80 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          {activeKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <svg
                className="w-10 h-10 mb-3 opacity-20"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                ></path>
              </svg>
              <p className="text-xs font-medium">{t.globalDownloads.processing}</p>
            </div>
          ) : (
            activeKeys.map((idStr) => {
              const id = parseInt(idStr)
              const info = activeDownloads[id]
              const percent = downloadPercentages?.[id] || 0
              const speed = downloadSpeeds?.[id] || 0

              return (
                <div
                  key={id}
                  className="relative p-3.5 bg-white dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white truncate pr-4">
                      {info.title}
                    </p>
                    <span className="text-[10px] font-bold text-blue-500 tabular-nums">
                      {percent}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-medium max-w-[70%]">
                      {info.courseTitle}
                    </p>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">
                      {formatSpeed(speed)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-100 dark:bg-black/50 rounded-full h-1.5 overflow-hidden shadow-inner">
                    <div
                      className="bg-linear-to-r from-blue-600 to-blue-400 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Action Controls */}
        {queueCount > 0 && (
          <div className="p-3 border-t border-gray-200/50 dark:border-white/5 flex gap-2 bg-gray-50/50 dark:bg-white/5">
            {queueStatus === 'running' ? (
              <button
                onClick={pauseQueue}
                className="flex-1 text-xs py-2 font-bold bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 hover:bg-yellow-500/20 rounded-xl transition-all cursor-pointer"
              >
                {t.globalDownloads.pause}
              </button>
            ) : (
              <button
                onClick={resumeQueue}
                className="flex-1 text-xs py-2 font-bold bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 rounded-xl transition-all cursor-pointer"
              >
                {t.globalDownloads.resume}
              </button>
            )}
            <button
              onClick={cancelQueue}
              className="flex-1 text-xs py-2 font-bold bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl transition-all cursor-pointer"
            >
              {t.globalDownloads.stopAll}
            </button>
          </div>
        )}
      </div>

      {/* --- FLOATING CIRCLE BUTTON --- */}
      <button
        onMouseEnter={handleMouseEnter}
        className={`w-14 h-14 bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-gray-200/50 dark:border-white/10 text-gray-800 dark:text-white rounded-full shadow-lg hover:bg-white/20 dark:hover:bg-white/10 flex items-center justify-center transition-all duration-300 cursor-pointer relative z-10 
        ${isHovered ? 'scale-105 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'scale-100'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          ></path>
        </svg>

        {/* Dynamic Notification Badge */}
        {totalItems > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white border-2 border-white dark:border-[#0b0b14] animate-in zoom-in duration-200">
            {totalItems > 99 ? '99+' : totalItems}
          </span>
        )}
      </button>
    </div>
  )
}
