import { appVersion } from '@renderer/version'
import React, { useEffect, useState } from 'react'
import { SimpleMarkdown } from './SimpleMarkdown'

export const WhatsNewModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [releaseTitle, setReleaseTitle] = useState('')
  const [releaseBody, setReleaseBody] = useState('')

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
              setReleaseTitle(data.name || data.tag_name || appVersion)
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
      <div className="relative w-full max-w-2xl bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200/60 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 backdrop-blur-xl">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">
              {releaseTitle || `Udeler Reborn ${appVersion}`}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Here is what changed in this update
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-full transition-colors cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content matching GitHub release styling */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white dark:bg-[#0b0b14]/50">
          <SimpleMarkdown content={releaseBody} />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200/60 dark:border-white/10 flex justify-end bg-gray-50/50 dark:bg-white/5">
          <button
            onClick={() => setIsOpen(false)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
