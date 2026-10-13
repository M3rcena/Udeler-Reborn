import React, { useEffect, useRef, useState } from 'react'
import { useI18n } from '../contexts/I18nContext'

export type SettingsCategory =
    | 'downloads'
    | 'media'
    | 'network'
    | 'scheduler'
    | 'interface'
    | 'maintenance'

interface AppSettingsState {
    // Downloads & Storage
    downloadPath: string
    organizeByPlatform: boolean
    platformFolderStrategy: 'subfolder' | 'prefix' | 'flat'
    createSectionFolders: boolean
    autoNumberLectures: boolean
    zeroPadLectures: boolean
    fileConflictAction: 'skip' | 'overwrite' | 'rename'
    organizeByInstructor: boolean

    // Video & Audio Quality
    videoQuality: 'Auto' | 'Highest' | '1080p' | '720p' | '480p' | '360p' | 'Lowest'
    qualityFallback: boolean
    videoFormat: 'mp4' | 'mkv'
    extractAudioOnly: boolean

    // Subtitles & Attachments
    downloadSubtitles: boolean
    subtitleLanguage: string
    downloadAllSubtitles: boolean
    subtitleFormat: 'srt' | 'vtt'
    downloadAttachments: boolean
    downloadDescriptions: boolean
    downloadSyllabus: boolean
    maxAttachmentSizeMb: number

    // Network & Bandwidth
    maxConcurrentDownloads: number
    enableSpeedLimit: boolean
    maxDownloadSpeedKbps: number
    autoRetry: boolean
    maxRetryAttempts: number
    requestTimeoutSec: number
    proxyMode: 'none' | 'system' | 'custom'
    proxyHost: string
    proxyPort: string

    // Scheduler
    scheduleEnabled: boolean
    scheduleStart: string
    scheduleEnd: string
    scheduleDays: string[]
    pauseOutsideSchedule: boolean
    preventSleepWhileDownloading: boolean

    // Interface & Appearance
    theme: 'violet' | 'midnight' | 'cyberpunk' | 'light'
    cardLayout: 'grid' | 'compact'
    showPlatformBadge: boolean
    startOnBoot: boolean
    closeToTray: boolean
    minimizeToTray: boolean
    notifyOnCompletion: boolean
    hardwareAcceleration: boolean

    // Maintenance & Security
    vaultMode: boolean
}

const DEFAULT_SETTINGS: AppSettingsState = {
    downloadPath: 'C:\\Users\\User\\Downloads\\Udeler-Courses',
    organizeByPlatform: true,
    platformFolderStrategy: 'subfolder',
    createSectionFolders: true,
    autoNumberLectures: true,
    zeroPadLectures: true,
    fileConflictAction: 'skip',
    organizeByInstructor: false,

    videoQuality: '1080p',
    qualityFallback: true,
    videoFormat: 'mp4',
    extractAudioOnly: false,

    downloadSubtitles: true,
    subtitleLanguage: 'en',
    downloadAllSubtitles: false,
    subtitleFormat: 'srt',
    downloadAttachments: true,
    downloadDescriptions: true,
    downloadSyllabus: true,
    maxAttachmentSizeMb: 500,

    maxConcurrentDownloads: 3,
    enableSpeedLimit: false,
    maxDownloadSpeedKbps: 10000,
    autoRetry: true,
    maxRetryAttempts: 3,
    requestTimeoutSec: 30,
    proxyMode: 'none',
    proxyHost: '',
    proxyPort: '',

    scheduleEnabled: false,
    scheduleStart: '01:00',
    scheduleEnd: '07:00',
    scheduleDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    pauseOutsideSchedule: true,
    preventSleepWhileDownloading: true,

    theme: 'violet',
    cardLayout: 'grid',
    showPlatformBadge: true,
    startOnBoot: false,
    closeToTray: true,
    minimizeToTray: false,
    notifyOnCompletion: true,
    hardwareAcceleration: true,

    vaultMode: false
}

// -------------------------------------------------------------
// REUSABLE CUSTOM UI CONTROLS
// -------------------------------------------------------------

/**
 * Custom Toggle Switch
 * Uses padding and bg-no-repeat to prevent subpixel gradient wrapping on curved edges.
 */
const ToggleSwitch: React.FC<{
    checked: boolean
    onChange: (checked: boolean) => void
    disabled?: boolean
}> = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full p-0.5 transition-all duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${checked
            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat shadow-sm shadow-[var(--accent-from)]/30'
            : 'bg-white/10 hover:bg-white/15'
            }`}
        style={
            checked
                ? {
                    backgroundImage: 'linear-gradient(90deg, var(--accent-from) 0%, var(--accent-to) 100%)',
                    backgroundRepeat: 'no-repeat'
                }
                : undefined
        }
    >
        <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'
                }`}
        />
    </button>
)

interface CustomSelectOption {
    value: string
    label: string
    badge?: string
}

/**
 * Custom Select with limited max-height and custom scrollbar
 */
