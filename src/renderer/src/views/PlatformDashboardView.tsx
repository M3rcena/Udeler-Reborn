import type { AppSettings, CourseFilterStatus, CourseItem, CourseSortOption, PlatformSession } from '@shared/types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PlatformIcon } from '../components/brand/PlatformIcons'
import { DashboardSidebar, DashboardTab } from '../components/navigation/DashboardSidebar'
import { DashboardTopBar } from '../components/navigation/DashboardTopBar'
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeleton'
import { CustomDropdown, DropdownOption } from '../components/ui/CustomDropdown'
import { AboutView } from './AboutView'
import type { AppTheme } from './PlatformSelectView'
import { SettingsView } from './SettingsView'

interface PlatformDashboardViewProps {
    session: PlatformSession
    onBackToPlatforms: () => void
    onSelectCourse: (course: CourseItem) => void
    initialTab?: DashboardTab
}

const SORT_OPTIONS: DropdownOption<CourseSortOption>[] = [
    { value: 'recent', label: 'Recently Accessed' },
    { value: 'title', label: 'Course Title (A-Z)' },
    { value: 'progress', label: 'Completion %' },
    { value: 'lectures', label: 'Lecture Count' }
]

export const PlatformDashboardView: React.FC<PlatformDashboardViewProps> = ({
    session,
    onBackToPlatforms,
    onSelectCourse,
    initialTab
}) => {
    const [activeTab, setActiveTab] = useState<DashboardTab>(initialTab || 'courses')

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab)
        }
    }, [initialTab])

    useEffect(() => {
        if (!window.api?.onJumpListNavigate) return

        const unsubscribe = window.api.onJumpListNavigate((target) => {
            if (target.view && ['courses', 'downloads', 'settings', 'about'].includes(target.view)) {
                setActiveTab(target.view as DashboardTab)
            }
        })

        return () => {
            unsubscribe?.()
        }
    }, [])
    const [theme, setTheme] = useState<AppTheme>(
        (document.documentElement.getAttribute('data-theme') as AppTheme) || 'violet'
    )
    const [loading, setLoading] = useState<boolean>(true)
    const [courses, setCourses] = useState<CourseItem[]>([])
    const [activeFilter, setActiveFilter] = useState<CourseFilterStatus>('all')
    const [sortBy, setSortBy] = useState<CourseSortOption>('recent')
    const [isSettingsDirty, setIsSettingsDirty] = useState<boolean>(false)
    const [pendingTab, setPendingTab] = useState<DashboardTab | null>(null)
    const [pendingSwitchPlatform, setPendingSwitchPlatform] = useState<boolean>(false)
    const [showUnsavedTabModal, setShowUnsavedTabModal] = useState<boolean>(false)
    const unsavedSettingsRef = useRef<AppSettings | null>(null)
    const [userSettings, setUserSettings] = useState<AppSettings | null>(null)

    const handleSettingsDirtyChange = useCallback((dirty: boolean, unsaved?: AppSettings) => {
        setIsSettingsDirty(dirty)
        if (unsaved) {
            unsavedSettingsRef.current = unsaved
        }
    }, [])

    const handleSettingsSaved = useCallback((saved: AppSettings) => {
        setUserSettings(saved)
        if (saved.theme) {
            setTheme(saved.theme)
        }
    }, [])

    const handleThemePreview = useCallback((newTheme: AppTheme) => {
        setTheme(newTheme)
    }, [])

    // Sync saved settings on mount and when changed
    useEffect(() => {
        let mounted = true
        if (window.api?.getSettings) {
            window.api.getSettings().then((s) => {
                if (mounted && s) {
                    setUserSettings(s)
                    if (s.theme) {
                        setTheme(s.theme)
                        document.documentElement.setAttribute('data-theme', s.theme)
                    }
                }
            }).catch(console.error)
        }

        const unsubscribe = window.api?.onSettingsChanged?.((s) => {
            if (mounted && s) {
                setUserSettings(s)
                if (s.theme) {
                    setTheme(s.theme)
                    document.documentElement.setAttribute('data-theme', s.theme)
                }
            }
        })

        return () => {
            mounted = false
            unsubscribe?.()
        }
    }, [])

    // Update Discord Presence when active dashboard tab or platform changes
    useEffect(() => {
        if (!window.api?.updateDiscordActivity) return

        if (activeTab === 'courses') {
            window.api.updateDiscordActivity({
                platformId: session.platformId,
                status: 'browsing',
                stateText: 'Course Library'
            })
        } else if (activeTab === 'downloads') {
            window.api.updateDiscordActivity({
                platformId: session.platformId,
                status: 'downloading',
                stateText: 'Downloads Manager'
            })
        } else if (activeTab === 'settings') {
            window.api.updateDiscordActivity({
                platformId: session.platformId,
                status: 'settings',
                stateText: 'Configuring Preferences'
            })
        } else {
            window.api.updateDiscordActivity({
                platformId: session.platformId,
                status: 'idle',
                stateText: 'Viewing Diagnostics'
            })
        }
    }, [activeTab, session.platformId])

    const handleSelectTab = (tab: DashboardTab): void => {
        if (tab === activeTab) return
        if (activeTab === 'settings' && isSettingsDirty) {
            setPendingTab(tab)
            setShowUnsavedTabModal(true)
        } else {
            setActiveTab(tab)
        }
    }

    const handleSwitchPlatformRequest = (): void => {
        if (activeTab === 'settings' && isSettingsDirty) {
            setPendingSwitchPlatform(true)
            setShowUnsavedTabModal(true)
        } else {
            onBackToPlatforms()
        }
    }

    const handleSaveAndSwitchTab = async (): Promise<void> => {
        if (unsavedSettingsRef.current && window.api?.updateSettings) {
            try {
                const saved = await window.api.updateSettings(unsavedSettingsRef.current)
                setUserSettings(saved)
                if (saved.theme) {
                    setTheme(saved.theme)
                    document.documentElement.setAttribute('data-theme', saved.theme)
                }
            } catch (err) {
                console.error('Failed to save settings before switching view:', err)
            }
        }
        setIsSettingsDirty(false)
        if (pendingSwitchPlatform) {
            setPendingSwitchPlatform(false)
            onBackToPlatforms()
        } else if (pendingTab) {
            setActiveTab(pendingTab)
            setPendingTab(null)
        }
        setShowUnsavedTabModal(false)
    }

    const handleDiscardAndSwitchTab = (): void => {
        setIsSettingsDirty(false)
        // REVERT theme back to saved settings if user had changed it in draft!
        if (userSettings?.theme) {
            setTheme(userSettings.theme)
            document.documentElement.setAttribute('data-theme', userSettings.theme)
        }
        if (pendingSwitchPlatform) {
            setPendingSwitchPlatform(false)
            onBackToPlatforms()
        } else if (pendingTab) {
            setActiveTab(pendingTab)
            setPendingTab(null)
        }
        setShowUnsavedTabModal(false)
    }

    const handleCancelTabSwitch = (): void => {
        setPendingTab(null)
        setPendingSwitchPlatform(false)
        setShowUnsavedTabModal(false)
    }

    const handleThemeChange = (newTheme: AppTheme): void => {
        setTheme(newTheme)
        setUserSettings((prev) => (prev ? { ...prev, theme: newTheme } : null))
        document.documentElement.setAttribute('data-theme', newTheme)
        if (window.api?.updateSettings) {
            window.api.updateSettings({ theme: newTheme }).catch((err) => {
                console.error('Failed to persist theme:', err)
            })
        }
    }

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

    useEffect(() => {
        loadPlatformCourses()
    }, [session.platformId])

    const loadPlatformCourses = async (): Promise<void> => {
        setLoading(true)
        try {
            if (window.api?.getCourses) {
                const res = await window.api.getCourses(session.platformId)
                setCourses(res)
            } else {
                await new Promise((resolve) => setTimeout(resolve, 1200))
                setCourses([])
            }
        } catch (err: unknown) {
            console.error('Failed to load courses:', err)
            setCourses([])
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600)
        return hours > 0 ? `${hours}h` : `${Math.floor(seconds / 60)}m`
    }

    const filteredCourses = courses
        .filter((c) => {
            if (activeFilter === 'downloaded') return c.isDownloaded
            if (activeFilter === 'in-progress') return c.progressPercent > 0 && c.progressPercent < 100
            if (activeFilter === 'completed') return c.progressPercent === 100
            return true
        })
        .sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title)
            if (sortBy === 'progress') return b.progressPercent - a.progressPercent
            if (sortBy === 'lectures') return b.totalLectures - a.totalLectures
            return (b.lastAccessedAt || 0) - (a.lastAccessedAt || 0)
        })

    return (
        <div className="relative flex h-screen w-full overflow-hidden bg-[var(--bg-main)] select-none">
            {/* AMBIENT RADIAL LIGHTS */}
            <div className="pointer-events-none absolute -top-40 left-1/4 h-[550px] w-[800px] rounded-full bg-radial from-[var(--accent-from)]/20 via-transparent to-transparent blur-[140px]" />
            <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[550px] w-[800px] rounded-full bg-radial from-[var(--accent-to)]/15 via-transparent to-transparent blur-[140px]" />

            {/* 1. MODULAR FLOATING STACK SIDEBAR */}
            <DashboardSidebar
                session={session}
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                courses={courses}
                activeFilter={activeFilter}
                onSelectFilter={setActiveFilter}
                onSwitchPlatform={handleSwitchPlatformRequest}
            />

            {/* 2. WORKSPACE AREA */}
            <div className="relative flex flex-1 flex-col overflow-hidden">
                {/* DETACHED TOP BAR HUD */}
                <DashboardTopBar
                    session={session}
                    activeTab={activeTab}
                    theme={theme}
                    onThemeChange={handleThemeChange}
                />

                {/* WORKSPACE CONTENT CONTAINER */}
                <main className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
                    {activeTab === 'courses' ? (
                        <div className="flex flex-1 flex-col overflow-hidden px-6 pt-4 pb-6 gap-5">
                            {/* SORT & FILTER BAR */}
                            <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    {(['all', 'in-progress', 'downloaded', 'completed'] as CourseFilterStatus[]).map((tab) => {
                                        const isActive = activeFilter === tab
                                        return (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setActiveFilter(tab)}
                                                className={`cursor-pointer rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-all ${isActive
                                                    ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-md shadow-[var(--accent-from)]/25'
                                                    : 'border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-[var(--border-highlight)] hover:text-[var(--text-primary)]'
                                                    }`}
                                            >
                                                {tab.replace('-', ' ')}
                                            </button>
                                        )
                                    })}
                                </div>

                                <CustomDropdown
                                    prefixLabel="Sort by:"
                                    value={sortBy}
                                    options={SORT_OPTIONS}
                                    onChange={(val) => setSortBy(val)}
                                />
                            </div>

                            {/* CARD GRID OR SKELETON */}
                            {loading ? (
                                <DashboardSkeleton />
                            ) : filteredCourses.length === 0 ? (
                                <div className="flex flex-1 flex-col items-center justify-center gap-3.5 text-center p-8">
                                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-inner">
                                        <PlatformIcon
                                            platformId={session.platformId}
                                            className="h-8 w-8 text-[var(--text-secondary)] opacity-50"
                                            color="currentColor"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                                            {activeFilter === 'downloaded'
                                                ? 'No downloaded courses found'
                                                : activeFilter === 'in-progress'
                                                    ? 'No courses in progress'
                                                    : 'No courses found'}
                                        </h3>
                                        <p className="mt-1 text-xs text-[var(--text-secondary)] max-w-sm">
                                            {activeFilter === 'downloaded'
                                                ? "You haven't saved any courses offline yet."
                                                : 'No enrolled courses match the current filter.'}
                                        </p>
                                    </div>
                                    {activeFilter !== 'all' ? (
                                        <button
                                            type="button"
                                            onClick={() => setActiveFilter('all')}
                                            className="cursor-pointer mt-2 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
                                        >
                                            Show All Courses
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={loadPlatformCourses}
                                            className="cursor-pointer mt-2 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] px-4 py-2 text-xs font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
                                        >
                                            Sync Courses
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
                                    {userSettings?.cardLayout === 'compact' ? (
                                        <div className="flex flex-col gap-2.5 pb-6">
                                            {filteredCourses.map((course) => (
                                                <div
                                                    key={course.id}
                                                    onClick={() => onSelectCourse(course)}
                                                    className="group flex items-center justify-between gap-4 p-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-highlight)] hover:bg-[var(--bg-card)] transition-all cursor-pointer shadow-sm"
                                                >
                                                    <div className="flex items-center gap-3.5 min-w-0">
                                                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black/40">
                                                            <img
                                                                src={course.thumbnailUrl}
                                                                alt={course.title}
                                                                className="h-full w-full object-cover"
                                                            />
                                                            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 font-mono text-[9px] font-bold text-white">
                                                                {formatDuration(course.totalDurationSeconds)}
                                                            </span>
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                {userSettings?.showPlatformBadge && (
                                                                    <span className="rounded-md bg-[var(--accent-from)]/15 border border-[var(--accent-from)]/30 px-1.5 py-0.5 text-[9px] font-extrabold text-[var(--accent-from)] uppercase">
                                                                        {session.platformId}
                                                                    </span>
                                                                )}
                                                                <h4 className="truncate text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-from)] transition-colors">
                                                                    {course.title}
                                                                </h4>
                                                            </div>
                                                            <p className="mt-1 text-[11px] text-[var(--text-secondary)] truncate">
                                                                {course.instructors.map((i) => i.name).join(', ') || 'Instructor'} • {course.totalLectures} lectures
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4 shrink-0">
                                                        {course.isDownloaded && (
                                                            <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                                LOCAL
                                                            </span>
                                                        )}
                                                        <div className="w-28 hidden sm:block">
                                                            <div className="flex justify-between text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                                                                <span>Progress</span>
                                                                <span>{course.progressPercent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] transition-all duration-300"
                                                                    style={{ width: `${course.progressPercent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-5 pb-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                            {filteredCourses.map((course) => (
                                                <div
                                                    key={course.id}
                                                    onClick={() => onSelectCourse(course)}
                                                    className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md backdrop-blur-xl transition-all duration-200 hover:-translate-y-1 hover:border-[var(--border-highlight)] hover:shadow-xl cursor-pointer"
                                                >
                                                    {/* THUMBNAIL BANNER */}
                                                    <div className="relative aspect-video w-full overflow-hidden bg-black/40">
                                                        <img
                                                            src={course.thumbnailUrl}
                                                            alt={course.title}
                                                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                        <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-xs">
                                                            {formatDuration(course.totalDurationSeconds)}
                                                        </span>
                                                        {userSettings?.showPlatformBadge && (
                                                            <span className="absolute top-2 right-2 rounded-md bg-black/60 border border-white/10 px-2 py-0.5 font-sans text-[9px] font-extrabold text-white uppercase backdrop-blur-xs">
                                                                {session.platformId}
                                                            </span>
                                                        )}
                                                        {course.isDownloaded && (
                                                            <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-[9px] font-extrabold text-white backdrop-blur-xs shadow-md">
                                                                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                                                LOCAL
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* BODY CONTENT */}
                                                    <div className="flex flex-1 flex-col justify-between p-4 gap-3">
                                                        <div>
                                                            <h4 className="line-clamp-2 text-xs font-black tracking-tight text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-from)]">
                                                                {course.title}
                                                            </h4>
                                                            <p className="mt-1 text-[11px] text-[var(--text-secondary)] truncate">
                                                                {course.instructors.map((i) => i.name).join(', ') || 'Instructor'}
                                                            </p>
                                                        </div>

                                                        {/* PROGRESS BAR */}
                                                        <div className="space-y-1.5 border-t border-[var(--border-color)] pt-2.5">
                                                            <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)]">
                                                                <span>{course.totalLectures} lectures</span>
                                                                <span>{course.progressPercent}%</span>
                                                            </div>
                                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                                                <div
                                                                    className="h-full rounded-full bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] transition-all duration-300"
                                                                    style={{ width: `${course.progressPercent}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : activeTab === 'settings' ? (
                        <SettingsView
                            initialSettings={userSettings || undefined}
                            onDirtyChange={handleSettingsDirtyChange}
                            onThemeChange={handleThemePreview}
                            onSaved={handleSettingsSaved}
                        />
                    ) : activeTab === 'about' ? (
                        <AboutView />
                    ) : (
                        <div className="flex flex-1 items-center justify-center p-8 text-center text-xs text-[var(--text-secondary)]">
                            <span>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} view ready for implementation.</span>
                        </div>
                    )}
                </main>
            </div>

            {/* SIDEBAR NAVIGATION UNSAVED CHANGES MODAL */}
            {showUnsavedTabModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-150">
                    <div className="w-full max-w-md p-6 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl shadow-2xl flex flex-col gap-4 text-center animate-in zoom-in-95 duration-150">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-[var(--text-primary)]">Unsaved Settings</h3>
                            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                                You have unsaved changes in Settings. Do you want to save them before leaving, or discard and switch?
                            </p>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            <button
                                type="button"
                                onClick={handleCancelTabSwitch}
                                className="cursor-pointer flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-2.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                            >
                                Keep Editing
                            </button>
                            <button
                                type="button"
                                onClick={handleDiscardAndSwitchTab}
                                className="cursor-pointer flex-1 rounded-xl border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/20 transition-all"
                            >
                                Discard & Switch
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveAndSwitchTab}
                                className="cursor-pointer flex-1 rounded-xl bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all"
                            >
                                Save & Switch
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}