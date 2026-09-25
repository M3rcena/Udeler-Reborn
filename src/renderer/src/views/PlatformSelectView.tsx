import { WindowControls } from '@renderer/components/WindowControls'
import type { PlatformId, PlatformSession } from '@shared/types'
import React, { useEffect, useState } from 'react'
import { BrandLogo } from '../components/brand/BrandLogo'
import { PlatformIcon } from '../components/brand/PlatformIcons'
import { useI18n } from '../contexts/I18nContext'

export type AppTheme = 'violet' | 'midnight' | 'cyberpunk' | 'light'

interface PlatformMeta {
    id: PlatformId
    name: string
    colorFrom: string
    colorTo: string
    domain: string
}

const AVAILABLE_PLATFORMS: PlatformMeta[] = [
    { id: 'udemy', name: 'Udemy', colorFrom: '#a435f0', colorTo: '#ec5990', domain: 'udemy.com' },
    { id: 'coursera', name: 'Coursera', colorFrom: '#0056d2', colorTo: '#00a4e4', domain: 'coursera.org' },
    { id: 'skillshare', name: 'Skillshare', colorFrom: '#00ff84', colorTo: '#00a368', domain: 'skillshare.com' },
    { id: 'edx', name: 'edX', colorFrom: '#02262b', colorTo: '#b8253b', domain: 'edx.org' }
]

const PLATFORM_ORDER: Record<PlatformId, number> = {
    udemy: 0,
    coursera: 1,
    skillshare: 2,
    edx: 3
}

interface PlatformSelectViewProps {
    onSelectPlatform: (platformId: PlatformId) => void
}

