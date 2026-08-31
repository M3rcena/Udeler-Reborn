import { useI18n } from '@renderer/contexts/I18nContext'
import { appVersion } from '@renderer/version'
import React, { useEffect, useState } from 'react'

export const AboutTab: React.FC = () => {
  const { t } = useI18n()

  const [isCheckingUpdate, setIsCheckingUpdate] = useState<boolean>(false)
  const [hasChecked, setHasChecked] = useState<boolean>(false)
  const [isUpdateAvailable, setIsUpdateAvailable] = useState<boolean>(false)
  const [isHigherVersion, setIsHigherVersion] = useState<boolean>(false)
  const [latestVersion, setLatestVersion] = useState<string>('')
  const [releaseUrl, setReleaseUrl] = useState<string>('')
  const [auditStats, setAuditStats] = useState({ passedChecks: 0, anomalies: 0 })

  const handleCheckUpdate = async (): Promise<void> => {
    setIsCheckingUpdate(true)
    setHasChecked(false)

    try {
      const response = await fetch(
        'https://api.github.com/repos/M3rcena/Udeler-Reborn/releases/latest'
      )
      if (!response.ok) throw new Error('Failed to fetch from GitHub')

      const data = await response.json()
      const fetchedVersion = data.tag_name

      setLatestVersion(fetchedVersion)
      setReleaseUrl(data.html_url)

      if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) < 0) {
        setIsHigherVersion(true)
        setIsUpdateAvailable(false)
      } else if (fetchedVersion.localeCompare(appVersion, undefined, { numeric: true }) > 0) {
        setIsUpdateAvailable(true)
        setIsHigherVersion(false)
      } else {
        setIsUpdateAvailable(false)
        setIsHigherVersion(false)
      }
    } catch (error) {
      console.error('Failed to check for updates:', error)
      setIsUpdateAvailable(false)
    } finally {
      setTimeout(() => {
        setIsCheckingUpdate(false)
        setHasChecked(true)
      }, 800)
    }
  }

  useEffect(() => {
    setTimeout(() => {
      handleCheckUpdate()
    }, 0)
  }, [])

  useEffect(() => {
    window.api.invoke('get-security-audit-stats').then(setAuditStats)
    const interval = setInterval(() => {
      window.api.invoke('get-security-audit-stats').then(setAuditStats)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const openExternalLink = (url: string): void => {
    window.open(url, '_blank')
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-2">
      <div className="flex flex-col gap-6">
        {/* Top Banner / Logo Section */}
        <div className="relative p-10 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl overflow-hidden flex flex-col items-center text-center">
          {/* Background Glow */}
          <div className="absolute top-[-50%] left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/20 dark:bg-blue-500/10 blur-[80px] rounded-full pointer-events-none"></div>

          <div className="relative w-24 h-24 bg-linear-to-tr from-blue-600 to-purple-600 rounded-3xl shadow-2xl flex items-center justify-center mb-6 transform hover:scale-105 transition-transform duration-500">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              ></path>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
          </div>

          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
            {t('views.about.app.name', {
              rebornName: (
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600">
                  Reborn
                </span>
              )
            })}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium max-w-md">
            {t.views.about.app.description}
          </p>
        </div>

        {/* Version & Updates Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative bg-linear-to-br from-white/80 to-white/30 dark:from-white/10 dark:to-white/5 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-4xl shadow-2xl overflow-hidden flex flex-col items-center text-center py-10 px-6 transition-all">
            {/* Active Animated Background Glows */}
            <div className="absolute top-[-20%] left-[-10%] w-80 h-80 bg-blue-400/30 dark:bg-blue-600/20 blur-[100px] rounded-full pointer-events-none animate-pulse duration-3000"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-80 h-80 bg-purple-400/30 dark:bg-purple-600/20 blur-[100px] rounded-full pointer-events-none animate-pulse duration-3000 delay-1000"></div>

            {/* App Icon / Gear Icon */}
            <div
              className={`relative z-10 w-24 h-24 bg-linear-to-tr from-gray-100 to-white dark:from-gray-800 dark:to-gray-900 rounded-full shadow-xl flex items-center justify-center mb-6 border border-gray-200 dark:border-gray-700 transition-all duration-500 ${isCheckingUpdate ? 'scale-95 shadow-blue-500/20' : 'scale-100'}`}
            >
              <svg
                className={`w-12 h-12 text-gray-700 dark:text-gray-300 ${isCheckingUpdate ? 'animate-spin text-blue-500' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
            </div>

            <h1 className="relative z-10 text-3xl font-black tracking-tight text-gray-900 dark:text-white mb-2">
              {t('views.about.app.name', {
                rebornName: (
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
                    Reborn
                  </span>
                )
              })}
            </h1>
            <p className="relative z-10 text-gray-500 dark:text-gray-400 font-medium font-mono text-sm mb-8">
              {t('views.about.updateTab.version', { appVersion })}
            </p>

            {/* Dynamic Status Area */}
            <div className="relative z-10 h-24 flex items-center justify-center w-full mt-2">
              {isCheckingUpdate ? (
                <p className="text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                  {t.views.about.updateTab.checkingUpdates}
                </p>
              ) : hasChecked && isUpdateAvailable ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-gray-900 dark:text-white font-bold mb-4 text-lg">
                    {t('views.about.updateTab.updateAvailable', {
                      version: (
                        <span className="text-blue-600 dark:text-blue-400">{latestVersion}</span>
                      )
                    })}
                  </p>
                  <button
                    onClick={() => openExternalLink(releaseUrl)}
                    className="px-8 py-3.5 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 cursor-pointer flex items-center gap-2 border border-white/10"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      ></path>
                    </svg>
                    {t.views.about.updateTab.downloadInstall}
                  </button>
                </div>
              ) : hasChecked && isHigherVersion ? (
                <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-amber-500 dark:text-amber-400 font-bold mb-1 text-lg flex items-center gap-2">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      ></path>
                    </svg>
                    {t.views.about.updateTab.unreleasedBuild}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 max-w-62.5 leading-relaxed">
                    {t.views.about.updateTab.unreleasedDesc}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 w-full mt-2">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400 shadow-inner">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          d="M5 13l4 4L19 7"
                        ></path>
                      </svg>
                    </div>
                    <p className="text-gray-900 dark:text-white font-bold text-xl">
                      {t.views.about.updateTab.upToDate}
                    </p>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                    {t('views.about.updateTab.latestVersion', { appVersion })}
                  </p>

                  <button
                    onClick={handleCheckUpdate}
                    className="px-6 py-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold rounded-xl transition-all cursor-pointer border border-transparent dark:border-white/5 flex items-center gap-2 text-sm shadow-sm"
                  >
                    <svg
                      className="w-4 h-4 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      ></path>
                    </svg>
                    {t.views.about.updateTab.checkUpdates}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Links & Credits Section */}
          <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl flex flex-col justify-between h-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {t.views.about.credits.title}
            </h3>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => openExternalLink('https://github.com/M3rcena/Udeler-Reborn')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-black/20 hover:bg-gray-100 dark:hover:bg-white/5 border border-gray-200 dark:border-white/5 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="w-6 h-6 text-gray-700 dark:text-gray-300"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {t.views.about.credits.githubRepo}
                  </span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  ></path>
                </svg>
              </button>

              <button
                onClick={() => openExternalLink('https://discord.gg/ZgXKk6eTfC')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-black/20 hover:bg-blue-50 dark:hover:bg-blue-500/10 border border-gray-200 dark:border-white/5 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-6 h-6 text-gray-700 dark:text-gray-300 group-hover:text-[#5865F2] transition-colors"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                  >
                    <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612" />
                  </svg>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-[#5865F2] transition-colors">
                    {t.views.about.credits.joinDiscord}
                  </span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-[#5865F2] transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  ></path>
                </svg>
              </button>

              <button
                onClick={() => openExternalLink('https://github.com/sponsors/M3rcena')}
                className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-black/20 hover:bg-pink-50 dark:hover:bg-pink-500/10 border border-gray-200 dark:border-white/5 transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-pink-500 transition-colors">
                    {t.sponsors.about}
                  </span>
                </div>
                <svg
                  className="w-5 h-5 text-gray-400 group-hover:text-pink-500 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-200 dark:border-white/10 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('views.about.credits.remadeBy', {
                  userName: (
                    <span
                      className="font-bold text-gray-800 dark:text-gray-200 cursor-pointer hover:text-blue-500 transition-colors"
                      onClick={() => openExternalLink('https://github.com/M3rcena')}
                    >
                      M3rcena
                    </span>
                  )
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Tech Stack Badges */}
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {[
            'Electron v43.1.1',
            'React v19.2.7',
            'TypeScript v5.7.2',
            'Tailwind CSS v4.3.3',
            'Vite v7.3.6'
          ].map((tech) => (
            <span
              key={tech}
              className="px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-full uppercase tracking-wider shadow-sm"
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Zero-Trust Audit Badge */}
        <div className="mt-2 flex justify-center">
          <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full shadow-inner">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                ></path>
              </svg>
            </div>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wide">
              {t('views.about.zeroTrustBadge', {
                passedChecks: auditStats.passedChecks.toLocaleString(),
                anomalies: auditStats.anomalies
              })}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
