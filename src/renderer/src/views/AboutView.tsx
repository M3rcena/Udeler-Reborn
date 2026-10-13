import type { AppVersionInfo, LogEntry, LogLevel, UpdaterStatusPayload } from '@shared/types'
import React, { useEffect, useRef, useState } from 'react'
import { BrandLogo } from '../components/brand/BrandLogo'
import { useI18n } from '../contexts/I18nContext'
import { compareSemver, isUnreleasedVersion } from '../version'

type AboutSubtab = 'overview' | 'logs'
type FilterLevel = 'ALL' | LogLevel

interface GitHubReleaseData {
    tag_name: string
    name: string
    published_at: string
    html_url: string
}

export const AboutView: React.FC = () => {
    const { t } = useI18n()

    // Subtab navigation
    const [activeSubtab, setActiveSubtab] = useState<AboutSubtab>('overview')

    // Diagnostics & system info
    const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null)

    // Updater state
    const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatusPayload | null>(null)
    const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false)
    const [githubRelease, setGithubRelease] = useState<GitHubReleaseData | null>(null)

    // Logs state
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [logFilter, setLogFilter] = useState<FilterLevel>('ALL')
    const [logSearch, setLogSearch] = useState<string>('')
    const [autoScroll, setAutoScroll] = useState<boolean>(true)
    const [expandedLogIdx, setExpandedLogIdx] = useState<number | null>(null)
    const [isExporting, setIsExporting] = useState<boolean>(false)
    const [toastMessage, setToastMessage] = useState<string | null>(null)

    // Easter egg
    const [easterEggClicks, setEasterEggClicks] = useState<number>(0)
    const [easterEggTriggered, setEasterEggTriggered] = useState<boolean>(false)

    const logContainerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        fetchSystemInfo()
        loadLogs()
        checkGitHubLatest()

        let unsubscribeUpdater: (() => void) | undefined
        if (window.api?.onUpdaterStatus) {
            unsubscribeUpdater = window.api.onUpdaterStatus((status) => {
                setUpdaterStatus(status)
                if (status.phase !== 'checking') {
                    setIsCheckingUpdate(false)
                }
            })
        }

        return () => {
            if (unsubscribeUpdater) unsubscribeUpdater()
        }
    }, [])

    // Refresh logs periodically when on logs tab
    useEffect(() => {
        if (activeSubtab !== 'logs') return

        loadLogs()
        const timer = setInterval(() => {
            loadLogs()
        }, 2500)

        return () => clearInterval(timer)
    }, [activeSubtab])

    // Auto-scroll logs to bottom if enabled
    useEffect(() => {
        if (activeSubtab === 'logs' && autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
    }, [logs, activeSubtab, autoScroll])

    const fetchSystemInfo = async (): Promise<void> => {
        if (window.api?.getAppVersion) {
            const info = await window.api.getAppVersion()
            setVersionInfo(info)
        }
    }

    const loadLogs = async (): Promise<void> => {
        if (window.api?.getLogs) {
            try {
                const recentLogs = await window.api.getLogs()
                setLogs(recentLogs || [])
            } catch (err) {
                console.error('Failed to load recent logs:', err)
            }
        }
    }

    const checkGitHubLatest = async (): Promise<void> => {
        try {
            const res = await fetch('https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest', {
                headers: { Accept: 'application/vnd.github.v3+json' }
            })
            if (res.ok) {
                const data: GitHubReleaseData = await res.json()
                setGithubRelease(data)
            }
        } catch {
            // Silently fail if offline or rate-limited
        }
    }

    const handleCheckUpdate = async (): Promise<void> => {
        setIsCheckingUpdate(true)
        try {
            if (window.api?.checkUpdates) {
                await window.api.checkUpdates()
            }
            await checkGitHubLatest()
        } catch (err) {
            console.error('Manual update check error:', err)
        } finally {
            setTimeout(() => {
                setIsCheckingUpdate(false)
            }, 1600)
        }
    }

    const handleClearLogs = async (): Promise<void> => {
        if (window.api?.clearLogs) {
            try {
                await window.api.clearLogs()
                setLogs([])
                showToast('Logs buffer cleared.')
            } catch (err) {
                console.error('Failed to clear logs:', err)
            }
        }
    }

    const handleExportLogs = async (): Promise<void> => {
        if (!window.api?.exportDebugLogs) return
        setIsExporting(true)
        try {
            const saved = await window.api.exportDebugLogs()
            if (saved) {
                showToast('Diagnostic log file exported successfully!')
            }
        } catch (err) {
            console.error('Failed to export logs:', err)
        } finally {
            setIsExporting(false)
        }
    }

    const handleCopyAllLogs = async (): Promise<void> => {
        if (filteredLogs.length === 0) return
        const logContent = filteredLogs
            .map(
                (l) =>
                    `[${l.timestamp}] [${l.level}] [${l.subsystem}] ${l.message}${l.context ? `\nContext: ${JSON.stringify(l.context, null, 2)}` : ''
                    }`
            )
            .join('\n')

        try {
            await navigator.clipboard.writeText(logContent)
            showToast(`${filteredLogs.length} log entries copied to clipboard!`)
        } catch (err) {
            console.error('Failed to copy logs:', err)
        }
    }

    const showToast = (msg: string): void => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3500)
    }

    const handleLogoClick = (): void => {
        const next = easterEggClicks + 1
        setEasterEggClicks(next)
        if (next >= 5 && !easterEggTriggered) {
            setEasterEggTriggered(true)
            showToast('🚀 Hyperdrive diagnostics unlocked! Thank you for supporting Udeler Reborn.')
        }
    }

    // Filter and search logs
    const filteredLogs = logs.filter((log) => {
        if (logFilter !== 'ALL' && log.level !== logFilter) {
            return false
        }
        if (!logSearch.trim()) return true
        const query = logSearch.toLowerCase()
        const matchesMsg = log.message.toLowerCase().includes(query)
        const matchesSubsystem = log.subsystem.toLowerCase().includes(query)
        const matchesLevel = log.level.toLowerCase().includes(query)
        return matchesMsg || matchesSubsystem || matchesLevel
    })

    const logCounts = {
        ALL: logs.length,
        ERROR: logs.filter((l) => l.level === 'ERROR').length,
        WARN: logs.filter((l) => l.level === 'WARN').length,
        INFO: logs.filter((l) => l.level === 'INFO').length,
        DEBUG: logs.filter((l) => l.level === 'DEBUG').length
    }

    // Determine update state
    const currentVer = versionInfo?.version || '4.0.0-dev.1.0'
    const isUpdateAvailable =
        updaterStatus?.phase === 'available' ||
        (Boolean(githubRelease?.tag_name) &&
            compareSemver(githubRelease!.tag_name, currentVer) > 0 &&
            !currentVer.includes('dev'))
    const isHigherVersion = isUnreleasedVersion(currentVer, githubRelease?.tag_name)

    return (
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
            {/* TOAST NOTIFICATION FLOATER */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-[var(--border-highlight)] bg-[var(--bg-surface)] px-4 py-3 text-xs font-bold text-[var(--text-primary)] shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
                {/* 1. TOP HEADER & SUBTAB SELECTOR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-inner">
                            <BrandLogo className="h-7 w-7" onClick={handleLogoClick} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black tracking-wide text-[var(--text-primary)] uppercase">
                                    {t('about.title')}
                                </h2>
                                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                                    v{currentVer}
                                </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                                {t('about.tagline')}
                            </p>
                        </div>
                    </div>

                    {/* SUBTAB PILL MATRIX */}
                    <div className="flex items-center gap-1.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setActiveSubtab('overview')}
                            className={`cursor-pointer flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${activeSubtab === 'overview'
                                ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-md shadow-[var(--accent-from)]/20'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                                }`}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{t('about.overviewTab')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveSubtab('logs')}
                            className={`cursor-pointer flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${activeSubtab === 'logs'
                                ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-md shadow-[var(--accent-from)]/20'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                                }`}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>{t('about.logsTab')}</span>
                            {logs.length > 0 && (
                                <span className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] font-extrabold ${logCounts.ERROR > 0
                                    ? 'bg-rose-500 text-white'
                                    : activeSubtab === 'logs'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-white/10 text-[var(--text-secondary)]'
                                    }`}>
                                    {logs.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* 2. MAIN SUBTAB CONTENT */}
                {activeSubtab === 'overview' ? (
                    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                        {/* HERO IDENTITY BANNER */}
                        <div className="relative overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 sm:p-8 shadow-2xl backdrop-blur-2xl">
                            {/* Ambient Glows */}
                            <div className="pointer-events-none absolute -top-16 -left-16 h-64 w-64 rounded-full bg-gradient-to-tr from-[var(--accent-from)] to-transparent opacity-20 blur-3xl" />
                            <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-gradient-to-br from-[var(--accent-to)] to-transparent opacity-15 blur-3xl" />

                            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
                                <div className="relative group shrink-0">
                                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[var(--accent-from)] to-[var(--accent-to)] opacity-25 blur-xl group-hover:opacity-40 transition-opacity" />
                                    <BrandLogo
                                        className={`h-24 w-24 drop-shadow-2xl cursor-pointer transition-transform duration-500 ${easterEggTriggered ? 'animate-spin' : 'hover:scale-110 active:scale-95'
                                            }`}
                                        onClick={handleLogoClick}
                                    />
                                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-emerald-500 text-[10px] font-black text-white shadow-md">
                                        ✓
                                    </span>
                                </div>

                                <div className="flex flex-1 flex-col items-center sm:items-start gap-2">
                                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                                        <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-[var(--text-primary)] uppercase">
                                            UDELER{' '}
                                            <span className="bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-clip-text text-transparent">
                                                REBORN
                                            </span>
                                        </h1>
                                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold flex items-center gap-1.5 border ${isHigherVersion
                                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                            : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                            }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${isHigherVersion ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
                                            v{currentVer} • {isHigherVersion ? t('about.unreleasedBadge') : 'Stable'}
                                        </span>
                                        <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-400">
                                            Zero-Trust IPC
                                        </span>
                                    </div>

                                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-xl leading-relaxed">
                                        {t('about.tagline')}
                                    </p>

                                    <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-[11px] text-[var(--text-secondary)]">
                                        <span className="flex items-center gap-1.5">
                                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-from)]" />
                                            Architected by{' '}
                                            <a
                                                href="https://github.com/M3rcena"
                                                target="_blank"
                                                rel="noreferrer"
                                                className="cursor-pointer font-bold text-[var(--text-primary)] hover:text-[var(--accent-from)] transition-colors"
                                            >
                                                @M3rcena
                                            </a>
                                        </span>
                                        <span>•</span>
                                        <span>Original Creator: Rahul Yadav</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LIVE UPDATE STATUS & RELEASE CARD */}
                        <div className={`rounded-3xl border bg-[var(--bg-surface)] p-5 shadow-xl backdrop-blur-2xl ${isHigherVersion && !isCheckingUpdate
                            ? 'border-amber-500/30'
                            : 'border-[var(--border-color)]'
                            }`}>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${isCheckingUpdate
                                        ? 'border-purple-500/30 bg-purple-500/10 text-purple-400'
                                        : isUpdateAvailable
                                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                                            : isHigherVersion
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                        {isCheckingUpdate ? (
                                            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : isUpdateAvailable ? (
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                                            </svg>
                                        ) : isHigherVersion ? (
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                        ) : (
                                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs font-extrabold ${isHigherVersion && !isCheckingUpdate ? 'text-amber-400' : 'text-[var(--text-primary)]'
                                                }`}>
                                                {isCheckingUpdate
                                                    ? t('about.checkingUpdates')
                                                    : isUpdateAvailable
                                                        ? `${t('about.updateAvailable')}: ${githubRelease?.tag_name || updaterStatus?.version || 'New release'}`
                                                        : isHigherVersion
                                                            ? t('about.unreleasedBuild')
                                                            : t('about.upToDate')}
                                            </span>
                                            {githubRelease && (
                                                <span className={`rounded-md px-2 py-0.5 font-mono text-[9px] ${isHigherVersion
                                                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                                                    : 'bg-white/5 text-[var(--text-secondary)]'
                                                    }`}>
                                                    {isHigherVersion ? `Latest official: ${githubRelease.tag_name}` : `Release tag: ${githubRelease.tag_name}`}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-[var(--text-secondary)] max-w-xl">
                                            {isCheckingUpdate
                                                ? 'Checking for official updates...'
                                                : isUpdateAvailable
                                                    ? 'A newer build is ready for installation from official release servers.'
                                                    : isHigherVersion
                                                        ? t('about.unreleasedWarning', {
                                                            version: currentVer,
                                                            releasedVersion: githubRelease?.tag_name || 'v3.3.1'
                                                        })
                                                        : 'Running the latest validated components for your operating system.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                    {githubRelease?.html_url && (isUpdateAvailable || isHigherVersion) && (
                                        <a
                                            href={isHigherVersion ? 'https://github.com/M3rcena/Udeler-Reborn/releases' : githubRelease.html_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${isHigherVersion
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                                : 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                                                }`}
                                        >
                                            <span>{isHigherVersion ? t('about.viewReleases') : 'View Release'}</span>
                                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    )}

                                    <button
                                        type="button"
                                        disabled={isCheckingUpdate}
                                        onClick={handleCheckUpdate}
                                        className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        <svg className={`h-3.5 w-3.5 ${isCheckingUpdate ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>{isCheckingUpdate ? t('words.loading') : t('about.checkUpdates')}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* COMMUNITY & RESOURCES CARDS */}
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl">
                            <h3 className="text-xs font-black tracking-widest text-[var(--text-secondary)] uppercase mb-4">
                                {t('about.communityTitle')}
                            </h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <a
                                    href="https://github.com/M3rcena/Udeler-Reborn"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--border-highlight)] hover:bg-[var(--bg-surface)] shadow-md"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <svg className="h-5 w-5 text-[var(--text-primary)]" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                                        </svg>
                                        <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">↗</span>
                                    </div>
                                    <div>
                                        <span className="font-extrabold text-xs text-[var(--text-primary)] block">GitHub Repository</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Star & inspect open source code</span>
                                    </div>
                                </a>

                                <a
                                    href="https://github.com/sponsors/M3rcena"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:-translate-y-0.5 hover:border-pink-500/40 hover:bg-[var(--bg-surface)] shadow-md"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <svg className="h-5 w-5 text-pink-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                        </svg>
                                        <span className="text-xs text-pink-400 transition-colors">❤️</span>
                                    </div>
                                    <div>
                                        <span className="font-extrabold text-xs text-pink-400 block">Sponsor Project</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Support future developments</span>
                                    </div>
                                </a>

                                <a
                                    href="https://discord.gg/ZgXKk6eTfC"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:-translate-y-0.5 hover:border-[#5865F2]/40 hover:bg-[var(--bg-surface)] shadow-md"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <svg className="h-5 w-5 text-[#5865F2]" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                                        </svg>
                                        <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">↗</span>
                                    </div>
                                    <div>
                                        <span className="font-extrabold text-xs text-[var(--text-primary)] block">Discord Community</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Discuss & share feedback</span>
                                    </div>
                                </a>

                                <a
                                    href="https://github.com/M3rcena/Udeler-Reborn/issues"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="cursor-pointer group flex flex-col justify-between rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all hover:-translate-y-0.5 hover:border-amber-500/40 hover:bg-[var(--bg-surface)] shadow-md"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                        </svg>
                                        <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">↗</span>
                                    </div>
                                    <div>
                                        <span className="font-extrabold text-xs text-[var(--text-primary)] block">Report Issue</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">File bug reports & requests</span>
                                    </div>
                                </a>
                            </div>

                            <div className="mt-6 border-t border-[var(--border-color)] pt-4 text-center">
                                <span className="text-[11px] text-[var(--text-secondary)]">
                                    {t('about.licenseNotice')}
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 3. LOGS SUBTAB CONSOLE */
                    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                        {/* CONTROL BAR */}
                        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 shadow-md backdrop-blur-xl">
                            {/* SEARCH INPUT */}
                            <div className="relative flex-1">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder={String(t('about.searchLogs'))}
                                    value={logSearch}
                                    onChange={(e) => setLogSearch(e.target.value)}
                                    className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1.5 pl-8 pr-3 font-mono text-xs text-[var(--text-primary)] placeholder-[var(--text-secondary)] focus:border-[var(--border-highlight)] focus:outline-none"
                                />
                                {logSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setLogSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* LEVEL FILTER PILLS */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
                                {(['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'] as FilterLevel[]).map((level) => {
                                    const isActive = logFilter === level
                                    const count = logCounts[level]
                                    return (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setLogFilter(level)}
                                            className={`cursor-pointer flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold font-mono transition-all ${isActive
                                                ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-xs'
                                                : 'border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)]'
                                                }`}
                                        >
                                            <span>{level}</span>
                                            <span className={`rounded-full px-1.5 py-0.2 text-[9px] ${level === 'ERROR' && count > 0
                                                ? 'bg-rose-500 text-white'
                                                : 'bg-black/30 text-inherit'
                                                }`}>
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>

                            {/* LOG ACTIONS */}
                            <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-[var(--border-color)] pt-2 md:pt-0 md:pl-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setAutoScroll(!autoScroll)}
                                    title="Auto-scroll to latest"
                                    className={`cursor-pointer flex items-center gap-1 rounded-xl border border-[var(--border-color)] px-2.5 py-1.5 text-[11px] font-bold transition-all ${autoScroll
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                                        }`}
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${autoScroll ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                                    <span>Scroll</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={loadLogs}
                                    title={String(t('about.refreshLogs'))}
                                    className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)] transition-all"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleCopyAllLogs}
                                    title="Copy logs to clipboard"
                                    disabled={filteredLogs.length === 0}
                                    className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)] transition-all disabled:opacity-40"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleClearLogs}
                                    title={String(t('about.clearLogs'))}
                                    disabled={logs.length === 0}
                                    className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1.5 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all disabled:opacity-40"
                                >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>

                                <button
                                    type="button"
                                    disabled={isExporting}
                                    onClick={handleExportLogs}
                                    className="cursor-pointer flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-3 py-1.5 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>{isExporting ? 'Exporting...' : t('about.exportLogs')}</span>
                                </button>
                            </div>
                        </div>

                        {/* TERMINAL LOG CONSOLE */}
                        <div
                            ref={logContainerRef}
                            className="flex flex-col gap-1.5 rounded-3xl border border-[var(--border-color)] bg-black/60 p-4 font-mono text-xs shadow-2xl backdrop-blur-2xl max-h-[520px] overflow-y-auto [scrollbar-gutter:stable]"
                        >
                            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1 text-[10px] text-[var(--text-secondary)] font-sans">
                                <span>Showing {filteredLogs.length} of {logs.length} ring-buffer records</span>
                                <span className="font-mono">Sensitive keys: [REDACTED]</span>
                            </div>

                            {filteredLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center text-[var(--text-secondary)]">
                                    <svg className="h-8 w-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="font-semibold text-xs">{t('about.noLogsFound')}</p>
                                    <p className="text-[11px] mt-1 text-[var(--text-secondary)]">
                                        Trigger app actions or change filters to inspect real-time events.
                                    </p>
                                </div>
                            ) : (
                                filteredLogs.map((log, index) => {
                                    const isExpanded = expandedLogIdx === index
                                    const timeStr = log.timestamp
                                        ? new Date(log.timestamp).toLocaleTimeString()
                                        : '00:00:00'

                                    return (
                                        <div
                                            key={`${log.timestamp}-${index}`}
                                            className="group flex flex-col rounded-xl border border-transparent p-2 transition-colors hover:border-white/10 hover:bg-white/5"
                                        >
                                            <div className="flex items-start gap-2.5">
                                                {/* TIME */}
                                                <span className="shrink-0 text-[10px] text-[var(--text-secondary)] opacity-60">
                                                    {timeStr}
                                                </span>

                                                {/* LEVEL PILL */}
                                                <span
                                                    className={`shrink-0 rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider ${log.level === 'ERROR'
                                                        ? 'border border-rose-500/40 bg-rose-500/15 text-rose-400'
                                                        : log.level === 'WARN'
                                                            ? 'border border-amber-500/40 bg-amber-500/15 text-amber-400'
                                                            : log.level === 'INFO'
                                                                ? 'border border-blue-500/40 bg-blue-500/15 text-blue-400'
                                                                : 'border border-gray-500/40 bg-gray-500/15 text-gray-400'
                                                        }`}
                                                >
                                                    {log.level}
                                                </span>

                                                {/* SUBSYSTEM */}
                                                <span className="shrink-0 rounded-md bg-white/5 px-1.5 py-0.2 text-[9px] font-bold text-[var(--text-secondary)]">
                                                    [{log.subsystem}]
                                                </span>

                                                {/* MESSAGE */}
                                                <span className="flex-1 break-all text-[var(--text-primary)] leading-relaxed">
                                                    {log.message}
                                                </span>

                                                {/* CONTEXT TOGGLE */}
                                                {log.context && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedLogIdx(isExpanded ? null : index)}
                                                        className="cursor-pointer shrink-0 text-[10px] text-[var(--accent-from)] hover:underline"
                                                    >
                                                        {isExpanded ? 'Hide context' : 'View context'}
                                                    </button>
                                                )}
                                            </div>

                                            {/* CONTEXT ACCORDION */}
                                            {isExpanded && log.context && (
                                                <pre className="mt-2 overflow-x-auto rounded-lg border border-white/5 bg-black/50 p-2.5 text-[10px] text-emerald-400">
                                                    {JSON.stringify(log.context, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
