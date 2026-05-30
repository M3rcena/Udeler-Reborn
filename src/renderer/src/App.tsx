import { useState, useEffect } from 'react'
import { useAuth } from './contexts/AuthContext'
import { LoginView } from './views/LoginView'
import { Sidebar } from './components/Sidebar'
import { PathAlertModal } from './components/PathAlertModal'
import { SettingsTab } from './views/SettingsTab'
import { AboutTab } from './views/AboutTab'
import { UpdateToast } from './components/UpdateToast'
import { MyCoursesTab } from './views/MyCoursesTab'
import { DownloadsTab } from './views/DownloadsTab'
import { GlobalDownloadWidget } from './components/GlobalDownloadWidget'

function App(): React.JSX.Element {
  const { isLoggedIn, isAuthLoading, handleLogout } = useAuth()
  const [isPathAlertOpen, setIsPathAlertOpen] = useState<boolean>(false)

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true)
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<'courses' | 'downloads' | 'settings' | 'about'>(
    'courses'
  )

  useEffect((): void => {
    const initializeApp = async (): Promise<void> => {
      // Load Theme
      const savedTheme = await window.api.invoke('store-get', 'theme')
      if (savedTheme === 'light') {
        setIsDarkMode(false)
        document.documentElement.classList.remove('dark')
      } else {
        document.documentElement.classList.add('dark')
      }
      setIsAppLoading(false)
    }

    initializeApp()
  }, [])

  const toggleTheme = async (): Promise<void> => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    if (newTheme) {
      document.documentElement.classList.add('dark')
      await window.api.invoke('store-set', 'theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      await window.api.invoke('store-set', 'theme', 'light')
    }
  }

  {
    /* --- LOADING --- */
  }
  if (isAuthLoading || isAppLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 dark:text-white">
        Loading...
      </div>
    )
  }

  {
    /* --- LOGIN ---*/
  }
  if (!isLoggedIn) {
    return <LoginView toggleTheme={toggleTheme} isDarkMode={isDarkMode} />
  }

  return (
    <div className="relative flex h-screen w-full bg-slate-50 dark:bg-[#09090e] transition-colors duration-500 overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[50rem] h-[50rem] bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50rem] h-[50rem] bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

      {/* --- SIDEBAR --- */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
      />

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 relative z-10 overflow-y-auto p-8">
        {/* Courses View */}
        {activeTab === 'courses' && <MyCoursesTab />}

        {/* Downloads View */}
        {activeTab === 'downloads' && <DownloadsTab />}

        {/* Settings View */}
        {activeTab === 'settings' && <SettingsTab />}

        {/* About View */}
        {activeTab === 'about' && <AboutTab />}
      </main>

      {/* --- MISSING PATH ALERT MODAL --- */}
      <PathAlertModal isOpen={isPathAlertOpen} onClose={() => setIsPathAlertOpen(false)} />

      {/* --- GLOBAL NOTIFICATIONS --- */}
      <UpdateToast />

      {/* --- GLOBAL DOWNLOADS MANAGER WIDGET */}
      <GlobalDownloadWidget />
    </div>
  )
}

export default App
