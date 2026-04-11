import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TranscriptionProvider } from './context/TranscriptionContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TranscriptionProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </TranscriptionProvider>
    </AuthProvider>
  </React.StrictMode>,
)
