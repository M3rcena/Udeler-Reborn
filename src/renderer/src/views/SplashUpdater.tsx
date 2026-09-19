import type { UpdatePhase, UpdaterStatusPayload } from '@shared/types'
import React, { useEffect, useState } from 'react'
import { BrandLogo } from '../components/brand/BrandLogo'
import { useI18n } from '../contexts/I18nContext'

export type AppTheme = 'violet' | 'midnight' | 'cyberpunk' | 'light'

interface SplashUpdaterProps {
    onLaunchMainApp?: () => void
}

export const SplashUpdater: React.FC<SplashUpdaterProps> = ({ onLaunchMainApp }) => {
    const { t, currentLocale, setLocale, availableLocales } = useI18n()
    const [phase, setPhase] = useState<UpdatePhase>('checking')
    const [percentage, setPercentage] = useState<number>(0)
    const [speed, setSpeed] = useState<string>('0 MB/s')
    const [version, setVersion] = useState<string>('4.0.0')
    const [theme, setTheme] = useState<AppTheme>('violet')

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    // IPC listener for real backend updates
    useEffect(() => {
        if (!window.api?.onUpdaterStatus) return

        const unsubscribe = window.api.onUpdaterStatus((payload: UpdaterStatusPayload) => {
            setPhase(payload.phase)
            if (payload.version) setVersion(payload.version)

            if (payload.progress) {
                setPercentage(payload.progress.percent)
                const mbps = (payload.progress.bytesPerSecond / (1024 * 1024)).toFixed(1)
                setSpeed(`${mbps} MB/s`)
            }

            if (payload.phase === 'not-available' || payload.phase === 'error') {
                const timer = setTimeout(() => {
                    if (onLaunchMainApp) onLaunchMainApp()
                }, 1200)
                return () => clearTimeout(timer)
            }

            return undefined
        })

        return () => unsubscribe()
    }, [onLaunchMainApp])

    const getStatusText = (): React.ReactNode => {
        switch (phase) {
            case 'checking':
                return t('splash.checking')
            case 'available':
                return t('splash.available', { version })
            case 'not-available':
                return t('splash.upToDate')
            case 'downloading':
                return t('splash.downloading', { version })
            case 'verifying':
                return t('splash.verifying')
            case 'ready':
                return t('splash.ready')
            case 'error':
                return t('splash.error')
        }
    }

    const cycleLocale = (): void => {
        const nextIdx = (availableLocales.findIndex((l) => l.code === currentLocale) + 1) % availableLocales.length
        setLocale(availableLocales[nextIdx].code)
    }

    return (
        <div className="relative flex h-screen w-full items-center justify-center bg-transparent select-none">
            <div className="window-drag relative flex h-full w-full flex-col justify-between overflow-hidden rounded-[32px] border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 shadow-2xl backdrop-blur-2xl transition-all duration-500">

                {/* Ambient Glows */}
                <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-56 w-72 rounded-full bg-[var(--accent-from)]/20 blur-[80px] transition-all duration-700" />
                <div className="pointer-events-none absolute -bottom-24 left-1/2 -translate-x-1/2 h-56 w-72 rounded-full bg-[var(--accent-to)]/15 blur-[80px] transition-all duration-700" />

                {/* Top Controls: Locale & Theme */}
                <div className="window-no-drag absolute top-5 right-6 z-30 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={cycleLocale}
                        className="cursor-pointer rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-colors backdrop-blur-md"
                    >
                        {currentLocale === 'EnglishUS' ? 'EN' : 'GR'}
                    </button>

                    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 backdrop-blur-md">
                        {(['violet', 'midnight', 'cyberpunk', 'light'] as AppTheme[]).map((thm) => (
                            <button
                                key={thm}
                                type="button"
                                onClick={() => setTheme(thm)}
                                className={`h-3 w-3 cursor-pointer rounded-full transition-all ${theme === thm
                                        ? 'scale-125 ring-2 ring-white/70 ring-offset-1 ring-offset-black/40'
                                        : 'opacity-40 hover:opacity-90'
                                    }`}
                                style={{
                                    backgroundColor:
                                        thm === 'violet'
                                            ? '#9333ea'
                                            : thm === 'midnight'
                                                ? '#0284c7'
                                                : thm === 'cyberpunk'
                                                    ? '#ff007f'
                                                    : '#f8fafc'
                                }}
                            />
                        ))}
                    </div>
                </div>

                {/* Center Logo & Title */}
                <div className="relative z-10 my-auto flex flex-col items-center text-center">
                    <div className="relative mb-3 flex items-center justify-center">
                        <div className="absolute h-24 w-24 rounded-full bg-gradient-to-tr from-[var(--accent-from)] to-[var(--accent-to)] opacity-25 blur-2xl animate-pulse" />
                        <BrandLogo className="h-24 w-24 drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]" />
                    </div>

                    <div className="flex flex-col items-center">
                        <h1 className="text-2xl font-black tracking-wider text-[var(--text-primary)]">
                            {t.splash.title}{' '}
                            <span className="bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-clip-text text-transparent">
                                {t.splash.subtitle}
                            </span>
                        </h1>
                        <span className="mt-1.5 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-0.5 text-[10px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                            {t.splash.tagline}
                        </span>
                    </div>
                </div>

                {/* Bottom Progress Bar & Text */}
                <div className="window-no-drag relative z-10 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between px-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent-from)] opacity-75" />
                                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent-from)]" />
                            </span>
                            {getStatusText()}
                        </span>
                        {phase === 'downloading' && (
                            <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">
                                {percentage}% <span className="font-normal text-[var(--text-secondary)]">({speed})</span>
                            </span>
                        )}
                    </div>

                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/40 p-0.5 shadow-inner">
                        {phase === 'checking' && (
                            <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] animate-[indeterminate_1.5s_infinite_linear]" />
                        )}
                        {(phase === 'downloading' || phase === 'verifying' || phase === 'ready') && (
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] transition-all duration-200 ease-out shadow-[0_0_14px_var(--border-highlight)]"
                                style={{ width: `${percentage}%` }}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}