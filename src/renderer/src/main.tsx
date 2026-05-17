import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { DownloadProvider } from './contexts/DownloadContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DownloadProvider>
        <App />
      </DownloadProvider>
    </AuthProvider>
  </StrictMode>
)
