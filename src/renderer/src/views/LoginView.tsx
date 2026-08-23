import { useI18n } from '@renderer/contexts/I18nContext'
import React, { useState } from 'react'
import { LoginViewProps } from 'src/preload/types/ipc-types'
import { HelpModal } from '../components/HelpModal'
import { useAuth } from '../contexts/AuthContext'

export const LoginView: React.FC<LoginViewProps> = ({ toggleTheme, isDarkMode }) => {
  const { currentLocale, setLocale, availableLocales, t } = useI18n()
  const [isLangMenuOpen, setIsLangMenuOpen] = useState<boolean>(false)

  const { token, setToken, authStatus, authErrorMsg, handleLogin } = useAuth()
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)

  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState<boolean>(false)
  const [autoLoginError, setAutoLoginError] = useState<string | null>(null)

  const [isBusiness, setIsBusiness] = useState<boolean>(false)
  const [subdomain, setSubdomain] = useState<string>('')

  const activeLocaleMeta =
    availableLocales.find((l) => l.code === currentLocale) || availableLocales[0]

  const handleAutoLogin = async (): Promise<void> => {
    try {
      setAutoLoginError(null)
      setIsAutoLoggingIn(true)

      const cleanedDomain = isBusiness && subdomain.trim() !== '' ? subdomain.trim() : undefined

      const extractedToken = await window.api.invoke('login-udemy', cleanedDomain)

      if (extractedToken) {
        await handleLogin(extractedToken)
      } else {
        setAutoLoginError(t.views.login.errors.tooEarly)
      }
    } catch (error) {
      console.error('Auto-login failed:', error)
      setAutoLoginError(t.views.login.errors.tryManual)
    } finally {
      setIsAutoLoggingIn(false)
    }
  }

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-8 bg-slate-50 dark:bg-[#09090e] overflow-hidden transition-colors duration-500">
      {/* Background Ambient glows */}
      <div className="absolute top-[-10%] left-[-5%] w-160 h-160 bg-blue-300/40 dark:bg-blue-600/20 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-160 h-160 bg-purple-300/40 dark:bg-purple-600/20 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

      <div className="absolute top-8 left-8 z-20">
        <button
          onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) setIsLangMenuOpen(false)
          }}
          className="flex items-center gap-2.5 p-3 px-4 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white backdrop-blur-md shadow-lg transition-all duration-300 hover:bg-white dark:hover:bg-white/10 hover:scale-105 cursor-pointer font-medium text-sm"
        >
          <img
            src={`https://flagcdn.com/24x18/${activeLocaleMeta.countryCode}.png`}
            alt={activeLocaleMeta.name}
            className="w-5 h-3.5 rounded-xs object-cover shadow-xs"
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
          <span>{activeLocaleMeta.name}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isLangMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>

          {/* Popup Menu */}
          {isLangMenuOpen && (
            <div className="absolute top-[110%] left-0 w-48 bg-white/95 dark:bg-[#12121a]/95 backdrop-blur-2xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200 p-1.5 flex flex-col gap-1">
              {availableLocales.map((opt) => (
                <div
                  key={opt.code}
                  onClick={(e) => {
                    e.stopPropagation()
                    setLocale(opt.code)
                    setIsLangMenuOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group text-xs ${
                    currentLocale === opt.code
                      ? 'bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <img
                      src={`https://flagcdn.com/24x18/${opt.countryCode}.png`}
                      alt={opt.name}
                      className="w-4.5 h-3 rounded-xs object-cover shadow-xs"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                    <span>{opt.name}</span>
                  </span>
                  {currentLocale === opt.code && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          )}
        </button>
      </div>

      {/* Theme Toggle (Top Right) */}
      <button
        onClick={toggleTheme}
        className="absolute top-8 right-8 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white backdrop-blur-md shadow-lg transition-all duration-300 hover:bg-white dark:hover:bg-white/10 hover:scale-105 cursor-pointer z-10 font-medium"
      >
        {isDarkMode ? t.components.sidebar.lightMode : t.components.sidebar.darkMode}
      </button>

      <div className="relative bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-4xl p-10 shadow-2xl w-full max-w-md transition-all duration-500 z-10">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-gray-900 dark:text-white transition-colors duration-300">
            {t('views.about.app.name', {
              rebornName: (
                <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
                  Reborn
                </span>
              )
            })}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium transition-colors duration-300">
            {t.views.login.appDesc}
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {/* --- GLOBAL ACCOUNT SETTINGS: UDEMY BUSINESS --- */}
          <div className="flex flex-col gap-4 bg-gray-50/50 dark:bg-black/10 p-4 rounded-2xl border border-gray-100 dark:border-white/5">
            <div
              onClick={() => setIsBusiness(!isBusiness)}
              className="flex items-center gap-3 cursor-pointer group select-none"
            >
              <div
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-300 ${isBusiness ? 'bg-purple-600' : 'bg-gray-200 dark:bg-white/10'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${isBusiness ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </div>
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                {t.views.login.businessAccount}
              </span>
            </div>

            {isBusiness && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  {t.views.login.orgSubdomain}
                </label>
                <div className="flex items-center shadow-inner rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 focus-within:ring-2 focus-within:ring-purple-500/50 transition-all">
                  <span className="px-3 py-3 bg-gray-100/80 dark:bg-white/5 border-r border-gray-200 dark:border-white/10 text-gray-400 text-sm font-semibold select-none">
                    https://
                  </span>
                  <input
                    type="text"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    placeholder="your-company"
                    disabled={isAutoLoggingIn}
                    className="flex-1 min-w-0 px-3 py-3 focus:outline-none bg-white dark:bg-transparent dark:text-white text-sm font-medium placeholder-gray-400"
                  />
                  <span className="px-3 py-3 bg-gray-100/80 dark:bg-white/5 border-l border-gray-200 dark:border-white/10 text-gray-400 text-sm font-semibold select-none">
                    .udemy.com
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* --- PRIMARY ACTION: AUTO LOGIN --- */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleAutoLogin}
              disabled={
                isAutoLoggingIn ||
                authStatus === 'validating' ||
                authStatus === 'success' ||
                (isBusiness && !subdomain.trim())
              }
              className={`w-full flex items-center justify-center gap-3 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed 
                ${authStatus === 'success' ? 'bg-green-500' : 'bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500'}`}
            >
              {isAutoLoggingIn ? (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t.views.login.waitingLogin}
                </div>
              ) : authStatus === 'success' ? (
                t.views.login.authenticated
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    ></path>
                  </svg>
                  {isBusiness ? t.views.login.signInBusiness : t.views.login.signInNormal}
                </>
              )}
            </button>

            {autoLoginError && (
              <p className="text-red-500 text-sm font-medium text-center animate-in slide-in-from-top-1">
                {autoLoginError}
              </p>
            )}
          </div>

          {/* --- DIVIDER --- */}
          <div className="flex items-center my-1">
            <div className="flex-1 border-t border-gray-200 dark:border-white/10"></div>
            <span className="px-4 text-xs text-gray-400 font-bold uppercase tracking-wider">
              {t.views.login.manualToken}
            </span>
            <div className="flex-1 border-t border-gray-200 dark:border-white/10"></div>
          </div>

          {/* --- SECONDARY ACTION: MANUAL LOGIN --- */}
          <div className="relative group flex flex-col gap-2">
            <label
              className={`block text-sm font-semibold mb-1 ml-1 transition-colors ${authStatus === 'error' ? 'text-red-500' : authStatus === 'success' ? 'text-green-500' : 'text-gray-700 dark:text-gray-300'}`}
            >
              {t.views.login.udemyAccessToken}
            </label>

            <input
              type="password"
              placeholder="Paste your token here..."
              disabled={isAutoLoggingIn || authStatus === 'validating' || authStatus === 'success'}
              className={`w-full bg-white/50 dark:bg-black/20 border rounded-2xl px-5 py-4 dark:text-white placeholder-gray-400 focus:outline-none transition-all shadow-inner
                ${authStatus === 'error' ? 'focus:border-red-500' : authStatus === 'success' ? 'border-green-500' : 'border-gray-200 dark:border-white/10'}`}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />

            {authStatus === 'error' && (
              <p className="text-red-500 text-sm font-medium ml-1 animate-in slide-in-from-top-1">
                {authErrorMsg}
              </p>
            )}

            <div className="flex justify-between items-center mt-1 ml-1 mb-2">
              <p
                onClick={() => setShowHelpModal(true)}
                className="text-xs text-gray-500 transition-colors hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer flex items-center gap-1 font-medium"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                {t.views.login.howTo}
              </p>
            </div>

            <button
              onClick={async () => {
                if (isBusiness && subdomain.trim() !== '') {
                  await window.api.invoke('store-set', 'udemy_subdomain', subdomain.trim())
                } else {
                  await window.api.invoke('store-delete', 'udemy_subdomain')
                }

                await handleLogin(token)
              }}
              disabled={
                isAutoLoggingIn ||
                authStatus === 'validating' ||
                authStatus === 'success' ||
                (isBusiness && !subdomain.trim())
              }
              className={`w-full text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed 
                ${authStatus === 'success' ? 'bg-green-500' : 'bg-gray-800 hover:bg-gray-700 dark:bg-white/10 dark:hover:bg-white/20'}`}
            >
              {authStatus === 'validating'
                ? t.views.login.connecting
                : authStatus === 'success'
                  ? t.views.login.authenticated
                  : t.views.login.manualLogin}
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 text-xs text-gray-400 font-medium tracking-widest uppercase">
        {t.views.login.endToEnd}
      </div>

      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  )
}
