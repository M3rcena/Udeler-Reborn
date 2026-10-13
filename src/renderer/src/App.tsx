import type { CourseItem, PlatformId, PlatformSession } from '@shared/types'
import React, { useEffect, useState } from 'react'
import { useI18n } from './contexts/I18nContext'
import { isUnreleasedVersion } from './version'
import { PlatformDashboardView } from './views/PlatformDashboardView'
import { PlatformSelectView } from './views/PlatformSelectView'
import { SplashUpdater } from './views/SplashUpdater'

export default function App(): React.JSX.Element {
  const isMainView = new URLSearchParams(window.location.search).get('view') === 'main'
  const [stage] = useState<'splash' | 'main'>(isMainView ? 'main' : 'splash')
  const [selectedSession, setSelectedSession] = useState<PlatformSession | null>(null)

  const { t } = useI18n()
  const [showDevToast, setShowDevToast] = useState<boolean>(false)
  const [devVersion, setDevVersion] = useState<string>('')
  const [releasedVersion, setReleasedVersion] = useState<string>('')

  useEffect(() => {
    if (stage !== 'main') return

    const checkDevBuild = async (): Promise<void> => {
      try {
        const verInfo = window.api?.getAppVersion ? await window.api.getAppVersion() : null
        const current = verInfo?.version || '4.0.0-dev.1.0'
        setDevVersion(current)

        let latestTag = 'v3.3.1'
        try {
          const res = await fetch('https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest', {
            headers: { Accept: 'application/vnd.github.v3+json' }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.tag_name) {
              latestTag = data.tag_name
            }
          }
        } catch {
          // Offline fallback
        }

        setReleasedVersion(latestTag)

        if (isUnreleasedVersion(current, latestTag)) {
          setShowDevToast(true)
        }
      } catch (err) {
        console.error('Failed to verify dev build status:', err)
      }
    }

    checkDevBuild()
  }, [stage])

  // Auto-dismiss toast after 10 seconds
  useEffect(() => {
    if (!showDevToast) return
    const timer = setTimeout(() => {
      setShowDevToast(false)
    }, 10000)
    return () => clearTimeout(timer)
  }, [showDevToast])

  if (stage === 'splash') {
    return (
      <SplashUpdater
        onLaunchMainApp={() => {
          window.api?.resizeToMain?.()
        }}
      />
    )
  }

  return (
    <>
      {selectedSession ? (
        <PlatformDashboardView
          session={selectedSession}
          onBackToPlatforms={() => setSelectedSession(null)}
          onSelectCourse={(course: CourseItem) => {
            console.log('Open course curriculum drawer:', course)
          }}
        />
      ) : (
        <PlatformSelectView
          onSelectPlatform={async (platformId: PlatformId) => {
            const sessions = await window.api.getSessions()
            const match = sessions.find((s) => s.platformId === platformId)
            if (match) {
              setSelectedSession(match)
            }
          }}
        />
      )}

      {/* UNRELEASED / DEV BUILD STARTUP TOAST */}
      {showDevToast && (
        <div className="fixed bottom-6 right-6 z-50 flex max-w-md items-start gap-3.5 rounded-2xl border border-amber-500/40 bg-[var(--bg-surface)] p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-amber-400 uppercase tracking-wide">
                {t('about.unreleasedBuild')}
              </h4>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.2 font-mono text-[9px] font-bold text-amber-300">
                v{devVersion}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {t('about.unreleasedWarning', {
                version: devVersion,
                releasedVersion: releasedVersion
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowDevToast(false)}
            className="cursor-pointer text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors p-1"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}