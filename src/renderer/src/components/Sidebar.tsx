import { SidebarProps } from 'src/preload/ipc-types'
import brandLogo from '../assets/brand.png?url'

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isDarkMode,
  toggleTheme,
  handleLogout
}) => {
  return (
    <aside className="relative w-64 flex flex-col bg-white/40 dark:bg-white/5 backdrop-blur-xl border-r border-gray-200 dark:border-white/10 z-10 transition-all duration-300">
      {/* Logo Area */}
      <div className="h-24 flex items-center justify-center border-b border-gray-200/50 dark:border-white/5">
        <img
          src={brandLogo}
          alt="Udeler Reborn - Logo"
          className="h-14 md:h-16 w-auto object-contain drop-shadow-sm transition-transform hover:scale-105 cursor-pointer"
        />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {/* Courses Tab */}
        <button
          onClick={() => setActiveTab('courses')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
            activeTab === 'courses'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            ></path>
          </svg>
          My Courses
        </button>

        {/* Downloads Tab */}
        <button
          onClick={() => setActiveTab('downloads')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
            activeTab === 'downloads'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          Downloads
        </button>

        {/* Settings Tab */}
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
            activeTab === 'settings'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
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
          Settings
        </button>

        {/* About Tab */}
        <button
          onClick={() => setActiveTab('about')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all cursor-pointer font-semibold ${
            activeTab === 'about'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            ></path>
          </svg>
          About
        </button>
      </nav>

      {/* Sidebar Footer (Theme & Logout) */}
      <div className="p-4 border-t border-gray-200/50 dark:border-white/5 flex flex-col gap-2">
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gray-200 dark:bg-white/5 text-gray-800 dark:text-white transition-all hover:bg-gray-300 dark:hover:bg-white/10 cursor-pointer font-medium"
        >
          {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 transition-all hover:bg-red-500 hover:text-white cursor-pointer font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            ></path>
          </svg>
          Logout
        </button>
        <button
          onClick={() => window.api.invoke('os-hide-to-tray')}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-500 hover:text-white cursor-pointer font-medium mb-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 22V9"></path>
          </svg>
          Hide to Tray
        </button>
      </div>
    </aside>
  )
}
