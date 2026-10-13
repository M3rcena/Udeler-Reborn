import type { CourseFilterStatus, CourseItem, PlatformSession } from '@shared/types'
import React, { useState } from 'react'
import { PlatformIcon } from '../brand/PlatformIcons'

export type DashboardTab = 'courses' | 'downloads' | 'settings' | 'about'

interface DashboardSidebarProps {
    session: PlatformSession
    activeTab: DashboardTab
    onSelectTab: (tab: DashboardTab) => void
    courses: CourseItem[]
    activeFilter: CourseFilterStatus
    onSelectFilter: (filter: CourseFilterStatus) => void
    onSwitchPlatform: () => void
}

interface NavItemDef {
    id: DashboardTab
    label: string
    icon: string
    badge?: number
}

interface QuickViewDef {
    id: CourseFilterStatus
    label: string
    count: number
    barColor: string
    badgeColor: string
    icon: string
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
    session,
    activeTab,
    onSelectTab,
    courses,
    activeFilter,
    onSelectFilter,
    onSwitchPlatform
}) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

    const downloadedCount = courses.filter((c) => c.isDownloaded).length
    const inProgressCount = courses.filter((c) => c.progressPercent > 0 && c.progressPercent < 100).length

    const navItems: NavItemDef[] = [
        {
            id: 'courses',
            label: 'Course Library',
            icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
            badge: courses.length > 0 ? courses.length : undefined
        },
        {
            id: 'downloads',
            label: 'Downloads',
            icon: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
        },
        {
            id: 'settings',
            label: 'Settings',
            icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
        },
        {
            id: 'about',
            label: 'About & Logs',
            icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
        }
    ]

    const quickViews: QuickViewDef[] = [
        {
            id: 'all',
            label: 'All Courses',
            count: courses.length,
            barColor: 'from-blue-500 to-indigo-500 shadow-blue-500/50',
            badgeColor: 'text-blue-300 bg-blue-500/15 border-blue-500/20',
            icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z'
        },
        {
            id: 'in-progress',
            label: 'In Progress',
            count: inProgressCount,
            barColor: 'from-amber-400 to-orange-500 shadow-amber-500/50',
            badgeColor: 'text-amber-300 bg-amber-500/15 border-amber-500/20',
            icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
        },
        {
            id: 'downloaded',
            label: 'Downloaded',
            count: downloadedCount,
            barColor: 'from-emerald-400 to-teal-500 shadow-emerald-500/50',
            badgeColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20',
            icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        }
    ]

    const userInitial = session.username ? session.username.charAt(0).toUpperCase() : 'U'

    return (
        <aside
            className={`relative z-30 flex h-full shrink-0 flex-col gap-3.5 p-3.5 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-24' : 'w-72'
                }`}
        >
            {/* TOP SECTION: IDENTITY, NAVIGATION & QUICK VIEWS */}
            <div className="flex flex-col gap-3">
                {/* BOX 1: PLATFORM IDENTITY & COLLAPSE TOGGLE */}
                <div
                    className={`flex shrink-0 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5 shadow-xl backdrop-blur-xl transition-all duration-300 ${isCollapsed
                            ? 'flex-col items-center justify-center gap-2'
                            : 'flex-row items-center justify-between'
                        }`}
                >
                    <div
                        className={`flex items-center overflow-hidden transition-all duration-300 ${isCollapsed ? 'justify-center w-full gap-0' : 'gap-2.5'
                            }`}
                    >
                        {/* Platform Icon - explicitly centered */}
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-inner">
                            <PlatformIcon
                                platformId={session.platformId}
                                className="h-full w-full text-[var(--text-primary)]"
                                color="currentColor"
                            />
                        </div>

                        {/* Platform title details - cleanly collapses with 0 margin */}
                        <div
                            className={`flex flex-col justify-center overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed
                                    ? 'max-w-0 opacity-0 pointer-events-none m-0 p-0'
                                    : 'max-w-[130px] opacity-100 ml-0.5'
                                }`}
                        >
                            <span className="block text-xs font-black tracking-wider text-[var(--text-primary)] uppercase truncate">
                                {session.platformId}
                            </span>
                            <span className="block font-mono text-[10px] text-[var(--text-secondary)] truncate">
                                {session.isBusiness ? 'Enterprise' : 'Personal'}
                            </span>
                        </div>
                    </div>

                    {/* Expand / Collapse Button - explicitly centered */}
                    <button
                        type="button"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="cursor-pointer flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                        >
                            <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
                        </svg>
                    </button>
                </div>

                {/* BOX 2: MAIN NAVIGATION */}
                <div
                    className={`flex shrink-0 flex-col gap-1.5 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2 shadow-xl backdrop-blur-xl ${isCollapsed ? 'items-center' : ''
                        }`}
                >
                    <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-6 px-3 pt-1 pb-1 opacity-100'
                            }`}
                    >
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            Navigation
                        </span>
                    </div>

                    {navItems.map((item) => {
                        const isActive = activeTab === item.id
                        return (
                            <div key={item.id} className="relative group w-full flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => onSelectTab(item.id)}
                                    className={`cursor-pointer flex items-center rounded-2xl transition-all duration-200 ${isCollapsed
                                        ? 'h-10 w-10 justify-center'
                                        : 'w-full justify-between px-3 py-2.5'
                                        } ${isActive
                                            ? 'bg-gradient-to-r from-[var(--accent-from)] to-[var(--accent-to)] text-white shadow-md'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                                        }`}
                                    title={isCollapsed ? undefined : item.label}
                                >
                                    <div className={`flex items-center overflow-hidden ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                                        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                                        </svg>
                                        <span
                                            className={`text-xs font-semibold whitespace-nowrap overflow-hidden text-left truncate transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[130px] opacity-100'
                                                }`}
                                        >
                                            {item.label}
                                        </span>
                                    </div>

                                    <div
                                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-10 opacity-100'
                                            }`}
                                    >
                                        {item.badge !== undefined && (
                                            <span
                                                className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-[var(--text-secondary)]'
                                                    }`}
                                            >
                                                {item.badge}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {isCollapsed && (
                                    <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-2xl backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                                        {item.label} {item.badge !== undefined ? `(${item.badge})` : ''}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* BOX 3: QUICK VIEWS */}
                <div
                    className={`flex shrink-0 flex-col rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl backdrop-blur-xl transition-all duration-300 ${isCollapsed ? 'items-center gap-2 p-2 py-3' : 'gap-1.5 p-2.5'
                        }`}
                >
                    <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-6 px-3 pt-1 pb-1 opacity-100'
                            }`}
                    >
                        <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                            Quick Views
                        </span>
                    </div>

                    {quickViews.map((f) => {
                        const isFilterActive = activeFilter === f.id
                        return (
                            <div key={f.id} className="relative group w-full flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectTab('courses')
                                        onSelectFilter(f.id)
                                    }}
                                    className={`cursor-pointer relative flex items-center rounded-2xl transition-all duration-200 overflow-hidden ${isCollapsed
                                        ? 'h-10 w-10 justify-center'
                                        : 'w-full justify-between pl-3 pr-2.5 py-2.5'
                                        } ${isFilterActive
                                            ? 'border border-[var(--border-highlight)] bg-[var(--bg-card)] text-[var(--text-primary)] font-bold shadow-xs'
                                            : 'border border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]'
                                        }`}
                                    title={isCollapsed ? undefined : f.label}
                                >
                                    {/* Left Accent Glow Bar (Only visible when expanded) */}
                                    <span
                                        className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b ${f.barColor} transition-all duration-300 ${!isCollapsed && isFilterActive ? 'opacity-100 shadow-[0_0_8px]' : 'opacity-0'
                                            }`}
                                    />

                                    <div className={`flex items-center overflow-hidden ${isCollapsed ? 'justify-center' : 'gap-3 truncate'}`}>
                                        <svg className="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                                        </svg>
                                        <span
                                            className={`text-xs truncate transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-[120px] opacity-100'
                                                }`}
                                        >
                                            {f.label}
                                        </span>
                                    </div>

                                    {/* Collapsed Top-Right Dot */}
                                    {isCollapsed && (
                                        <span
                                            className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-gradient-to-tr ${f.barColor} ring-2 ring-[var(--bg-surface)]`}
                                        />
                                    )}

                                    {/* Expanded Counter Pill */}
                                    <div
                                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0' : 'max-w-10 opacity-100'
                                            }`}
                                    >
                                        <span
                                            className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] font-bold tracking-tight shadow-xs transition-colors ${isFilterActive
                                                ? f.badgeColor
                                                : 'border-white/5 bg-white/5 text-[var(--text-secondary)]'
                                                }`}
                                        >
                                            {f.count}
                                        </span>
                                    </div>
                                </button>

                                {isCollapsed && (
                                    <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-2xl backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                                        {f.label} ({f.count})
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* MIDDLE SECTION: GITHUB SPONSOR (Styled Hero Mesh Card) */}
            <div className="flex-1 min-h-[110px] flex flex-col justify-end">
                {isCollapsed ? (
                    <div className="relative group mx-auto mb-1 flex justify-center">
                        <a
                            href="https://github.com/sponsors/M3rcena"
                            target="_blank"
                            rel="noreferrer"
                            className="cursor-pointer flex h-10 w-10 items-center justify-center rounded-2xl border border-pink-500/25 bg-pink-500/10 text-pink-400 hover:scale-105 hover:bg-pink-500/25 transition-all shadow-md shadow-pink-500/10"
                            title="Sponsor on GitHub"
                        >
                            <svg className="h-5 w-5 fill-current animate-pulse" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                        </a>
                        <div className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold text-pink-400 shadow-2xl backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                            Sponsor Project ❤️
                        </div>
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-3xl border border-pink-500/25 bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent p-4 shadow-xl backdrop-blur-2xl transition-all duration-300">
                        {/* Ambient Background Decorative Grid & Heart Watermark */}
                        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 text-pink-500/10">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                        </div>

                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.06]"
                            style={{
                                backgroundImage: `radial-gradient(currentColor 1px, transparent 1px)`,
                                backgroundSize: '12px 12px'
                            }}
                        />

                        <div className="relative z-10 flex flex-col justify-between h-full gap-3">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-xs">
                                        <svg className="h-3.5 w-3.5 fill-current animate-pulse" viewBox="0 0 24 24">
                                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                                        </svg>
                                    </span>
                                    <span className="text-xs font-black tracking-wide text-[var(--text-primary)]">
                                        Enjoying Udeler?
                                    </span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                    Keep the multi-platform hub alive, maintained, and open-source.
                                </p>
                            </div>

                            <a
                                href="https://github.com/sponsors/M3rcena"
                                target="_blank"
                                rel="noreferrer"
                                className="cursor-pointer group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500/30 to-purple-500/20 py-2.5 text-xs font-extrabold text-pink-200 hover:from-pink-500/40 hover:to-purple-500/30 transition-all border border-pink-500/40 shadow-lg shadow-pink-500/10 active:scale-95"
                            >
                                <span>Sponsor on GitHub</span>
                                <svg
                                    className="h-3.5 w-3.5 text-pink-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2.5}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* BOTTOM SECTION: BOX 4: USER PROFILE & SWITCH PLATFORM */}
            <div
                className={`flex shrink-0 flex-col gap-2 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5 shadow-xl backdrop-blur-xl ${isCollapsed ? 'items-center' : ''
                    }`}
            >
                <div className={`flex items-center overflow-hidden transition-all duration-300 ${isCollapsed ? 'justify-center' : 'gap-2.5 px-1'}`}>
                    <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-highlight)] bg-[var(--bg-card)] font-bold text-xs text-[var(--text-primary)] shadow-xs"
                        title={isCollapsed ? session.username : undefined}
                    >
                        {userInitial}
                    </div>
                    <div
                        className={`flex flex-col justify-center overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[130px] opacity-100'
                            }`}
                    >
                        <h3 className="truncate text-xs font-bold text-[var(--text-primary)]">
                            {session.username}
                        </h3>
                        <p className="truncate font-mono text-[10px] text-[var(--text-secondary)]">
                            Active Connection
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onSwitchPlatform}
                    className={`cursor-pointer flex h-9 items-center rounded-2xl border border-transparent text-[var(--text-secondary)] transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 ${isCollapsed ? 'w-9 justify-center' : 'w-full justify-start px-3 gap-2.5'
                        }`}
                    title={isCollapsed ? 'Switch Platform' : undefined}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="shrink-0">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span
                        className={`text-xs font-semibold whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? 'max-w-0 opacity-0 pointer-events-none' : 'max-w-[130px] opacity-100'
                            }`}
                    >
                        Switch Platform
                    </span>
                </button>
            </div>
        </aside>
    )
}