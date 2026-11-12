import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { AuthContextType } from 'src/preload/types/ipc-types'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const cleanToken = (input: string): string => {
  if (!input) return ''
  let cleaned = input.trim()
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim()
  cleaned = cleaned.replace(/^Bearer\s+/i, '').trim()
  cleaned = cleaned.replace(/^access_token\s*=\s*/i, '').trim()
  cleaned = cleaned.split(';')[0].trim()
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, '').trim()
  return cleaned
}

export const AuthProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const [token, setToken] = useState<string>('')
  const [authStatus, setAuthStatus] = useState<'idle' | 'validating' | 'success' | 'error'>('idle')
  const [authErrorMsg, setAuthErrorMsg] = useState<string>('')
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true)

  // Initialize Auth on Boot
  useEffect(() => {
    const checkAuth = async (): Promise<void> => {
      try {
        const savedToken = (await window.api.invoke('store-get', 'udemy_token')) as string
        if (savedToken) {
          setToken(savedToken)
          setIsLoggedIn(true)
        }
      } catch (error) {
        console.error('Failed to load auth token', error)
      } finally {
        setIsAuthLoading(false)
      }
    }
    checkAuth()
  }, [])

  const handleLogin = async (tokenInput: string): Promise<void> => {
    const sanitized = cleanToken(tokenInput)
    if (!sanitized) {
      setAuthStatus('error')
      setAuthErrorMsg('Please paste a valid token before authenticating.')
      return
    }

    setAuthStatus('validating')
    setAuthErrorMsg('')

    try {
      await window.api.invoke('store-set', 'udemy_token', sanitized)
      // Test the token by fetching courses
      await window.api.invoke('fetch-courses')

      setToken(sanitized)
      setAuthStatus('success')
      setTimeout(() => {
        setIsLoggedIn(true)
        setAuthStatus('idle')
      }, 1000)
    } catch {
      await window.api.invoke('store-delete', 'udemy_token')
      setAuthStatus('error')
      setAuthErrorMsg('Invalid or expired token. Please try again.')
    }
  }

  const handleLogout = async (): Promise<void> => {
    await window.api.invoke('store-delete', 'udemy_token')
    setToken('')
    setIsLoggedIn(false)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        setToken,
        authStatus,
        authErrorMsg,
        isLoggedIn,
        isAuthLoading,
        handleLogin,
        handleLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
