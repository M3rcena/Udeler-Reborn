import { LibraryHealthPanel } from '@renderer/components/LibraryHealthPanel'
import { useI18n } from '@renderer/contexts/I18nContext'
import { useEffect, useState } from 'react'

export const SettingsTab: React.FC = () => {
  // --- STATES ---
  const [appSettings, setAppSettings] = useState({
    downloadPath: '',
    videoQuality: 'Auto',
    skipAttachments: false,
    skipSubtitles: false,
    autoRetry: false,
    maxKbps: 0,
    scheduleEnabled: false,
    scheduleStart: '01:00',
    scheduleEnd: '06:00',
    closeToTray: false,
    vaultMode: false
  })
  const { currentLocale, setLocale, availableLocales, t } = useI18n()
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false)

  const [openTimeMenu, setOpenTimeMenu] = useState<'start' | 'end' | null>(null)

  const [isMoveModalOpen, setIsMoveModalOpen] = useState<boolean>(false)
  const [pendingPath, setPendingPath] = useState<string>('')
  const [isMovingFiles, setIsMovingFiles] = useState<boolean>(false)
  const [moveError, setMoveError] = useState<string | null>(null)

  const [reclaimedBytes, setReclaimedBytes] = useState<number>(0)
  const [isCleaning, setIsCleaning] = useState<boolean>(false)
  const [gcResult, setGcResult] = useState<{ purgedCount: number; freedBytes: number } | null>(null)

  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false)
  const activeLocaleMeta =
    availableLocales.find((l) => l.code === currentLocale) || availableLocales[0]

  const qualityOptions = [
    { id: 'Auto', label: 'Auto (Best Available)' },
    { id: 'Highest', label: 'Highest Resolution' },
    { id: '1080p', label: '1080p' },
    { id: '720p', label: '720p' },
    { id: '480p', label: '480p' },
    { id: '360p', label: '360p' },
    { id: 'Lowest', label: 'Lowest (Save Space)' }
  ]

  // --- INITIALIZATION ---
  useEffect(() => {
    const loadSettings = async (): Promise<void> => {
      const savedSettings = (await window.api.invoke('store-get', 'app_settings')) as
        typeof appSettings | undefined
      if (savedSettings) {
        setAppSettings(savedSettings)
      }
    }
    loadSettings()
    window.api.invoke('get-storage-stats').then(setReclaimedBytes)
  }, [])

  // --- HANDLERS ---
  const handleExportLogs = async (): Promise<void> => {
    try {
      const success = await window.api.invoke('export-debug-logs')
      if (success) {
        alert('Debug logs saved successfully! Please send this file to the developer.')
      }
    } catch (error) {
      console.error('Failed to export logs:', error)
      alert('Failed to save logs.')
    }
  }

  const handleSelectFolder = async (): Promise<void> => {
    const newPath = await window.api.invoke('select-folder')
    if (!newPath) return

    const currentPath = appSettings.downloadPath

    if (currentPath && currentPath !== newPath) {
      setPendingPath(newPath)
      setIsMoveModalOpen(true)
    } else {
      setAppSettings((prev) => ({ ...prev, downloadPath: newPath }))
    }
  }

  const handleConfirmMove = async (shouldMove: boolean): Promise<void> => {
    if (shouldMove) {
      setIsMovingFiles(true)
      try {
        await window.api.invoke('moveDownloadsFolder', appSettings.downloadPath, pendingPath)
      } catch (error) {
        console.error('Failed to move files:', error)
        setMoveError(
          error instanceof Error ? error.message : 'An unknown error occurred while moving files.'
        )

        setTimeout(() => setMoveError(null), 5000)

        setIsMovingFiles(false)
        return
      } finally {
        setIsMovingFiles(false)
      }
    }

    const updatedSettings = { ...appSettings, downloadPath: pendingPath }
    setAppSettings(updatedSettings)
    setIsMoveModalOpen(false)
    setPendingPath('')

    await window.api.invoke('store-set', 'app_settings', updatedSettings)
  }

  const handleSaveSettings = async (): Promise<void> => {
    setIsSavingSettings(true)
    try {
      await window.api.invoke('store-set', 'app_settings', appSettings)
      setTimeout(() => setIsSavingSettings(false), 1000)
    } catch (error) {
      console.error('Failed to save settings', error)
      setIsSavingSettings(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleRunGC = async (): Promise<void> => {
    setIsCleaning(true)
    setGcResult(null)
    try {
      const result = await window.api.invoke('run-garbage-collector')
      setGcResult(result)
      setReclaimedBytes(result.newTotalReclaimed)
    } catch (error) {
      console.error('GC failed:', error)
    } finally {
      setIsCleaning(false)
      setTimeout(() => setGcResult(null), 6000)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-10">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Application Settings
      </h2>

      <div className="flex flex-col gap-6">
        {/* Download Location Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                ></path>
              </svg>
            </div>
            Download Location
          </h3>

          <div className="flex gap-4">
            <input
              type="text"
              readOnly
              value={appSettings.downloadPath}
              placeholder="Select a folder to save your courses..."
              className="flex-1 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:outline-none transition-all cursor-not-allowed"
            />
            <button
              onClick={handleSelectFolder}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer whitespace-nowrap"
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Language Selection Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl relative z-30">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
              </svg>
            </div>
            {t.settings.language}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="relative">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                Select Interface Language
              </label>
              <button
                type="button"
                onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setIsLangMenuOpen(false)
                }}
                className="w-full flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner cursor-pointer"
              >
                <span className="font-medium flex items-center gap-3">
                  <img
                    src={`https://flagcdn.com/24x18/${activeLocaleMeta.countryCode}.png`}
                    alt={activeLocaleMeta.name}
                    className="w-6 h-4.5 rounded-xs object-cover shadow-xs"
                    onError={(e) => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                  <span>{activeLocaleMeta?.name}</span>
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isLangMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>

                {isLangMenuOpen && (
                  <div className="absolute top-[105%] left-0 w-full mt-2 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 flex flex-col gap-1">
                      {availableLocales.map((opt) => (
                        <div
                          key={opt.code}
                          onClick={(e) => {
                            e.stopPropagation()
                            setLocale(opt.code)
                            setIsLangMenuOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group ${
                            currentLocale === opt.code
                              ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <img
                              src={`https://flagcdn.com/24x18/${opt.countryCode}.png`}
                              alt={opt.name}
                              className="w-6 h-4.5 rounded-xs object-cover shadow-xs"
                              onError={(e) => {
                                ;(e.target as HTMLElement).style.display = 'none'
                              }}
                            />
                            <span>{opt.name}</span>
                          </span>
                          {currentLocale === opt.code && (
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
                              />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50/70 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <p className="font-bold text-gray-800 dark:text-gray-200 mb-1 text-sm">
                  Community-Driven Localization
                </p>
                New translations are detected automatically from JSON dictionaries. To contribute a
                language, add a new{' '}
                <code className="font-mono text-[11px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded">
                  Locale.json
                </code>{' '}
                file to the repository.
              </div>
            </div>
          </div>
        </div>

        {/* Download Preferences Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl relative z-20">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
            </div>
            Download Preferences
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-2 relative">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Video Quality
              </label>

              {/* Custom Select Button */}
              <button
                onClick={() => setIsQualityMenuOpen(!isQualityMenuOpen)}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setIsQualityMenuOpen(false)
                }}
                className="w-full flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner cursor-pointer"
              >
                <span className="font-medium">
                  {qualityOptions.find((opt) => opt.id === appSettings.videoQuality)?.label ||
                    'Auto (Best Available)'}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isQualityMenuOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>

                {/* The Popup Menu */}
                {isQualityMenuOpen && (
                  <div className="absolute top-[105%] left-0 w-full mt-2 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 flex flex-col gap-1">
                      {qualityOptions.map((option) => (
                        <div
                          key={option.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setAppSettings((prev) => ({ ...prev, videoQuality: option.id }))
                            setIsQualityMenuOpen(false)
                          }}
                          className={`w-full text-left px-4 py-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group
                                ${
                                  appSettings.videoQuality === option.id
                                    ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                                }`}
                        >
                          {option.label}
                          {appSettings.videoQuality === option.id && (
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
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </button>
            </div>

            <div className="flex flex-col gap-5 pt-2">
              {[
                { id: 'skipAttachments', label: 'Skip Course Attachments' },
                { id: 'skipSubtitles', label: 'Skip Subtitles / Closed Captions' },
                { id: 'autoRetry', label: 'Auto-Retry on Network Error' },
                { id: 'closeToTray', label: 'Keep running in background when closed' }
              ].map((setting) => (
                <label
                  key={setting.id}
                  className="flex items-center justify-between cursor-pointer group"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                    {setting.label}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={appSettings[setting.id as keyof typeof appSettings] as boolean}
                      onChange={(e) =>
                        setAppSettings((prev) => ({
                          ...prev,
                          [setting.id]: e.target.checked
                        }))
                      }
                    />
                    <div
                      className={`block w-12 h-7 rounded-full transition-all duration-300 ${appSettings[setting.id as keyof typeof appSettings] ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                    ></div>
                    <div
                      className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${appSettings[setting.id as keyof typeof appSettings] ? 'translate-x-5' : ''}`}
                    ></div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Network & Scheduling Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl relative z-10">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            Network & Scheduling
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Max Bandwidth (Custom Number Input) */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Max Download Speed (KB/s)
              </label>
              <div className="flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl p-1.5 shadow-inner focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <button
                  onClick={() =>
                    setAppSettings((prev) => ({
                      ...prev,
                      maxKbps: Math.max(0, (prev.maxKbps || 0) - 100)
                    }))
                  }
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 rounded-xl transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M20 12H4"
                    ></path>
                  </svg>
                </button>

                <div className="flex flex-col items-center justify-center flex-1">
                  <input
                    type="number"
                    min="0"
                    value={appSettings.maxKbps || 0}
                    onChange={(e) =>
                      setAppSettings((prev) => ({
                        ...prev,
                        maxKbps: parseInt(e.target.value) || 0
                      }))
                    }
                    className="w-full bg-transparent border-none focus:outline-none text-center text-gray-900 dark:text-white font-mono text-lg font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none cursor-text"
                  />
                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                    {appSettings.maxKbps === 0 ? 'Unlimited' : 'Kilobytes / Sec'}
                  </span>
                </div>

                <button
                  onClick={() =>
                    setAppSettings((prev) => ({ ...prev, maxKbps: (prev.maxKbps || 0) + 100 }))
                  }
                  className="w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-600 dark:text-gray-400 rounded-xl transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      d="M12 4v16m8-8H4"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>

            {/* Scheduling */}
            <div className="flex flex-col gap-4 pt-2">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors cursor-pointer">
                  Enable Scheduled Downloads
                </span>
                <div className="relative cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only cursor-pointer"
                    checked={appSettings.scheduleEnabled}
                    onChange={(e) =>
                      setAppSettings((prev) => ({ ...prev, scheduleEnabled: e.target.checked }))
                    }
                  />
                  <div
                    className={`block w-12 h-7 rounded-full transition-all duration-300 ${appSettings.scheduleEnabled ? 'bg-blue-600 shadow-[0_0_12px_rgba(37,99,235,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}
                  ></div>
                  <div
                    className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${appSettings.scheduleEnabled ? 'translate-x-5' : ''}`}
                  ></div>
                </div>
              </label>

              {appSettings.scheduleEnabled && (
                <div className="flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                  {/* Custom Start Time Picker */}
                  <div className="flex flex-col flex-1 gap-1 relative">
                    <label className="text-xs text-gray-500 font-medium">Start Time</label>
                    <button
                      type="button"
                      onClick={() => setOpenTimeMenu(openTimeMenu === 'start' ? null : 'start')}
                      className="flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-inner"
                    >
                      <span className="font-mono font-bold tracking-wider">
                        {appSettings.scheduleStart || '00:00'}
                      </span>
                      <svg
                        className="w-4 h-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </button>

                    {openTimeMenu === 'start' && (
                      <>
                        <div
                          className="fixed inset-0 z-40 cursor-pointer"
                          onClick={() => setOpenTimeMenu(null)}
                        />
                        <div className="absolute top-[105%] left-0 w-full h-48 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 flex overflow-hidden animate-in fade-in slide-in-from-top-2">
                          <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-gray-100 dark:border-white/5 p-1">
                            {Array.from({ length: 24 }, (_, i) =>
                              i.toString().padStart(2, '0')
                            ).map((hour) => {
                              const currentStart = appSettings.scheduleStart || '00:00'
                              return (
                                <div
                                  key={`start-h-${hour}`}
                                  onClick={() => {
                                    setAppSettings((prev) => ({
                                      ...prev,
                                      scheduleStart: `${hour}:${(prev.scheduleStart || '00:00').split(':')[1]}`
                                    }))
                                  }}
                                  className={`px-2 py-2 text-center rounded-lg cursor-pointer text-sm font-mono ${currentStart.startsWith(hour) ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                >
                                  {hour}
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {Array.from({ length: 60 }, (_, i) =>
                              i.toString().padStart(2, '0')
                            ).map((minute) => {
                              const currentStart = appSettings.scheduleStart || '00:00'
                              return (
                                <div
                                  key={`start-m-${minute}`}
                                  onClick={() => {
                                    setAppSettings((prev) => ({
                                      ...prev,
                                      scheduleStart: `${(prev.scheduleStart || '00:00').split(':')[0]}:${minute}`
                                    }))
                                    setOpenTimeMenu(null)
                                  }}
                                  className={`px-2 py-2 text-center rounded-lg cursor-pointer text-sm font-mono ${currentStart.endsWith(minute) ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                >
                                  {minute}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Custom End Time Picker */}
                  <div className="flex flex-col flex-1 gap-1 relative">
                    <label className="text-xs text-gray-500 font-medium">End Time</label>
                    <button
                      type="button"
                      onClick={() => setOpenTimeMenu(openTimeMenu === 'end' ? null : 'end')}
                      className="flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-inner"
                    >
                      <span className="font-mono font-bold tracking-wider">
                        {appSettings.scheduleEnd || '23:59'}
                      </span>
                      <svg
                        className="w-4 h-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        ></path>
                      </svg>
                    </button>

                    {openTimeMenu === 'end' && (
                      <>
                        <div
                          className="fixed inset-0 z-40 cursor-pointer"
                          onClick={() => setOpenTimeMenu(null)}
                        />
                        <div className="absolute top-[105%] left-0 w-full h-48 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 flex overflow-hidden animate-in fade-in slide-in-from-top-2">
                          <div className="flex-1 overflow-y-auto custom-scrollbar border-r border-gray-100 dark:border-white/5 p-1">
                            {Array.from({ length: 24 }, (_, i) =>
                              i.toString().padStart(2, '0')
                            ).map((hour) => {
                              const currentEnd = appSettings.scheduleEnd || '23:59'
                              return (
                                <div
                                  key={`end-h-${hour}`}
                                  onClick={() => {
                                    setAppSettings((prev) => ({
                                      ...prev,
                                      scheduleEnd: `${hour}:${(prev.scheduleEnd || '23:59').split(':')[1]}`
                                    }))
                                  }}
                                  className={`px-2 py-2 text-center rounded-lg cursor-pointer text-sm font-mono ${currentEnd.startsWith(hour) ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                >
                                  {hour}
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                            {Array.from({ length: 60 }, (_, i) =>
                              i.toString().padStart(2, '0')
                            ).map((minute) => {
                              const currentEnd = appSettings.scheduleEnd || '23:59'
                              return (
                                <div
                                  key={`end-m-${minute}`}
                                  onClick={() => {
                                    setAppSettings((prev) => ({
                                      ...prev,
                                      scheduleEnd: `${(prev.scheduleEnd || '23:59').split(':')[0]}:${minute}`
                                    }))
                                    setOpenTimeMenu(null)
                                  }}
                                  className={`px-2 py-2 text-center rounded-lg cursor-pointer text-sm font-mono ${currentEnd.endsWith(minute) ? 'bg-blue-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                                >
                                  {minute}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer group mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
          <div>
            <span className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              Vault Mode (Encrypted Storage)
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-62.5">
              Encrypts downloaded videos and auth tokens on disk using your OS Keychain.
            </p>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={appSettings.vaultMode as boolean}
              onChange={(e) =>
                setAppSettings((prev) => ({
                  ...prev,
                  vaultMode: e.target.checked
                }))
              }
            />
            <div
              className={`block w-12 h-7 rounded-full transition-all duration-300 ${appSettings.vaultMode ? 'bg-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.5)]' : 'bg-gray-300 dark:bg-gray-600'}`}
            ></div>
            <div
              className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform duration-300 ${appSettings.vaultMode ? 'translate-x-5' : ''}`}
            ></div>
          </div>
        </label>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-lg transform cursor-pointer
                ${
                  isSavingSettings
                    ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-[0.99]'
                    : 'bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                }
              `}
        >
          {isSavingSettings ? 'Settings Saved Successfully!' : 'Save All Settings'}
        </button>

        {/* Storage Stats Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-4xl shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  ></path>
                </svg>
              </div>
              Storage Optimization
            </h3>
            <button
              onClick={handleRunGC}
              disabled={isCleaning}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-emerald-500/30 cursor-pointer disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              {isCleaning ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin"
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
                  Sweeping...
                </>
              ) : (
                'Clean Orphaned Blobs'
              )}
            </button>
          </div>

          <div className="flex items-center justify-between p-6 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl shadow-inner transition-all hover:bg-emerald-50 dark:hover:bg-emerald-500/10 mb-4">
            <div>
              <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                Disk Space Reclaimed
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-500/70 mt-1 max-w-xs leading-relaxed">
                Automatically saved via cross-course asset and video deduplication.
              </p>
            </div>
            <p className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 drop-shadow-sm">
              {formatBytes(reclaimedBytes)}
            </p>
          </div>

          {gcResult && (
            <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl flex items-center gap-3 text-blue-700 dark:text-blue-400 text-sm font-medium">
              <svg
                className="w-5 h-5 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
              {gcResult.purgedCount > 0
                ? `Cleanup complete: Permanently removed ${gcResult.purgedCount} orphaned files, freeing up ${formatBytes(gcResult.freedBytes)} of disk space.`
                : 'Cleanup complete: No orphaned files found. Your storage is perfectly optimized!'}
            </div>
          )}
        </div>

        {/* Library Health */}
        <LibraryHealthPanel />

        {/* Troubleshooting Section */}
        <div className="mb-8 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                ></path>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Troubleshooting & Diagnostics
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                If you are experiencing issues with missing courses, failed downloads, or unexpected
                crashes, generate a diagnostic log file to help identify the problem.
              </p>

              <button
                onClick={handleExportLogs}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/20 text-gray-900 dark:text-white font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  ></path>
                </svg>
                Export Debug Logs
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- FOLDER MIGRATION MODAL --- */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md p-8 bg-white/95 dark:bg-[#0f0f18]/95 border border-gray-200 dark:border-white/10 rounded-4xl shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-2xl mb-5 shadow-inner">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                ></path>
              </svg>
            </div>

            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              Move Downloaded Files?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
              You changed your download location. Would you like to migrate all previously
              downloaded courses to the new folder?
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => handleConfirmMove(true)}
                disabled={isMovingFiles}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer disabled:opacity-70 flex justify-center items-center gap-2"
              >
                {isMovingFiles ? (
                  <>
                    <svg
                      className="w-5 h-5 animate-spin"
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
                    </svg>{' '}
                    Moving Files...
                  </>
                ) : (
                  'Yes, Move Files'
                )}
              </button>

              {!isMovingFiles && (
                <>
                  <button
                    onClick={() => handleConfirmMove(false)}
                    className="w-full py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-800 dark:text-white font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    No, Leave Them There
                  </button>
                  <button
                    onClick={() => {
                      setIsMoveModalOpen(false)
                      setPendingPath('')
                    }}
                    className="w-full py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-medium transition-colors cursor-pointer text-sm"
                  >
                    Cancel Change
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ERROR TOAST --- */}
      {moveError && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-110 animate-in slide-in-from-bottom-8 fade-in duration-300">
          <div className="flex items-center gap-3 px-6 py-4 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-xl border border-red-200 dark:border-red-500/30 rounded-2xl shadow-2xl shadow-red-500/10 max-w-md w-full">
            <div className="shrink-0 w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 shadow-inner">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-gray-900 dark:text-white font-bold text-sm">Migration Failed</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed line-clamp-2">
                {moveError}
              </p>
            </div>
            <button
              onClick={() => setMoveError(null)}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
