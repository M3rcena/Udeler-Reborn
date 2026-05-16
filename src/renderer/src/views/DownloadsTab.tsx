import { useDownload } from '@renderer/contexts/DownloadContext'
import { DownloadedFile } from '@renderer/types'
import { useEffect, useMemo, useState } from 'react'

export const DownloadsTab: React.FC = () => {
  const { downloadProgress, queueStatus, pauseQueue, resumeQueue, cancelQueue } = useDownload()

  const [downloadedFiles, setDownloadedFiles] = useState<DownloadedFile[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [selectedMedia, setSelectedMedia] = useState<DownloadedFile | null>(null)

  // --- CALCULATE LIVE STATS ---
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

  // Scan disk on load
  useEffect(() => {
    const fetchFiles = async (): Promise<void> => {
      setIsScanning(true)
      try {
        const files = await window.api.getAllDownloads()
        setDownloadedFiles(files)
      } catch (err) {
        console.error('Failed to scan downloads', err)
      } finally {
        setIsScanning(false)
      }
    }
    fetchFiles()
  }, [])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto pb-10 flex flex-col h-full relative z-10">
      {/* HEADER & QUEUE STATUS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            Queue & Library
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
            Monitor active downloads and play saved media.
          </p>
        </div>

        {/* Global Queue Status Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm font-semibold text-sm ${
            queueStatus === 'running'
              ? 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400'
              : queueStatus === 'paused'
                ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
                : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400'
          }`}
        >
          <div
            className={`w-2 h-2 rounded-full ${
              queueStatus === 'running'
                ? 'bg-blue-500 animate-pulse'
                : queueStatus === 'paused'
                  ? 'bg-yellow-500'
                  : 'bg-gray-400'
            }`}
          ></div>
          Queue: {queueStatus.charAt(0).toUpperCase() + queueStatus.slice(1)}
        </div>
      </div>

      <div className="flex flex-col gap-6 flex-1">
        {/* --- GLOBAL CONTROLS --- */}
        <div className="p-6 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-2xl text-white shadow-lg">
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
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 font-bold rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                queueStatus === 'paused'
                  ? 'bg-green-600 hover:bg-green-500 text-white shadow-green-500/30'
                  : 'bg-yellow-500 hover:bg-yellow-400 text-white shadow-yellow-500/30'
              }`}
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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
              </svg>
              Stop All
            </button>
          </div>
        </div>

        {/* --- LIVE STATISTICS GRID --- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-blue-200 dark:border-blue-500/20 rounded-[2rem] shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">In Progress</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.downloading}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-green-200 dark:border-green-500/20 rounded-[2rem] shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">Completed</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.success}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-red-200 dark:border-red-500/20 rounded-[2rem] shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">Failed</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.error}</p>
          </div>
          <div className="p-6 bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl">
            <h3 className="font-bold text-gray-600 dark:text-gray-300 mb-2">DRM Locked</h3>
            <p className="text-4xl font-black text-gray-900 dark:text-white">{stats.drm}</p>
          </div>
        </div>

        {/* --- LOCAL LIBRARY LIST --- */}
        <div className="flex-1 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl p-8 flex flex-col overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Downloaded Files</h3>
            <button
              onClick={async () => {
                setIsScanning(true)
                const files = await window.api.getAllDownloads()
                setDownloadedFiles(files)
                setIsScanning(false)
              }}
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 font-semibold cursor-pointer flex items-center gap-2"
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
              </svg>
              Refresh Disk
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
            {isScanning ? (
              <div className="flex items-center justify-center h-40 text-gray-500">
                Scanning local disk...
              </div>
            ) : downloadedFiles.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-gray-500">
                No downloaded files found in your settings path.
              </div>
            ) : (
              downloadedFiles.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-white dark:bg-black/20 border border-gray-100 dark:border-white/5 rounded-xl hover:border-blue-500/30 transition-all group"
                >
                  <div className="flex items-center gap-4 truncate">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
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
                    <div className="truncate">
                      <p className="text-gray-900 dark:text-white font-bold text-sm truncate">
                        {item.file}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.course} / {item.chapter}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedMedia(item)}
                    className="flex-shrink-0 ml-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-sm transition-all shadow-md cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    {item.type === 'Video' ? 'Play Video' : 'Read Content'}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* --- INTERNAL MEDIA PLAYER MODAL --- */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedMedia(null)
          }}
        >
          <div className="relative w-full max-w-6xl aspect-video bg-black rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden flex flex-col">
            {/* Player Toolbar (ALWAYS VISIBLE NOW) */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-center">
              <h3 className="text-white font-bold truncate pr-4 drop-shadow-md">
                {selectedMedia.file}
              </h3>
              <button
                onClick={() => setSelectedMedia(null)}
                className="p-2 bg-white/20 hover:bg-red-500 rounded-full text-white transition-colors cursor-pointer backdrop-blur-md"
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

            {/* The Actual Player (Safely URI Encoded!) */}
            <div className="flex-1 bg-black flex items-center justify-center">
              {selectedMedia.type === 'Video' ? (
                <video
                  src={`local://${encodeURIComponent(selectedMedia.path)}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  src={`local://${encodeURIComponent(selectedMedia.path)}`}
                  className="w-full h-full bg-white rounded-xl m-4 mt-16"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
