import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { TranscriptionProvider } from './context/TranscriptionContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TranscriptionProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </TranscriptionProvider>
  </React.StrictMode>,
)
