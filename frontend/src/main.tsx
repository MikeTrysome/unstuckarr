import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme } from './hooks/useTheme'

// Apply saved theme before React renders to prevent flash of wrong theme
const savedTheme = (localStorage.getItem('unstuckarr_theme') ?? 'dark') as 'dark' | 'light' | 'system'
applyTheme(savedTheme)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
