import { appVersion } from '@renderer/version'
import { useEffect, useState } from 'react'

export const UpdateToast: React.FC = () => {
  const [isVisible, setIsVisible] = useState<boolean>(false)
  const [toastType, setToastType] = useState<'update' | 'unreleased'>('update')
  const [latestVersion, setLatestVersion] = useState<string>('')
  const [releaseUrl, setReleaseUrl] = useState<string>('')

  useEffect(() => {
    const silentlyCheckUpdate = async (): Promise<void> => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest'
        )
        if (!response.ok) return

        const data = await response.json()
        const fetchedVersion = data.tag_name

        let shouldShow = false

        // Check if GitHub has a newer version
        if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) > 0) {
          setToastType('update')
          setLatestVersion(fetchedVersion)
          setReleaseUrl(data.html_url)
          shouldShow = true
        }
        // Check if we are running an unreleased future build
        else if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) < 0) {
          setToastType('unreleased')
          shouldShow = true
        }

        if (shouldShow) {
          setIsVisible(true)

          // Auto-hide the toast after exactly 10 seconds
          setTimeout(() => {
            setIsVisible(false)
          }, 10000)
        }
      } catch (error) {
        console.error('Silent startup update check failed:', error)
      }
    }

    // Wait 2 seconds after the app opens before checking, so it doesn't interrupt the initial load
    const bootDelay = setTimeout(silentlyCheckUpdate, 2000)

    return () => clearTimeout(bootDelay)
  }, [])

  const handleOpenRelease = (): void => {
    if (releaseUrl) {
      window.open(releaseUrl, '_blank')
    }
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-6 right-6 z-100 animate-in slide-in-from-bottom-8 fade-in duration-500">
      {toastType === 'update' ? (
        // --- NEW UPDATE AVAILABLE TOAST ---
        <div
          onClick={handleOpenRelease}
          className="group flex items-start gap-4 p-4 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur-xl border border-blue-200 dark:border-blue-500/30 rounded-2xl shadow-2xl hover:shadow-blue-500/20 cursor-pointer transition-all hover:-translate-y-1 w-80"
        >
          <div className="shrink-0 w-10 h-10 bg-linear-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white shadow-inner">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              ></path>
            </svg>
          </div>
          <div className="flex-1 pt-0.5">
            <h4 className="text-gray-900 dark:text-white font-bold text-sm">Update Available</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              Udeler Reborn{' '}
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {latestVersion}
              </span>{' '}
              is ready. Click to download.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation() // Prevents clicking the X from opening the URL
              setIsVisible(false)
            }}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      ) : (
        // --- UNRELEASED BUILD TOAST ---
        <div className="flex items-start gap-4 p-4 bg-white/90 dark:bg-[#12121a]/95 backdrop-blur-xl border border-amber-200 dark:border-amber-500/30 rounded-2xl shadow-2xl w-80">
          <div className="shrink-0 w-10 h-10 bg-amber-100 dark:bg-amber-500/20 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-500 shadow-inner">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          </div>
          <div className="flex-1 pt-0.5">
            <h4 className="text-gray-900 dark:text-white font-bold text-sm">Developer Build</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              You are running an unreleased version. Expect potential bugs.
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
              ></path>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
