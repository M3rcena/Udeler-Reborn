import { useEffect, useState } from 'react'
import { DownloadedFile } from 'src/preload/types/ipc-types'
import { GlobalDownloadWidget } from './components/GlobalDownloadWidget'
import { PathAlertModal } from './components/PathAlertModal'
import { SearchModal } from './components/SearchModal'
import { Sidebar } from './components/Sidebar'
import { UpdateToast } from './components/UpdateToast'
import { WhatsNewModal } from './components/WhatsNewModal'
import { useAuth } from './contexts/AuthContext'
import { AboutTab } from './views/AboutTab'
import { DownloadsTab } from './views/DownloadsTab'
import { LoginView } from './views/LoginView'
import { MyCoursesTab } from './views/MyCoursesTab'
import { SettingsTab } from './views/SettingsTab'

function App(): React.JSX.Element {
  const { isLoggedIn, isAuthLoading, handleLogout } = useAuth()
  const [isPathAlertOpen, setIsPathAlertOpen] = useState<boolean>(false)

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true)
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'courses' | 'downloads' | 'settings' | 'about'>(
    'courses'
  )
  const [navCourseId, setNavCourseId] = useState<number | null>(null)
  const [playMediaItem, setPlayMediaItem] = useState<DownloadedFile | null>(null)
  const [searchLectureId, setSearchLectureId] = useState<number | null>(null)

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

  useEffect(() => {
    const unsubMedia = window.api.onPlayRecentMedia((file) => {
      setActiveTab('downloads')
      setPlayMediaItem(file)
    })

    const unsubNav = window.api.onNavigateCourse((courseId) => {
      setActiveTab('courses')
      setNavCourseId(courseId)
    })

    return () => {
      unsubMedia()
      unsubNav()
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
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
      <div className="absolute top-[-20%] left-[-10%] w-200 h-200 bg-blue-300/20 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-200 h-200 bg-purple-300/20 dark:bg-purple-600/10 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

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
        {activeTab === 'courses' && (
          <MyCoursesTab navCourseId={navCourseId} onNavHandled={() => setNavCourseId(null)} />
        )}

        {/* Downloads View */}
        {activeTab === 'downloads' && (
          <DownloadsTab
            playMediaItem={playMediaItem}
            onMediaHandled={() => setPlayMediaItem(null)}
            searchLectureId={searchLectureId}
            onSearchHandled={() => setSearchLectureId(null)}
          />
        )}

        {/* Settings View */}
        {activeTab === 'settings' && <SettingsTab />}

        {/* About View */}
        {activeTab === 'about' && <AboutTab />}
      </main>

      {/* --- MISSING PATH ALERT MODAL --- */}
      <PathAlertModal isOpen={isPathAlertOpen} onClose={() => setIsPathAlertOpen(false)} />

      {/* --- GLOBAL NOTIFICATIONS --- */}
      <UpdateToast />
      <WhatsNewModal />

      {/* --- GLOBAL DOWNLOADS MANAGER WIDGET */}
      <GlobalDownloadWidget />

      {/* --- GLOBAL SEARCH MODAL --- */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(lectureId) => {
          setActiveTab('downloads')
          setSearchLectureId(lectureId)
        }}
      />
    </div>
  )
}

export default App
