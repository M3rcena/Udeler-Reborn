import { appVersion } from '@renderer/version'
import { useEffect, useState } from 'react'

export const UpdateToast: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const [toastType, setToastType] = useState<'update' | 'unreleased'>('update')
  const [latestVersion, setLatestVersion] = useState<string>('')
  const [releaseUrl, setReleaseUrl] = useState<string>('')
  const [releaseNotes, setReleaseNotes] = useState<string>('')
  const [showNotesModal, setShowNotesModal] = useState<boolean>(false)

  useEffect(() => {
    const silentlyCheckUpdate = async (): Promise<void> => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest'
        )
        if (!response.ok) return

        const data = await response.json()
        const fetchedVersion = data.tag_name

        if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) > 0) {
          setToastType('update')
          setLatestVersion(fetchedVersion)
          setReleaseUrl(data.html_url)
          setReleaseNotes(data.body || '')
          setIsVisible(true)
        } else if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) < 0) {
          setToastType('unreleased')
          setIsVisible(true)
        }
      } catch (error) {
        console.error('Silent startup update check failed:', error)
      }
    }

    const bootDelay = setTimeout(silentlyCheckUpdate, 2000)

    return () => clearTimeout(bootDelay)
  }, [])

  if (!isVisible) return null

  return (
    <>
      <div className="fixed bottom-6 right-6 z-100 animate-in slide-in-from-bottom-8 fade-in duration-500">
        {toastType === 'update' ? (
          <div className="group flex flex-col gap-3 p-4 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur-xl border border-blue-200 dark:border-blue-500/30 rounded-2xl shadow-2xl w-88 transition-all">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 bg-linear-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-inner">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </div>
              <div className="flex-1 pt-0.5">
                <h4 className="text-gray-900 dark:text-white font-bold text-sm">
                  Update Available
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  Udeler Reborn{' '}
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {latestVersion}
                  </span>{' '}
                  is ready!
                </p>
              </div>
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => window.open(releaseUrl, '_blank')}
                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer text-center"
              >
                Download
              </button>
              {releaseNotes && (
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  What&apos;s New
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 p-4 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur-xl border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-2xl w-80">
            <div className="shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-inner">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1 pt-0.5">
              <h4 className="text-gray-900 dark:text-white font-bold text-sm">Developer Build</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                You are running an unreleased version.
              </p>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {showNotesModal && (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotesModal(false)
          }}
        >
          <div className="w-full max-w-lg p-6 bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                What&apos;s New in {latestVersion}
              </h3>
              <button
                onClick={() => setShowNotesModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 bg-gray-50 dark:bg-black/30 border border-gray-100 dark:border-white/5 rounded-2xl text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {releaseNotes}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  window.open(releaseUrl, '_blank')
                  setShowNotesModal(false)
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Go to Release
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