const CustomSelect: React.FC<{
    value: string
    options: CustomSelectOption[]
    onChange: (value: string) => void
    prefixLabel?: string
}> = ({ value, options, onChange, prefixLabel }) => {
    const [isOpen, setIsOpen] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    const selected = options.find((o) => o.value === value) || options[0]

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent): void => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={ref} className="relative z-20 inline-block text-left">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="cursor-pointer flex items-center justify-between gap-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xs hover:border-[var(--border-highlight)] hover:bg-[var(--bg-surface)] transition-all min-w-[170px]"
            >
                <div className="flex items-center gap-2 truncate">
                    {prefixLabel && <span className="text-[var(--text-secondary)] font-normal">{prefixLabel}</span>}
                    <span className="truncate">{selected?.label}</span>
                </div>
                <svg
                    className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''
                        }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-1.5 w-56 max-h-52 overflow-y-auto origin-top-right rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1.5 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150 z-50">
                    {options.map((opt) => {
                        const isSelected = opt.value === value
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value)
                                    setIsOpen(false)
                                }}
                                className={`cursor-pointer flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-colors ${isSelected
                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat font-bold text-white shadow-xs'
                                    : 'text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
                                    }`}
                            >
                                <span className="truncate">{opt.label}</span>
                                {opt.badge && (
                                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-white/5 text-[var(--text-secondary)]'}`}>
                                        {opt.badge}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/**
 * Pure In-Place Digital Time Picker
 * 100% compact, responsive, and always inline.
 * No huge popups or lists of 24 hours.
 */
const InlineTimePicker: React.FC<{
    label: string
    value: string // "HH:MM" 24h
    onChange: (val: string) => void
}> = ({ label, value, onChange }) => {
    const [hStr, mStr] = (value || '00:00').split(':')
    const h24 = parseInt(hStr, 10) || 0
    const minute = parseInt(mStr, 10) || 0

    const isPM = h24 >= 12
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24

    const updateTime = (newH12: number, newMin: number, newPM: boolean): void => {
        let targetH24 = newH12
        if (newPM) {
            targetH24 = newH12 === 12 ? 12 : newH12 + 12
        } else {
            targetH24 = newH12 === 12 ? 0 : newH12
        }
        const clampedMin = Math.max(0, Math.min(59, newMin))
        onChange(`${targetH24.toString().padStart(2, '0')}:${clampedMin.toString().padStart(2, '0')}`)
    }

    const adjustHour = (delta: number): void => {
        let nextH12 = h12 + delta
        if (nextH12 > 12) nextH12 = 1
        if (nextH12 < 1) nextH12 = 12
        updateTime(nextH12, minute, isPM)
    }

    const adjustMinute = (delta: number): void => {
        let nextMin = minute + delta
        if (nextMin >= 60) nextMin = 0
        if (nextMin < 0) nextMin = 55
        updateTime(h12, nextMin, isPM)
    }

    return (
        <div className="flex flex-col gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)]">{label}</span>
                <span className="font-mono text-[10px] text-[var(--text-secondary)]">24h: {value}</span>
            </div>

            {/* In-place Clock Digits & AM/PM Controls */}
            <div className="flex items-center gap-2">
                {/* Hour Spinner */}
                <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
                    <button
                        type="button"
                        onClick={() => adjustHour(-1)}
                        className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all font-bold"
                        title="Previous Hour"
                    >
                        -
                    </button>
                    <span className="w-10 text-center font-mono font-black text-sm text-[var(--text-primary)] select-none">
                        {h12.toString().padStart(2, '0')}
                    </span>
                    <button
                        type="button"
                        onClick={() => adjustHour(1)}
                        className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all font-bold"
                        title="Next Hour"
                    >
                        +
                    </button>
                </div>

                <span className="font-mono font-bold text-base text-[var(--text-secondary)] select-none">:</span>

                {/* Minute Spinner */}
                <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1">
                    <button
                        type="button"
                        onClick={() => adjustMinute(-5)}
                        className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all font-bold"
                        title="Minus 5 Minutes"
                    >
                        -
                    </button>
                    <span className="w-10 text-center font-mono font-black text-sm text-[var(--text-primary)] select-none">
                        {minute.toString().padStart(2, '0')}
                    </span>
                    <button
                        type="button"
                        onClick={() => adjustMinute(5)}
                        className="cursor-pointer h-8 w-8 flex items-center justify-center rounded-lg text-sm text-[var(--text-secondary)] hover:text-white hover:bg-white/10 transition-all font-bold"
                        title="Plus 5 Minutes"
                    >
                        +
                    </button>
                </div>

                {/* AM / PM Segmented Toggle */}
                <div className="flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-1 ml-auto">
                    <button
                        type="button"
                        onClick={() => updateTime(h12, minute, false)}
                        className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!isPM
                            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        AM
                    </button>
                    <button
                        type="button"
                        onClick={() => updateTime(h12, minute, true)}
                        className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isPM
                            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white shadow-xs'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        PM
                    </button>
                </div>
            </div>

            {/* Quick Minute Jump Chips */}
            <div className="flex items-center gap-1.5 pt-1">
                <span className="text-[10px] text-[var(--text-secondary)] mr-1">Quick Min:</span>
                {[0, 15, 30, 45].map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => updateTime(h12, m, isPM)}
                        className={`cursor-pointer px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all border ${minute === m
                            ? 'bg-white/15 border-white/20 text-white'
                            : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                    >
                        :{m.toString().padStart(2, '0')}
                    </button>
                ))}
            </div>
        </div>
    )
}

// -------------------------------------------------------------
// MAIN SETTINGS VIEW COMPONENT
// -------------------------------------------------------------

export const SettingsView: React.FC = () => {
    const { currentLocale, setLocale, availableLocales } = useI18n()

    // Active Category (No 'all' category)
    const [activeCategory, setActiveCategory] = useState<SettingsCategory>('downloads')

    // Settings State
    const [settings, setSettings] = useState<AppSettingsState>(DEFAULT_SETTINGS)

    // UI Interactive States
    const [isSaving, setIsSaving] = useState<boolean>(false)
    const [toastMessage, setToastMessage] = useState<string | null>(null)
    const [isCleaningCache, setIsCleaningCache] = useState<boolean>(false)
    const [isIntegrityScanning, setIsIntegrityScanning] = useState<boolean>(false)
    const [integrityScanProgress, setIntegrityScanProgress] = useState<number>(0)
    const [hasScannedIntegrity, setHasScannedIntegrity] = useState<boolean>(false)
    const [reclaimedBytes, setReclaimedBytes] = useState<number>(2548291072) // ~2.37 GB mock
    const [cachedTempBytes, setCachedTempBytes] = useState<number>(142958100) // ~136 MB mock
    const [showResetModal, setShowResetModal] = useState<boolean>(false)

    const showToast = (msg: string): void => {
        setToastMessage(msg)
        setTimeout(() => setToastMessage(null), 3000)
    }

    const updateSetting = <K extends keyof AppSettingsState>(key: K, value: AppSettingsState[K]): void => {
        setSettings((prev) => ({ ...prev, [key]: value }))
    }

    const handleSave = (): void => {
        setIsSaving(true)
        setTimeout(() => {
            setIsSaving(false)
            showToast('✓ Preferences saved successfully')
        }, 600)
    }

    const handleThemeChange = (newTheme: 'violet' | 'midnight' | 'cyberpunk' | 'light'): void => {
        updateSetting('theme', newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
        showToast(`Theme changed to ${newTheme.toUpperCase()}`)
    }

    const handleBrowseFolder = (): void => {
        showToast('Select folder dialog will link to native OS picker')
    }

    const handlePurgeCache = (): void => {
        setIsCleaningCache(true)
        setTimeout(() => {
            setIsCleaningCache(false)
            setReclaimedBytes((prev) => prev + cachedTempBytes)
            setCachedTempBytes(0)
            showToast('✓ Orphaned files and temporary chunks cleared')
        }, 1200)
    }

    const handleRunIntegrityScan = (): void => {
        setIsIntegrityScanning(true)
        setIntegrityScanProgress(0)
        setHasScannedIntegrity(false)

        const interval = setInterval(() => {
            setIntegrityScanProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval)
                    setIsIntegrityScanning(false)
                    setHasScannedIntegrity(true)
                    showToast('✓ Integrity check complete: All downloaded lectures intact')
                    return 100
                }
                return prev + 20
            })
        }, 250)
    }

    const handleResetDefaults = (): void => {
        setSettings(DEFAULT_SETTINGS)
        setShowResetModal(false)
        document.documentElement.setAttribute('data-theme', 'violet')
        showToast('All settings reset to default values')
    }

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
    }

    // Scheduler calculation helpers
    const parseTimeToMinutes = (timeStr: string): number => {
        const [h, m] = (timeStr || '00:00').split(':').map(Number)
        return (h || 0) * 60 + (m || 0)
    }

    const startMinutes = parseTimeToMinutes(settings.scheduleStart)
    const endMinutes = parseTimeToMinutes(settings.scheduleEnd)
    const totalMinutes = 24 * 60

    let scheduleLeftPercent = (startMinutes / totalMinutes) * 100
    let scheduleWidthPercent = ((endMinutes - startMinutes) / totalMinutes) * 100
    if (scheduleWidthPercent < 0) {
        // Wraps over midnight (e.g. 22:00 to 06:00)
        scheduleWidthPercent = ((totalMinutes - startMinutes + endMinutes) / totalMinutes) * 100
    }

    const daysOfWeek = [
        { id: 'mon', label: 'Mon' },
        { id: 'tue', label: 'Tue' },
        { id: 'wed', label: 'Wed' },
        { id: 'thu', label: 'Thu' },
        { id: 'fri', label: 'Fri' },
        { id: 'sat', label: 'Sat' },
        { id: 'sun', label: 'Sun' }
    ]

    const toggleDay = (dayId: string): void => {
        const exists = settings.scheduleDays.includes(dayId)
        if (exists) {
            if (settings.scheduleDays.length === 1) return // Keep at least one
            updateSetting('scheduleDays', settings.scheduleDays.filter((d) => d !== dayId))
        } else {
            updateSetting('scheduleDays', [...settings.scheduleDays, dayId])
        }
    }

    return (
        <div className="flex flex-1 min-h-0 w-full flex-col overflow-y-auto px-6 py-5">
            {/* TOAST NOTIFICATION */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-[var(--border-highlight)] bg-[var(--bg-surface)] px-4 py-3 text-xs font-bold text-[var(--text-primary)] shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* RESET CONFIRMATION MODAL */}
            {showResetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-md p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl flex flex-col gap-4 text-center animate-in zoom-in-95 duration-200">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-[var(--text-primary)]">Reset Preferences?</h3>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                            This will revert all download destinations, quality settings, rate limits, and interface options back to factory defaults.
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowResetModal(false)}
                                className="cursor-pointer flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                className="cursor-pointer flex-1 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 py-2 text-xs font-bold transition-all"
                            >
                                Reset to Default
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-12">
                {/* 1. TOP HEADER & SAVE BAR */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border-color)] pb-4">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-inner text-[var(--accent-from)]">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black tracking-wide text-[var(--text-primary)] uppercase">
                                    Application Settings
                                </h2>
                                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-secondary)]">
                                    Preferences Hub
                                </span>
                            </div>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                                Configure storage directories, media quality, network throttling, and automation.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => setShowResetModal(true)}
                            className="cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-all"
                            title="Reset all settings to default"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reset Defaults</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="cursor-pointer flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat px-5 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Save Changes</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 2. CATEGORY PILL SELECTOR (NO ALL TAB, NO SEARCH) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none]">
                    {[
                        { id: 'downloads' as SettingsCategory, label: 'Downloads', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
                        { id: 'media' as SettingsCategory, label: 'Media & Quality', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
                        { id: 'network' as SettingsCategory, label: 'Network', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                        { id: 'scheduler' as SettingsCategory, label: 'Scheduler', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'interface' as SettingsCategory, label: 'Appearance', icon: 'M7 21a4 4 0 01-4-4 4 4 0 014-4c.78 0 1.5.22 2.11.6L12 11l6.89-6.89a2 2 0 112.83 2.83L14.83 13.82c.38.61.6 1.33.6 2.18a4 4 0 01-4 4 4 4 0 01-4-4' },
                        { id: 'maintenance' as SettingsCategory, label: 'Maintenance', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' }
                    ].map((cat) => (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveCategory(cat.id)}
                            className={`cursor-pointer flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all ${activeCategory === cat.id
                                ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white shadow-md'
                                : 'border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)]'
                                }`}
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                            </svg>
                            <span>{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* 3. SETTINGS SECTIONS (EACH IS SEPARATE) */}
                <div className="flex flex-col gap-6">

                    {/* ========================================================
                        TAB 1: DOWNLOADS & MULTI-PLATFORM DIRECTORY
                    ======================================================== */}
                    {activeCategory === 'downloads' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Download Location & File Organization</h3>
                                    <p className="text-[11px] text-[var(--text-secondary)]">Manage storage paths, multi-platform grouping, and directory hierarchies.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                {/* Primary Download Path */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-[var(--text-primary)]">Primary Storage Directory</span>
                                        <span className="font-mono text-[10px] text-emerald-400">Available Space: 142.5 GB / 512 GB</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={settings.downloadPath}
                                            className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 font-mono text-xs text-[var(--text-primary)] focus:outline-none cursor-default select-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleBrowseFolder}
                                            className="cursor-pointer rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat px-4 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all whitespace-nowrap"
                                        >
                                            Browse Folder
                                        </button>
                                    </div>
                                </div>

                                {/* Multi-Platform Storage Strategy */}
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 flex flex-col gap-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-[var(--text-primary)]">Multi-Platform Directory Isolation</h4>
                                                <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[9px] font-mono text-blue-300 font-bold">Multi-Source</span>
                                            </div>
                                            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                                                How downloads should be partitioned between Udemy and other platforms.
                                            </p>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.organizeByPlatform}
                                            onChange={(c) => updateSetting('organizeByPlatform', c)}
                                        />
                                    </div>

                                    {settings.organizeByPlatform && (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-[var(--border-color)]">
                                            <span className="text-xs text-[var(--text-secondary)]">Platform Partition Strategy:</span>
                                            <div className="flex gap-1.5">
                                                {[
                                                    { id: 'subfolder' as const, label: 'Dedicated Subfolder (e.g. /Udemy/)' },
                                                    { id: 'prefix' as const, label: 'Folder Prefix (e.g. [Udemy] Python)' },
                                                    { id: 'flat' as const, label: 'Shared / Flat' }
                                                ].map((strat) => (
                                                    <button
                                                        key={strat.id}
                                                        type="button"
                                                        onClick={() => updateSetting('platformFolderStrategy', strat.id)}
                                                        className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${settings.platformFolderStrategy === strat.id
                                                            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                            : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                            }`}
                                                    >
                                                        {strat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Custom Toggles Grid (NO default browser checkboxes) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Auto-create Chapter/Section subfolders */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Create Chapter Subfolders</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Place lectures into organized section subdirectories</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.createSectionFolders}
                                            onChange={(c) => updateSetting('createSectionFolders', c)}
                                        />
                                    </div>

                                    {/* Auto-number Lectures */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Auto-Number Lectures</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Prefix files with lecture index for chronological media players</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.autoNumberLectures}
                                            onChange={(c) => updateSetting('autoNumberLectures', c)}
                                        />
                                    </div>

                                    {/* Zero-padding for lecture numbers */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Zero-Pad Numbers</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Format single digit numbers as 01 instead of 1</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.zeroPadLectures}
                                            onChange={(c) => updateSetting('zeroPadLectures', c)}
                                        />
                                    </div>

                                    {/* Organize by Instructor */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Group by Instructor Name</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Nest course folders under instructor parent directories</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.organizeByInstructor}
                                            onChange={(c) => updateSetting('organizeByInstructor', c)}
                                        />
                                    </div>
                                </div>

                                {/* Conflict Handling & LIVE PATH PREVIEW */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <label className="text-xs font-bold text-[var(--text-primary)]">File Conflict Resolution</label>
                                        <p className="text-[11px] text-[var(--text-secondary)] mb-2">When a downloaded file already exists on your hard drive:</p>
                                        <div className="flex gap-2">
                                            {[
                                                { id: 'skip' as const, label: 'Skip File' },
                                                { id: 'overwrite' as const, label: 'Overwrite' },
                                                { id: 'rename' as const, label: 'Keep Both (Auto-Increment)' }
                                            ].map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => updateSetting('fileConflictAction', opt.id)}
                                                    className={`cursor-pointer flex-1 rounded-xl py-2 text-xs font-semibold transition-all border ${settings.fileConflictAction === opt.id
                                                        ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* DYNAMIC, INTERACTIVE PATH PREVIEW TREE */}
                                    <div className="flex flex-col p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">Live Path Structure Preview</span>
                                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                                Conflict: {settings.fileConflictAction.toUpperCase()}
                                            </span>
                                        </div>

                                        <div className="font-mono text-[11px] bg-black/40 p-3 rounded-xl border border-white/5 overflow-x-auto leading-relaxed">
                                            <div className="text-[var(--text-secondary)]">
                                                📁 {settings.downloadPath}/
                                            </div>

                                            {/* Platform Subfolder */}
                                            {settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' && (
                                                <div className="pl-3 text-blue-400 font-bold">
                                                    📁 Udemy/
                                                </div>
                                            )}

                                            {/* Instructor Folder */}
                                            {settings.organizeByInstructor && (
                                                <div className={`text-purple-300 font-bold ${settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' ? 'pl-6' : 'pl-3'}`}>
                                                    📁 Angela Yu/
                                                </div>
                                            )}

                                            {/* Course Folder */}
                                            <div className={`text-amber-300 font-bold ${settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' ? (settings.organizeByInstructor ? 'pl-9' : 'pl-6') : (settings.organizeByInstructor ? 'pl-6' : 'pl-3')}`}>
                                                📁 {settings.organizeByPlatform && settings.platformFolderStrategy === 'prefix' ? '[Udemy] ' : ''}The Complete Web Development Bootcamp/
                                            </div>

                                            {/* Chapter / Section Folder */}
                                            {settings.createSectionFolders ? (
                                                <>
                                                    <div className={`text-cyan-300 ${settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' ? (settings.organizeByInstructor ? 'pl-12' : 'pl-9') : (settings.organizeByInstructor ? 'pl-9' : 'pl-6')}`}>
                                                        📁 {settings.autoNumberLectures ? (settings.zeroPadLectures ? '01 - ' : '1 - ') : ''}Getting Started with Web Development/
                                                    </div>
                                                    <div className={`text-emerald-400 font-bold ${settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' ? (settings.organizeByInstructor ? 'pl-16' : 'pl-12') : (settings.organizeByInstructor ? 'pl-12' : 'pl-9')}`}>
                                                        📄 {settings.autoNumberLectures ? (settings.zeroPadLectures ? '01 - ' : '1 - ') : ''}Course Orientation{settings.fileConflictAction === 'rename' ? ' (1)' : ''}.mp4
                                                    </div>
                                                </>
                                            ) : (
                                                /* Flattened Section */
                                                <div className={`text-emerald-400 font-bold ${settings.organizeByPlatform && settings.platformFolderStrategy === 'subfolder' ? (settings.organizeByInstructor ? 'pl-12' : 'pl-9') : (settings.organizeByInstructor ? 'pl-9' : 'pl-6')}`}>
                                                    📄 {settings.autoNumberLectures ? (settings.zeroPadLectures ? '01 - ' : '1 - ') : ''}Course Orientation{settings.fileConflictAction === 'rename' ? ' (1)' : ''}.mp4
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================
                        TAB 2: MEDIA & VIDEO QUALITY
                    ======================================================== */}
                    {activeCategory === 'media' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Video & Audio Quality Preferences</h3>
                                    <p className="text-[11px] text-[var(--text-secondary)]">Choose target resolution, video container, audio extraction, and subtitles.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-5">
                                {/* Resolution Pill Selector */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-xs font-semibold text-[var(--text-primary)]">Preferred Video Resolution</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                                        {[
                                            { id: 'Auto' as const, label: 'Auto (Best)' },
                                            { id: 'Highest' as const, label: 'Max Possible' },
                                            { id: '1080p' as const, label: '1080p FHD' },
                                            { id: '720p' as const, label: '720p HD' },
                                            { id: '480p' as const, label: '480p SD' },
                                            { id: '360p' as const, label: '360p Low' },
                                            { id: 'Lowest' as const, label: 'Smallest' }
                                        ].map((qual) => (
                                            <button
                                                key={qual.id}
                                                type="button"
                                                onClick={() => updateSetting('videoQuality', qual.id)}
                                                className={`cursor-pointer rounded-xl py-2 px-3 text-xs font-bold transition-all border ${settings.videoQuality === qual.id
                                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-md'
                                                    : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)]'
                                                    }`}
                                            >
                                                {qual.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                                    {/* Video Container Format */}
                                    <div className="flex flex-col gap-1.5 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <span className="text-xs font-bold text-[var(--text-primary)]">Video Format Container</span>
                                        <span className="text-[11px] text-[var(--text-secondary)] mb-2">Target video container packaging</span>
                                        <div className="flex gap-2">
                                            {(['mp4', 'mkv'] as const).map((fmt) => (
                                                <button
                                                    key={fmt}
                                                    type="button"
                                                    onClick={() => updateSetting('videoFormat', fmt)}
                                                    className={`cursor-pointer flex-1 rounded-xl py-1.5 text-xs font-bold uppercase transition-all border ${settings.videoFormat === fmt
                                                        ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                        : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                        }`}
                                                >
                                                    .{fmt}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Quality Fallback Toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Adaptive Fallback</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Fetch next highest stream if preferred is missing</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.qualityFallback}
                                            onChange={(c) => updateSetting('qualityFallback', c)}
                                        />
                                    </div>

                                    {/* Audio Only Mode */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Audio-Only Podcast Mode</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Extract MP3/AAC without downloading video</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.extractAudioOnly}
                                            onChange={(c) => updateSetting('extractAudioOnly', c)}
                                        />
                                    </div>
                                </div>

                                {/* Subtitles & Captions Settings */}
                                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-xs font-bold text-[var(--text-primary)]">Closed Captions & Subtitles</h4>
                                            <p className="text-[11px] text-[var(--text-secondary)]">Save synchronized subtitle files alongside video lectures</p>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-xs font-semibold text-[var(--text-secondary)]">Enable Subtitles</span>
                                            <ToggleSwitch
                                                checked={settings.downloadSubtitles}
                                                onChange={(c) => updateSetting('downloadSubtitles', c)}
                                            />
                                        </div>
                                    </div>

                                    {settings.downloadSubtitles && (
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-[var(--border-color)] animate-in fade-in duration-200">
                                            {/* Subtitle Language (Custom Select with scrollable height) */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Primary Language</label>
                                                <CustomSelect
                                                    value={settings.subtitleLanguage}
                                                    options={[
                                                        { value: 'en', label: 'English (US/UK)', badge: 'EN' },
                                                        { value: 'es', label: 'Spanish (Español)', badge: 'ES' },
                                                        { value: 'fr', label: 'French (Français)', badge: 'FR' },
                                                        { value: 'de', label: 'German (Deutsch)', badge: 'DE' },
                                                        { value: 'el', label: 'Greek (Ελληνικά)', badge: 'EL' },
                                                        { value: 'pt', label: 'Portuguese (Português)', badge: 'PT' },
                                                        { value: 'all', label: 'All Available Tracks', badge: 'ALL' }
                                                    ]}
                                                    onChange={(val) => updateSetting('subtitleLanguage', val)}
                                                />
                                            </div>

                                            {/* Subtitle Format */}
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Subtitle Format</label>
                                                <div className="flex gap-2">
                                                    {(['srt', 'vtt'] as const).map((fmt) => (
                                                        <button
                                                            key={fmt}
                                                            type="button"
                                                            onClick={() => updateSetting('subtitleFormat', fmt)}
                                                            className={`cursor-pointer flex-1 rounded-xl py-2 text-xs font-bold uppercase transition-all border ${settings.subtitleFormat === fmt
                                                                ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            .{fmt}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Download All Subtitles toggle */}
                                            <div className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)]">
                                                <span className="text-[11px] font-semibold text-[var(--text-primary)]">Download All Tracks</span>
                                                <ToggleSwitch
                                                    checked={settings.downloadAllSubtitles}
                                                    onChange={(c) => updateSetting('downloadAllSubtitles', c)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Content & Attachment Downloads */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Lecture Attachments</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">PDFs, code repos, ZIP assets</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.downloadAttachments}
                                            onChange={(c) => updateSetting('downloadAttachments', c)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Lecture Descriptions</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Save teacher notes as .txt</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.downloadDescriptions}
                                            onChange={(c) => updateSetting('downloadDescriptions', c)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Curriculum Summary</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Export full syllabus JSON</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.downloadSyllabus}
                                            onChange={(c) => updateSetting('downloadSyllabus', c)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================
                        TAB 3: NETWORK & BANDWIDTH RATE LIMITER
                    ======================================================== */}
                    {activeCategory === 'network' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Network & Bandwidth Control</h3>
                                    <p className="text-[11px] text-[var(--text-secondary)]">Manage concurrent threads, rate limits, proxy connections, and retry policies.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {/* MAX CONCURRENT DOWNLOADS */}
                                <div className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold text-[var(--text-primary)]">Max Concurrent Downloads</span>
                                            <span className="font-mono text-xs font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                                {settings.maxConcurrentDownloads} {settings.maxConcurrentDownloads === 1 ? 'stream' : 'streams'}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-secondary)] mb-4">
                                            Parallel video download connections. Balanced throughput avoids platform 429 rate limit errors.
                                        </p>
                                    </div>

                                    {/* SELECTION BUTTONS WITH DYNAMIC MESSAGE ON THE SIDE ABOVE */}
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Simultaneous Streams</span>
                                            <div>
                                                {settings.maxConcurrentDownloads === 3 ? (
                                                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                                                        ★ Recommended (Optimal)
                                                    </span>
                                                ) : settings.maxConcurrentDownloads <= 2 ? (
                                                    <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-lg">
                                                        Low Bandwidth Safe
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                                                        High Speed (Fiber)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Segmented stream buttons (1 through 8) */}
                                        <div className="grid grid-cols-8 gap-1.5">
                                            {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                                                const isSelected = settings.maxConcurrentDownloads === num
                                                const isFilled = num <= settings.maxConcurrentDownloads

                                                return (
                                                    <button
                                                        key={num}
                                                        type="button"
                                                        onClick={() => updateSetting('maxConcurrentDownloads', num)}
                                                        className={`cursor-pointer flex flex-col items-center justify-center py-2.5 rounded-xl border text-xs font-mono font-bold transition-all ${isSelected
                                                            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-sm'
                                                            : isFilled
                                                                ? 'bg-[var(--accent-from)]/15 border-[var(--accent-from)]/30 text-[var(--text-primary)]'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)]'
                                                            }`}
                                                    >
                                                        <span>{num}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Download Speed Limiter */}
                                <div className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Speed Throttling</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Restrict max download rate to conserve bandwidth</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.enableSpeedLimit}
                                            onChange={(c) => updateSetting('enableSpeedLimit', c)}
                                        />
                                    </div>

                                    {settings.enableSpeedLimit ? (
                                        <div className="flex items-center gap-2 mt-2">
                                            <input
                                                type="number"
                                                min="100"
                                                step="500"
                                                value={settings.maxDownloadSpeedKbps}
                                                onChange={(e) => updateSetting('maxDownloadSpeedKbps', Math.max(100, parseInt(e.target.value) || 100))}
                                                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 font-mono text-xs text-[var(--text-primary)] focus:outline-none"
                                            />
                                            <span className="text-xs font-bold text-[var(--text-secondary)] whitespace-nowrap">KB/s</span>
                                            <span className="font-mono text-xs text-emerald-400 whitespace-nowrap">({(settings.maxDownloadSpeedKbps / 1024).toFixed(1)} MB/s)</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs font-semibold text-emerald-400/80 bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10 text-center mt-2">
                                            ⚡ Unlimited Speed (Full Connection Rate)
                                        </div>
                                    )}
                                </div>

                                {/* Auto-Retry Policy */}
                                <div className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Auto-Retry Failed Downloads</span>
                                            <span className="text-[11px] text-[var(--text-secondary)]">Automatically re-attempt failed video chunks</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.autoRetry}
                                            onChange={(c) => updateSetting('autoRetry', c)}
                                        />
                                    </div>
                                    {settings.autoRetry && (
                                        <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--border-color)]">
                                            <span className="text-[var(--text-secondary)]">Max Retry Attempts:</span>
                                            <div className="flex gap-1.5">
                                                {[1, 2, 3, 5].map((cnt) => (
                                                    <button
                                                        key={cnt}
                                                        type="button"
                                                        onClick={() => updateSetting('maxRetryAttempts', cnt)}
                                                        className={`cursor-pointer px-3 py-1 rounded-lg font-mono text-xs font-bold border transition-all ${settings.maxRetryAttempts === cnt
                                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                            : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                                                            }`}
                                                    >
                                                        {cnt}x
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Proxy Configuration (CUSTOM PILLS, NO NATIVE SELECT) */}
                                <div className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div className="flex flex-col gap-1 mb-2">
                                        <span className="text-xs font-bold text-[var(--text-primary)] block">Network Proxy Protocol</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Route API and video requests via custom proxy</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5 mb-2">
                                        {[
                                            { id: 'none' as const, label: 'Direct (None)' },
                                            { id: 'system' as const, label: 'System Proxy' },
                                            { id: 'custom' as const, label: 'Custom' }
                                        ].map((prx) => (
                                            <button
                                                key={prx.id}
                                                type="button"
                                                onClick={() => updateSetting('proxyMode', prx.id)}
                                                className={`cursor-pointer rounded-xl py-1.5 px-2 text-xs font-semibold transition-all border text-center ${settings.proxyMode === prx.id
                                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {prx.label}
                                            </button>
                                        ))}
                                    </div>
                                    {settings.proxyMode === 'custom' && (
                                        <div className="flex gap-2 pt-2 border-t border-[var(--border-color)]">
                                            <input
                                                type="text"
                                                placeholder="127.0.0.1"
                                                value={settings.proxyHost}
                                                onChange={(e) => updateSetting('proxyHost', e.target.value)}
                                                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                                            />
                                            <input
                                                type="text"
                                                placeholder="8080"
                                                value={settings.proxyPort}
                                                onChange={(e) => updateSetting('proxyPort', e.target.value)}
                                                className="w-20 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 font-mono text-xs text-[var(--text-primary)]"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================
                        TAB 4: DOWNLOAD SCHEDULER (IN-PLACE CLEAN CONTROLS)
                    ======================================================== */}
                    {activeCategory === 'scheduler' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Download Scheduler & Automation</h3>
                                        <p className="text-[11px] text-[var(--text-secondary)]">Automate course downloads to run during off-peak night windows.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <span className="text-xs font-bold text-[var(--text-primary)]">Enable Scheduler</span>
                                    <ToggleSwitch
                                        checked={settings.scheduleEnabled}
                                        onChange={(c) => updateSetting('scheduleEnabled', c)}
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-5">
                                {settings.scheduleEnabled ? (
                                    <>
                                        {/* Quick Schedule Presets */}
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold text-[var(--text-secondary)]">Popular Night Windows</span>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                {[
                                                    { label: '🌙 Night Owl', start: '01:00', end: '06:00' },
                                                    { label: '🌌 Midnight Sprint', start: '00:00', end: '07:00' },
                                                    { label: '☕ Early Morning', start: '04:00', end: '08:00' },
                                                    { label: '⚡ Evening Window', start: '22:00', end: '05:00' }
                                                ].map((preset) => {
                                                    const isMatch = settings.scheduleStart === preset.start && settings.scheduleEnd === preset.end
                                                    return (
                                                        <button
                                                            key={preset.label}
                                                            type="button"
                                                            onClick={() => {
                                                                updateSetting('scheduleStart', preset.start)
                                                                updateSetting('scheduleEnd', preset.end)
                                                            }}
                                                            className={`cursor-pointer flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${isMatch
                                                                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 bg-no-repeat border-amber-500/40 text-amber-300 shadow-xs'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            <span>{preset.label}</span>
                                                            <span className="text-[10px] font-mono text-[var(--text-secondary)] font-normal">{preset.start} - {preset.end}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* IN-PLACE DIGITAL TIME CONTROLS (NO DROPDOWNS) */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <InlineTimePicker
                                                label="Start Downloading At"
                                                value={settings.scheduleStart}
                                                onChange={(val) => updateSetting('scheduleStart', val)}
                                            />
                                            <InlineTimePicker
                                                label="Pause Downloading At"
                                                value={settings.scheduleEnd}
                                                onChange={(val) => updateSetting('scheduleEnd', val)}
                                            />
                                        </div>

                                        {/* Active Days Selector */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                            <div>
                                                <span className="text-xs font-bold text-[var(--text-primary)] block">Active Schedule Days</span>
                                                <span className="text-[11px] text-[var(--text-secondary)]">Choose which days of the week the scheduler triggers</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                {daysOfWeek.map((day) => {
                                                    const isActive = settings.scheduleDays.includes(day.id)
                                                    return (
                                                        <button
                                                            key={day.id}
                                                            type="button"
                                                            onClick={() => toggleDay(day.id)}
                                                            className={`cursor-pointer h-8 w-9 rounded-xl text-xs font-bold transition-all border ${isActive
                                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                                                                : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                                }`}
                                                        >
                                                            {day.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* Mathematical Illuminated 24-Hour Timeline */}
                                        <div className="p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col gap-2.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[var(--text-primary)]">24-Hour Active Window Preview</span>
                                                <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                                    {settings.scheduleStart} → {settings.scheduleEnd}
                                                </span>
                                            </div>
                                            <div className="relative h-4 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border-color)]">
                                                <div
                                                    className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-400 to-orange-500 bg-no-repeat rounded-full shadow-md shadow-amber-500/30 transition-all duration-300"
                                                    style={{
                                                        left: `${Math.max(0, Math.min(100, scheduleLeftPercent))}%`,
                                                        width: `${Math.max(4, Math.min(100, scheduleWidthPercent))}%`
                                                    }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] font-mono text-[var(--text-secondary)]">
                                                <span>00:00 (Midnight)</span>
                                                <span>06:00</span>
                                                <span>12:00 (Noon)</span>
                                                <span>18:00</span>
                                                <span>23:59</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                                <div className="pr-3">
                                                    <span className="text-xs font-bold text-[var(--text-primary)] block">Pause Transfers Outside Window</span>
                                                    <span className="text-[10px] text-[var(--text-secondary)]">Halt downloads automatically when scheduler period ends</span>
                                                </div>
                                                <ToggleSwitch
                                                    checked={settings.pauseOutsideSchedule}
                                                    onChange={(c) => updateSetting('pauseOutsideSchedule', c)}
                                                />
                                            </div>

                                            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                                <div className="pr-3">
                                                    <span className="text-xs font-bold text-[var(--text-primary)] block">Prevent Computer Sleep</span>
                                                    <span className="text-[10px] text-[var(--text-secondary)]">Keep OS awake while active downloads are in progress</span>
                                                </div>
                                                <ToggleSwitch
                                                    checked={settings.preventSleepWhileDownloading}
                                                    onChange={(c) => updateSetting('preventSleepWhileDownloading', c)}
                                                />
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-3 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] text-xs text-[var(--text-secondary)]">
                                        <svg className="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>Scheduler is inactive. Courses will begin downloading immediately when you start them. Toggle &apos;Enable Scheduler&apos; above to set active night hours.</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ========================================================
                        TAB 5: APPEARANCE & THEME STUDIO
                    ======================================================== */}
                    {activeCategory === 'interface' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4 4 4 0 014-4c.78 0 1.5.22 2.11.6L12 11l6.89-6.89a2 2 0 112.83 2.83L14.83 13.82c.38.61.6 1.33.6 2.18a4 4 0 01-4 4 4 4 0 01-4-4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Theme Studio & Desktop Experience</h3>
                                    <p className="text-[11px] text-[var(--text-secondary)]">Live theme previews, interface styling, language options, and background tray behavior.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-6">
                                {/* THEME STUDIO CARDS WITH INTERACTIVE MOCKUP PREVIEWS */}
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[var(--text-primary)]">Theme Palette</span>
                                        <span className="text-[10px] font-mono text-[var(--text-secondary)]">Click to apply instantly</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {[
                                            {
                                                id: 'violet' as const,
                                                title: 'Dark Violet',
                                                description: 'Cosmic indigo & violet neon',
                                                bgDark: '#09090e',
                                                surface: '#12121c',
                                                accentGrad: 'from-blue-500 to-purple-600',
                                                glow: 'shadow-purple-500/20'
                                            },
                                            {
                                                id: 'midnight' as const,
                                                title: 'Midnight Slate',
                                                description: 'Stealth navy with cyan glow',
                                                bgDark: '#030712',
                                                surface: '#0f172a',
                                                accentGrad: 'from-sky-500 to-cyan-500',
                                                glow: 'shadow-cyan-500/20'
                                            },
                                            {
                                                id: 'cyberpunk' as const,
                                                title: 'Cyberpunk Neon',
                                                description: 'High contrast pink & teal',
                                                bgDark: '#0d0221',
                                                surface: '#190430',
                                                accentGrad: 'from-pink-500 to-cyan-400',
                                                glow: 'shadow-pink-500/20'
                                            },
                                            {
                                                id: 'light' as const,
                                                title: 'Light Frost',
                                                description: 'Clean modern daylight theme',
                                                bgDark: '#f8fafc',
                                                surface: '#ffffff',
                                                accentGrad: 'from-blue-600 to-indigo-600',
                                                glow: 'shadow-blue-500/20'
                                            }
                                        ].map((thm) => {
                                            const isSelected = settings.theme === thm.id
                                            return (
                                                <button
                                                    key={thm.id}
                                                    type="button"
                                                    onClick={() => handleThemeChange(thm.id)}
                                                    className={`cursor-pointer group flex flex-col rounded-2xl border p-3.5 transition-all text-left relative overflow-hidden ${isSelected
                                                        ? `border-[var(--border-highlight)] bg-[var(--bg-card)] shadow-xl ${thm.glow} scale-[1.02]`
                                                        : 'border-[var(--border-color)] bg-[var(--bg-card)]/40 hover:border-[var(--border-highlight)] hover:bg-[var(--bg-card)]'
                                                        }`}
                                                >
                                                    {/* MINI APP WINDOW MOCKUP */}
                                                    <div
                                                        className="h-20 w-full rounded-xl p-2 flex flex-col justify-between mb-3 border border-white/10 shadow-inner"
                                                        style={{ backgroundColor: thm.bgDark }}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex gap-1">
                                                                <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                                <div className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                            </div>
                                                            <div className={`h-1.5 w-8 rounded-full bg-gradient-to-r ${thm.accentGrad}`} />
                                                        </div>

                                                        {/* Mini Mock Dashboard */}
                                                        <div className="flex gap-1.5 h-10 items-stretch">
                                                            <div className="w-5 rounded-md border border-white/10" style={{ backgroundColor: thm.surface }} />
                                                            <div className="flex-1 rounded-md p-1 border border-white/10 flex flex-col justify-between" style={{ backgroundColor: thm.surface }}>
                                                                <div className="h-1 w-10 bg-white/30 rounded-xs" />
                                                                <div className={`h-1.5 w-full rounded-xs bg-gradient-to-r ${thm.accentGrad}`} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-[var(--text-primary)]">{thm.title}</span>
                                                        {isSelected && (
                                                            <span className="text-[9px] font-mono font-bold text-white bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat px-1.5 py-0.5 rounded-md">
                                                                Active
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] text-[var(--text-secondary)] mt-0.5">{thm.description}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* Language Selector */}
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div>
                                        <span className="text-xs font-bold text-[var(--text-primary)] block">Localization & Language</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Regional translations and UI language formatting</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {availableLocales.map((loc) => (
                                            <button
                                                key={loc.code}
                                                type="button"
                                                onClick={() => setLocale(loc.code)}
                                                className={`cursor-pointer flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${currentLocale === loc.code
                                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-no-repeat text-white border-transparent shadow-xs'
                                                    : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                <span>{loc.code === 'EnglishUS' ? '🇺🇸' : '🇬🇷'}</span>
                                                <span>{loc.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* System Tray & Desktop Behavior (CUSTOM TOGGLES) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Close to System Tray</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Keep app alive in tray when closing main window</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.closeToTray}
                                            onChange={(c) => updateSetting('closeToTray', c)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Desktop Notifications</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Send native OS notifications on download finish</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.notifyOnCompletion}
                                            onChange={(c) => updateSetting('notifyOnCompletion', c)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Start With System Boot</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Launch minimized in tray on computer startup</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.startOnBoot}
                                            onChange={(c) => updateSetting('startOnBoot', c)}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                        <div className="pr-2">
                                            <span className="text-xs font-bold text-[var(--text-primary)] block">Hardware Acceleration</span>
                                            <span className="text-[10px] text-[var(--text-secondary)]">Utilize GPU for rendering & smooth decoding</span>
                                        </div>
                                        <ToggleSwitch
                                            checked={settings.hardwareAcceleration}
                                            onChange={(c) => updateSetting('hardwareAcceleration', c)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================
                        TAB 6: STORAGE MAINTENANCE & LIBRARY HEALTH
                    ======================================================== */}
                    {activeCategory === 'maintenance' && (
                        <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl backdrop-blur-2xl animate-in fade-in duration-200">
                            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-4 mb-5">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-[var(--text-primary)]">Storage Maintenance & Library Health</h3>
                                    <p className="text-[11px] text-[var(--text-secondary)]">Purge orphaned temporary chunks, audit download checksums, and vault mode.</p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-5">
                                {/* Garbage Collector / Cache Cleaner */}
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-bold text-[var(--text-primary)]">Temporary File Cache & Garbage Collector</h4>
                                            <span className="font-mono text-[10px] text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                                                {formatBytes(cachedTempBytes)} reclaimable
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                                            Purges incomplete chunk files, video fragments, and stale platform API response caches.
                                        </p>
                                        <p className="text-[10px] font-mono text-emerald-400 mt-2">
                                            Total lifetime disk space reclaimed: {formatBytes(reclaimedBytes)}
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={handlePurgeCache}
                                        disabled={isCleaningCache || cachedTempBytes === 0}
                                        className="cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-teal-500/20 border border-teal-500/30 text-teal-300 hover:bg-teal-500/30 px-4 py-2 text-xs font-bold transition-all disabled:opacity-40 whitespace-nowrap"
                                    >
                                        {isCleaningCache ? (
                                            <>
                                                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <span>Purging Cache...</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                <span>Run Garbage Collector</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Library Integrity Scan Panel */}
                                <div className="flex flex-col gap-3 p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-xs font-bold text-[var(--text-primary)]">Course Library Health Check</h4>
                                            <p className="text-[11px] text-[var(--text-secondary)]">Verify that downloaded MP4 videos and resources are uncorrupted on disk.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRunIntegrityScan}
                                            disabled={isIntegrityScanning}
                                            className="cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/30 px-4 py-2 text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                                        >
                                            {isIntegrityScanning ? 'Verifying Hashes...' : 'Scan Library Files'}
                                        </button>
                                    </div>

                                    {isIntegrityScanning && (
                                        <div className="flex flex-col gap-1 pt-2 animate-in fade-in duration-150">
                                            <div className="flex justify-between text-[11px] font-mono text-[var(--text-secondary)]">
                                                <span>Scanning checksums...</span>
                                                <span>{integrityScanProgress}%</span>
                                            </div>
                                            <div className="h-2 w-full bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border-color)]">
                                                <div
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 bg-no-repeat transition-all duration-300"
                                                    style={{ width: `${integrityScanProgress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {hasScannedIntegrity && !isIntegrityScanning && (
                                        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold animate-in fade-in duration-200">
                                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>All local course files and lectures are 100% verified and healthy.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Vault Mode (Security & Privacy with CUSTOM TOGGLE) */}
                                <div className="flex items-center justify-between p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
                                    <div className="pr-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-purple-300">Vault Mode (Private Learning)</span>
                                            <span className="rounded-full bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-[9px] font-mono text-purple-300 font-bold">Encrypted DB</span>
                                        </div>
                                        <span className="text-[11px] text-[var(--text-secondary)]">Hide course names from system logs and require app authentication on launch</span>
                                    </div>
                                    <ToggleSwitch
                                        checked={settings.vaultMode}
                                        onChange={(c) => updateSetting('vaultMode', c)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
