import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { HelpModal } from '../components/HelpModal'
import { LoginViewProps } from '@renderer/types'

export const LoginView: React.FC<LoginViewProps> = ({ toggleTheme, isDarkMode }) => {
  const { token, setToken, authStatus, authErrorMsg, handleLogin } = useAuth()
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false)

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-8 bg-slate-50 dark:bg-[#09090e] overflow-hidden transition-colors duration-500">
      {/* Background Ambient glows */}
      <div className="absolute top-[-10%] left-[-5%] w-[40rem] h-[40rem] bg-blue-300/40 dark:bg-blue-600/20 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[40rem] h-[40rem] bg-purple-300/40 dark:bg-purple-600/20 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

      <button
        onClick={toggleTheme}
        className="absolute top-8 right-8 p-3 rounded-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white backdrop-blur-md shadow-lg transition-all duration-300 hover:bg-white dark:hover:bg-white/10 hover:scale-105 cursor-pointer z-10 font-medium"
      >
        {isDarkMode ? '☀️ Light' : '🌙 Dark'}
      </button>

      <div className="relative bg-white/60 dark:bg-white/5 backdrop-blur-2xl border border-white/40 dark:border-white/10 rounded-[2rem] p-10 shadow-2xl w-full max-w-md transition-all duration-500 z-10">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-gray-900 dark:text-white transition-colors duration-300">
            Udeler{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-400 dark:to-purple-500">
              Pro
            </span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium transition-colors duration-300">
            Modern Course Downloader
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div className="relative group flex flex-col gap-2">
            <label
              className={`block text-sm font-semibold mb-1 ml-1 transition-colors ${authStatus === 'error' ? 'text-red-500' : authStatus === 'success' ? 'text-green-500' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Udemy Access Token
            </label>

            <input
              type="password"
              placeholder="Paste your token here..."
              disabled={authStatus === 'validating' || authStatus === 'success'}
              className={`w-full bg-white/50 dark:bg-black/20 border rounded-2xl px-5 py-4 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-all shadow-inner
                ${authStatus === 'error' ? 'border-red-500/50 focus:border-red-500' : authStatus === 'success' ? 'border-green-500' : 'border-gray-200 dark:border-white/10 focus:border-blue-500/50'}`}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />

            {authStatus === 'error' && (
              <p className="text-red-500 text-sm font-medium ml-1 animate-in slide-in-from-top-1">
                {authErrorMsg}
              </p>
            )}

            <div className="flex justify-between items-center mt-1 ml-1">
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
                How to find your token
              </p>
            </div>
          </div>

          <button
            onClick={() => handleLogin(token)}
            disabled={authStatus === 'validating' || authStatus === 'success'}
            className={`w-full text-white font-bold py-4 px-6 rounded-2xl transition-all disabled:opacity-70 ${authStatus === 'success' ? 'bg-green-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'}`}
          >
            {authStatus === 'validating'
              ? 'Connecting to Udemy...'
              : authStatus === 'success'
                ? 'Authenticated!'
                : 'Authenticate Server'}
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 text-xs text-gray-400 font-medium tracking-widest uppercase">
        End-to-End Encrypted Storage
      </div>

      {showHelpModal && <HelpModal onClose={() => setShowHelpModal(false)} />}
    </div>
  )
}
