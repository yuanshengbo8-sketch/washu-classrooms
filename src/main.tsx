import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'
import { CAMPUS } from './campus'

// The stylesheet is shared between campuses; each one brings its colours.
const { colors } = CAMPUS
const root = document.documentElement.style
root.setProperty('--red', colors.primary)
root.setProperty('--red-dark', colors.primaryDark)
root.setProperty('--red-soft', colors.primarySoft)
root.setProperty('--green', colors.accent)
root.setProperty('--green-soft', colors.accentSoft)

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
)
