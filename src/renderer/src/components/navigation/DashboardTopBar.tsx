import type { PlatformSession } from '@shared/types'
import React from 'react'
import { useI18n } from '../../contexts/I18nContext'
import type { AppTheme } from '../../views/PlatformSelectView'
import { PlatformIcon } from '../brand/PlatformIcons'
import { WindowControls } from '../WindowControls'
import type { DashboardTab } from './DashboardSidebar'

interface DashboardTopBarProps {
  session: PlatformSession
  activeTab: DashboardTab
  theme: AppTheme
  onThemeChange: (theme: AppTheme) => void
}

export const DashboardTopBar: React.FC<DashboardTopBarProps> = ({
  session,
  activeTab,
  theme,
  onThemeChange
}) => {
  const { currentLocale, setLocale, availableLocales } = useI18n()

  const cycleLocale = (): void => {
    const nextIdx = (availableLocales.findIndex((l) => l.code === currentLocale) + 1) % availableLocales.length
    setLocale(availableLocales[nextIdx].code)
  }

  const tabTitles: Record<DashboardTab, string> = {
    courses: 'Course Library',
    downloads: 'Downloads Manager',
    settings: 'Preferences',
    about: 'System Diagnostics'
  }

  return (
    <header className="window-drag relative z-20 mx-4 mt-3.5 flex h-14 shrink-0 items-center justify-between rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)]/85 px-5 shadow-xl backdrop-blur-2xl">
      {/* LEFT: STATUS CAPSULE */}
      <div className="window-no-drag flex items-center gap-3">
        <div className="flex items-center gap-2.5 rounded-2xl border border-white/5 bg-[var(--bg-card)] px-3 py-1.5 shadow-inner">
          <div className="h-4 w-4">
            <PlatformIcon
              platformId={session.platformId}
              className="h-full w-full text-[var(--text-primary)]"
              color="currentColor"
            />
          </div>
          <span className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">
            {tabTitles[activeTab]}
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            / {session.platformId}
          </span>
        </div>
      </div>

      {/* RIGHT: CONTROL MATRIX */}
      <div className="window-no-drag flex items-center gap-3">
        {/* LOCALE SELECTOR */}
        <button
          type="button"
          onClick={cycleLocale}
          className="cursor-pointer rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-black tracking-wider text-[var(--text-secondary)] uppercase transition-all hover:border-[var(--border-highlight)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] shadow-xs"
        >
          {currentLocale === 'EnglishUS' ? 'EN' : 'GR'}
        </button>

        {/* THEME PICKER DOTS */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1 shadow-inner">
          {(['violet', 'midnight', 'cyberpunk', 'light'] as AppTheme[]).map((thm) => (
            <button
              key={thm}
              type="button"
              onClick={() => onThemeChange(thm)}
              className={`cursor-pointer h-3.5 w-3.5 rounded-full transition-all ${theme === thm
                  ? 'scale-125 ring-2 ring-white/80 ring-offset-1 ring-offset-black/50 shadow-md'
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

        {/* WINDOW CONTROLS */}
        <div className="ml-1 pl-3 border-l border-[var(--border-color)]">
          <WindowControls />
        </div>
      </div>
    </header>
  )
}