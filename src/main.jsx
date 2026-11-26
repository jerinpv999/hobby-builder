import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
//import App from './AuthGate.jsx'
import { loadHobbyModels } from './hobbyModels'

const root = document.getElementById('root')
root.textContent = 'Loading models…'

loadHobbyModels().then(() => {
  root.textContent = ''
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