export const PlatformSelectView: React.FC<PlatformSelectViewProps> = ({ onSelectPlatform }) => {
    const { t, currentLocale, setLocale, availableLocales } = useI18n()
    const [theme, setTheme] = useState<AppTheme>('violet')
    const [profiles, setProfiles] = useState<PlatformSession[]>([])
    const [showAddModal, setShowAddModal] = useState<boolean>(false)
    const [selectedToConnect, setSelectedToConnect] = useState<PlatformMeta | null>(null)
    const [isVerifying, setIsVerifying] = useState<boolean>(false)
    const [verifyStep, setVerifyStep] = useState<string>('Awaiting authentication in browser...')
    const [isBusiness, setIsBusiness] = useState<boolean>(false)
    const [subdomain, setSubdomain] = useState<string>('')
    const [formError, setFormError] = useState<string | null>(null)

    const isAllConnected = profiles.length >= AVAILABLE_PLATFORMS.length

    useEffect(() => {
        loadActiveSessions()
    }, [])

    const loadActiveSessions = async (): Promise<void> => {
        if (window.api?.getSessions) {
            const active = await window.api.getSessions()
            const sorted = [...active].sort((a, b) => PLATFORM_ORDER[a.platformId] - PLATFORM_ORDER[b.platformId])
            setProfiles(sorted)
        }
    }

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    const handleOpenConnect = (meta: PlatformMeta): void => {
        setSelectedToConnect(meta)
        setFormError(null)
        setIsBusiness(false)
        setSubdomain('')
    }

    const handleTriggerWebLogin = async (meta: PlatformMeta): Promise<void> => {
        setIsVerifying(true)
        setFormError(null)
        setVerifyStep('Awaiting authentication in browser...')

        // Dynamic step messages while in flight
        const timer1 = setTimeout(() => {
            setVerifyStep('Interacting with gateway cookies...')
        }, 2000)

        const timer2 = setTimeout(() => {
            setVerifyStep('Resolving profile identity...')
        }, 4500)

        try {
            const result = await window.api.launchWebAuth({
                platformId: meta.id,
                isBusiness,
                subdomain: isBusiness && subdomain.trim() ? subdomain.trim() : undefined
            })

            if (result.success && result.session) {
                setProfiles((prev) => {
                    const filtered = prev.filter((p) => p.platformId !== meta.id)
                    const updated = [...filtered, result.session!]
                    return updated.sort((a, b) => PLATFORM_ORDER[a.platformId] - PLATFORM_ORDER[b.platformId])
                })
                setSelectedToConnect(null)
                setShowAddModal(false)
            } else {
                setFormError(result.error || String(t('platforms.validationError')))
            }
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : String(err))
        } finally {
            clearTimeout(timer1)
            clearTimeout(timer2)
            setIsVerifying(false)
        }
    }

    const handleRemoveProfile = async (platformId: PlatformId, e: React.MouseEvent): Promise<void> => {
        e.stopPropagation()
        if (window.api?.removeSession) {
            await window.api.removeSession(platformId)
        }
        setProfiles((prev) => prev.filter((p) => p.platformId !== platformId))
    }

    const cycleLocale = (): void => {
        const nextIdx = (availableLocales.findIndex((l) => l.code === currentLocale) + 1) % availableLocales.length
        setLocale(availableLocales[nextIdx].code)
    }

    return (
        <div className="relative flex h-screen w-full flex-col justify-between overflow-hidden bg-[var(--bg-main)] p-8 select-none transition-colors duration-500">
            <div className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 h-[650px] w-[950px] rounded-full bg-radial from-[var(--accent-from)]/20 via-[var(--accent-to)]/10 to-transparent blur-[120px] transition-all duration-700" />
            <div className="pointer-events-none absolute -bottom-56 left-1/2 -translate-x-1/2 h-[550px] w-[800px] rounded-full bg-radial from-[var(--accent-to)]/15 via-transparent to-transparent blur-[140px] transition-all duration-700" />

            <div
                className="pointer-events-none absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
                style={{
                    backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                }}
            />

            <header className="window-drag relative z-10 flex items-center justify-between border-b border-[var(--border-color)] pb-5">
                <div className="flex items-center gap-3">
                    <BrandLogo className="h-9 w-9 cursor-pointer drop-shadow-md" />
                    <div>
                        <h1 className="text-sm font-black tracking-widest text-[var(--text-primary)] uppercase">
                            {t.splash.title}{' '}
                            <span className="bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] bg-clip-text text-transparent">
                                {t.splash.subtitle}
                            </span>
                        </h1>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            {t.splash.tagline}
                        </p>
                    </div>
                </div>

                <div className="window-no-drag flex items-center gap-3">
                    <button
                        type="button"
                        onClick={cycleLocale}
                        className="cursor-pointer rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] hover:border-[var(--border-highlight)] transition-all shadow-xs backdrop-blur-md"
                    >
                        {currentLocale === 'EnglishUS' ? 'EN' : 'GR'}
                    </button>

                    <div className="flex items-center gap-1.5 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 backdrop-blur-md shadow-xs">
                        {(['violet', 'midnight', 'cyberpunk', 'light'] as AppTheme[]).map((thm) => (
                            <button
                                key={thm}
                                type="button"
                                onClick={() => setTheme(thm)}
                                title={String(t(`splash.themes.${thm}`))}
                                className={`h-3.5 w-3.5 cursor-pointer rounded-full transition-all ${theme === thm
                                    ? 'scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-black/50'
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

                    <div className="ml-1 pl-3 border-l border-[var(--border-color)]">
                        <WindowControls />
                    </div>
                </div>
            </header>

            <main className="relative z-10 my-auto flex flex-col items-center justify-center py-6">
                <div className="text-center mb-12">
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--text-primary)] drop-shadow-sm">
                        {t.platforms.chooseTitle}
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed font-medium">
                        {t.platforms.chooseSubtitle}
                    </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 max-w-5xl">
                    {profiles.map((profile) => {
                        const meta = AVAILABLE_PLATFORMS.find((p) => p.id === profile.platformId)!
                        return (
                            <div
                                key={profile.platformId}
                                onClick={() => onSelectPlatform(profile.platformId)}
                                className="group relative flex flex-col items-center cursor-pointer"
                            >
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveProfile(profile.platformId, e)}
                                    title={String(t('platforms.removePlatform'))}
                                    className="absolute -top-1.5 -right-1.5 z-30 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-rose-500/90 text-[10px] font-bold text-white opacity-0 shadow-xl backdrop-blur-md transition-all duration-200 group-hover:opacity-100 hover:scale-110 hover:bg-rose-600"
                                >
                                    ✕
                                </button>

                                <div className="relative flex h-28 w-28 sm:h-34 sm:w-34 items-center justify-center rounded-full p-2 transition-all duration-300 group-hover:scale-105">
                                    <div
                                        className="absolute inset-1 rounded-full opacity-35 blur-xl transition-all duration-400 group-hover:opacity-85 group-hover:blur-2xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${meta.colorFrom}, ${meta.colorTo})`
                                        }}
                                    />

                                    <div
                                        className="absolute inset-0 rounded-full border-2 transition-all duration-300 group-hover:shadow-[0_0_25px_rgba(255,255,255,0.25)]"
                                        style={{
                                            borderColor: meta.colorFrom
                                        }}
                                    />

                                    <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[var(--bg-surface)] p-4.5 shadow-2xl backdrop-blur-xl border border-white/10 group-hover:border-white/25 transition-colors">
                                        <PlatformIcon
                                            platformId={meta.id}
                                            className="h-full w-full transition-transform duration-300 group-hover:scale-110 drop-shadow-md text-[var(--text-primary)]"
                                            color={meta.id === 'coursera' ? '#38bdf8' : undefined}
                                        />
                                    </div>

                                    <span className="absolute bottom-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 p-0.5 backdrop-blur-xs">
                                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                                    </span>
                                </div>

                                <div className="mt-4 flex flex-col items-center text-center">
                                    <span className="text-sm sm:text-base font-extrabold tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-from)]">
                                        {meta.name}
                                    </span>
                                    <span className="text-[11px] text-[var(--text-secondary)] font-mono max-w-[150px] truncate opacity-85 group-hover:opacity-100 transition-opacity">
                                        {profile.username}
                                    </span>
                                </div>
                            </div>
                        )
                    })}

                    {!isAllConnected && (
                        <div
                            onClick={() => {
                                setSelectedToConnect(null)
                                setShowAddModal(true)
                            }}
                            className="group flex flex-col items-center cursor-pointer"
                        >
                            <div className="relative flex h-28 w-28 sm:h-34 sm:w-34 items-center justify-center rounded-full border-2 border-dashed border-[var(--border-color)] bg-[var(--bg-card)] transition-all duration-300 group-hover:scale-105 group-hover:border-[var(--border-highlight)] group-hover:bg-[var(--bg-surface)] group-hover:shadow-[0_0_30px_var(--border-highlight)]">
                                <span className="text-3xl sm:text-4xl font-light text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
                                    +
                                </span>
                            </div>
                            <div className="mt-4 text-center">
                                <span className="text-sm sm:text-base font-bold text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-primary)]">
                                    {t.platforms.addPlatform}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <footer className="relative z-10 flex items-center justify-center border-t border-[var(--border-color)] pt-4 text-xs font-semibold text-[var(--text-secondary)] opacity-70">
                <span>Udeler-Reborn v4 • Multi-Platform Hub</span>
            </footer>

            {showAddModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={(e) => {
                        if (e.target === e.currentTarget && !isVerifying) setShowAddModal(false)
                    }}
                >
                    <div className="relative w-full max-w-lg rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 shadow-2xl backdrop-blur-2xl">
                        {!isVerifying && (
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="absolute top-5 right-5 cursor-pointer rounded-full p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)] transition-colors"
                            >
                                ✕
                            </button>
                        )}

                        {!selectedToConnect ? (
                            <div className="flex flex-col gap-5">
                                <div>
                                    <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                                        {t.platforms.addPlatformModalTitle}
                                    </h3>
                                    <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium">
                                        {t.platforms.addPlatformModalDesc}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    {AVAILABLE_PLATFORMS.map((meta) => {
                                        const isAlreadyAdded = profiles.some((p) => p.platformId === meta.id)
                                        return (
                                            <button
                                                key={meta.id}
                                                type="button"
                                                disabled={isAlreadyAdded}
                                                onClick={() => handleOpenConnect(meta)}
                                                className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${isAlreadyAdded
                                                    ? 'opacity-35 border-[var(--border-color)] cursor-not-allowed bg-black/20'
                                                    : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-[var(--border-highlight)] hover:bg-[var(--bg-surface)] cursor-pointer hover:scale-[1.02] shadow-xs'
                                                    }`}
                                            >
                                                <div
                                                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/20 p-2.5 bg-[var(--bg-main)] shadow-md"
                                                    style={{
                                                        borderColor: meta.colorFrom
                                                    }}
                                                >
                                                    <PlatformIcon
                                                        platformId={meta.id}
                                                        className="w-full h-full text-[var(--text-primary)]"
                                                        color={meta.id === 'coursera' ? '#38bdf8' : undefined}
                                                    />
                                                </div>
                                                <div className="truncate">
                                                    <span className="block text-sm font-bold text-[var(--text-primary)] truncate">
                                                        {meta.name}
                                                    </span>
                                                    <span className="block text-[11px] text-[var(--text-secondary)] font-medium">
                                                        {isAlreadyAdded ? t.words.connected : meta.domain}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        ) : isVerifying ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-5 text-center">
                                <div className="relative flex items-center justify-center">
                                    <div
                                        className="absolute h-16 w-16 rounded-full opacity-20 blur-xl animate-pulse"
                                        style={{
                                            background: `linear-gradient(135deg, ${selectedToConnect.colorFrom}, ${selectedToConnect.colorTo})`
                                        }}
                                    />
                                    <div
                                        className="h-12 w-12 rounded-full border-3 border-transparent border-t-current animate-spin"
                                        style={{ color: selectedToConnect.colorFrom }}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <h4 className="text-sm font-black text-[var(--text-primary)] tracking-wide">
                                        Connecting to {selectedToConnect.name}
                                    </h4>
                                    <p className="text-xs font-mono text-[var(--accent-from)] animate-pulse">
                                        {verifyStep}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3.5">
                                        <div
                                            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 p-2.5 bg-[var(--bg-main)] shadow-lg"
                                            style={{
                                                borderColor: selectedToConnect.colorFrom
                                            }}
                                        >
                                            <PlatformIcon
                                                platformId={selectedToConnect.id}
                                                className="w-full h-full text-[var(--text-primary)]"
                                                color={selectedToConnect.id === 'coursera' ? '#38bdf8' : undefined}
                                            />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-[var(--text-primary)] tracking-tight">
                                                {selectedToConnect.name}
                                            </h3>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedToConnect(null)}
                                                className="text-[11px] text-[var(--accent-from)] hover:underline cursor-pointer font-medium"
                                            >
                                                ← Choose a different platform
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {selectedToConnect.id === 'udemy' && (
                                    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 transition-all">
                                        <div
                                            onClick={() => setIsBusiness(!isBusiness)}
                                            className="flex cursor-pointer items-center justify-between"
                                        >
                                            <span className="text-xs font-bold text-[var(--text-primary)] select-none">
                                                {t.platforms.businessAccount}
                                            </span>
                                            <div
                                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isBusiness ? 'bg-[var(--accent-from)]' : 'bg-white/15'
                                                    }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${isBusiness ? 'translate-x-4' : 'translate-x-0'
                                                        }`}
                                                />
                                            </div>
                                        </div>

                                        {isBusiness && (
                                            <div className="flex items-center rounded-xl border border-[var(--border-color)] bg-black/40 px-3 py-2.5 text-xs animate-in fade-in slide-in-from-top-1">
                                                <span className="text-[var(--text-secondary)] font-mono">https://</span>
                                                <input
                                                    type="text"
                                                    placeholder={String(t('platforms.subdomainPlaceholder'))}
                                                    value={subdomain}
                                                    onChange={(e) => setSubdomain(e.target.value)}
                                                    className="flex-1 bg-transparent px-1 font-semibold text-[var(--text-primary)] focus:outline-none"
                                                />
                                                <span className="text-[var(--text-secondary)] font-mono">.udemy.com</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex flex-col gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleTriggerWebLogin(selectedToConnect)}
                                        className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] py-4 px-4 text-xs font-bold text-white shadow-xl transition-all hover:opacity-95 active:scale-95"
                                    >
                                        <span>{t.platforms.webLoginBtn}</span>
                                        <span>→</span>
                                    </button>

                                    {formError && (
                                        <p className="text-xs font-semibold text-rose-400 text-center">
                                            {formError}
                                        </p>
                                    )}

                                    <p className="text-center text-[11px] text-[var(--text-secondary)] leading-relaxed px-4">
                                        {t('platforms.webLoginDesc', { domain: selectedToConnect.domain })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}