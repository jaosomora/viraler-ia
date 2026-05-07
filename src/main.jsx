import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TranscriptionProvider } from './context/TranscriptionContext'
import { ConversionProvider } from './context/ConversionContext'
import { ClipsProvider } from './context/ClipsContext'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <TranscriptionProvider>
        <ConversionProvider>
          <ClipsProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ClipsProvider>
        </ConversionProvider>
      </TranscriptionProvider>
    </AuthProvider>
  </React.StrictMode>,
)
