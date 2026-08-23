import { useI18n } from '@renderer/contexts/I18nContext'
import { appVersion } from '@renderer/version'
import { useEffect, useState } from 'react'
import { SimpleMarkdown } from './SimpleMarkdown'

export const UpdateToast: React.FC = () => {
  const { t } = useI18n()

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
                  {t.update.updateAvailable}
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  {t('update.newVersion', {
                    version: (
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {latestVersion}
                      </span>
                    )
                  })}
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
                {t.update.download}
              </button>
              {releaseNotes && (
                <button
                  onClick={() => setShowNotesModal(true)}
                  className="py-2 px-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-800 dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {t.update.whatsNew}
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
              <h4 className="text-gray-900 dark:text-white font-bold text-sm">
                {t.update.devBuild}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                {t.update.unreleasedVer}
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
          className="fixed inset-0 z-110 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowNotesModal(false)
          }}
        >
          <div className="relative w-full max-w-2xl bg-white/95 dark:bg-[#0f0f18]/95 rounded-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowNotesModal(false)}
              className="absolute top-5 right-5 z-20 p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full bg-gray-100/60 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 backdrop-blur-md transition-all cursor-pointer shadow-sm"
              title="Close"
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

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 sm:p-10 flex flex-col justify-between gap-8">
              <div>
                <SimpleMarkdown content={releaseNotes} />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    window.open(releaseUrl, '_blank')
                    setShowNotesModal(false)
                  }}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
                >
                  {t.update.goToRelease}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
