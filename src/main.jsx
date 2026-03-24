import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MX3Dashboard from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MX3Dashboard />
  </StrictMode>,
)
