import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { DownloadProvider } from './contexts/DownloadContext'
import { I18nProvider } from './contexts/I18nContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <DownloadProvider>
          <App />
        </DownloadProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>
)
