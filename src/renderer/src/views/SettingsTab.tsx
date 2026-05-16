import { useEffect, useState } from 'react'

export const SettingsTab: React.FC = () => {
  // --- STATES ---
  const [appSettings, setAppSettings] = useState({
    downloadPath: '',
    videoQuality: 'Auto',
    skipAttachments: false,
    skipSubtitles: false,
    autoRetry: false
  })
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false)
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState<boolean>(false)

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
      const savedSettings = (await window.api.getStore('app_settings')) as
        | typeof appSettings
        | undefined
      if (savedSettings) {
        setAppSettings(savedSettings)
      }
    }
    loadSettings()
  }, [])

  // --- HANDLERS ---
  const handleSelectFolder = async (): Promise<void> => {
    const path = await window.api.selectFolder()
    if (path) {
      setAppSettings((prev) => ({ ...prev, downloadPath: path }))
    }
  }

  const handleSaveSettings = async (): Promise<void> => {
    setIsSavingSettings(true)
    try {
      await window.api.setStore('app_settings', appSettings)
      setTimeout(() => setIsSavingSettings(false), 1000)
    } catch (error) {
      console.error('Failed to save settings', error)
      setIsSavingSettings(false)
    }
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto pb-10">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        Application Settings
      </h2>

      <div className="flex flex-col gap-6">
        {/* Download Location Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl">
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
              className="flex-1 bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none transition-all cursor-not-allowed"
            />
            <button
              onClick={handleSelectFolder}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 cursor-pointer whitespace-nowrap"
            >
              Browse...
            </button>
          </div>
        </div>

        {/* Download Preferences Card */}
        <div className="p-8 bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-xl relative z-20">
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
                className="w-full flex items-center justify-between bg-white/50 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-inner cursor-pointer"
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
                { id: 'autoRetry', label: 'Auto-Retry on Network Error' }
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

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          disabled={isSavingSettings}
          className={`w-full py-4 text-white font-bold rounded-2xl transition-all shadow-lg transform cursor-pointer
                ${
                  isSavingSettings
                    ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-[0.99]'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 hover:-translate-y-0.5 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                }
              `}
        >
          {isSavingSettings ? 'Settings Saved Successfully!' : 'Save All Settings'}
        </button>
      </div>
    </div>
  )
}
