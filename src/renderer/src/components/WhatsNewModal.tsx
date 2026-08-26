import { useI18n } from '@renderer/contexts/I18nContext'
import { appVersion } from '@renderer/version'
import React, { useEffect, useState } from 'react'
import { SimpleMarkdown } from './SimpleMarkdown'

export const WhatsNewModal: React.FC = () => {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [releaseBody, setReleaseBody] = useState<string>('')

  useEffect(() => {
    const checkFirstLaunchAfterUpdate = async (): Promise<void> => {
      try {
        const lastSeenVersion = (await window.api.invoke('store-get', 'last_seen_version')) as
          string | undefined

        if (lastSeenVersion !== appVersion) {
          await window.api.invoke('store-set', 'last_seen_version', appVersion)

          if (lastSeenVersion) {
            const response = await fetch(
              'https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest'
            )
            if (response.ok) {
              const data = await response.json()
              setReleaseBody(data.body || '')
              setIsOpen(true)
            }
          }
        }
      } catch (err) {
        console.error('Failed to check post-update changelog:', err)
      }
    }

    checkFirstLaunchAfterUpdate()
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-120 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsOpen(false)
      }}
    >
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-[#0f0f18]/95 rounded-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        <button
          onClick={() => setIsOpen(false)}
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
            <SimpleMarkdown content={releaseBody} />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setIsOpen(false)}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
            >
              {t.components.pathAlert.gotIt}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
