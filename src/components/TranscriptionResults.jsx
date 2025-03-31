import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const TranscriptionResults = () => {
  const { currentTranscription, saveTranscription } = useTranscriptionContext();
  const [isSaved, setIsSaved] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [showUsageInfo, setShowUsageInfo] = useState(false);

  if (!currentTranscription) return null;

  const { url, text, platform, title, usageInfo } = currentTranscription;

  const handleSave = () => {
    const saved = saveTranscription();
    if (saved) {
      setIsSaved(true);
      // Reiniciar el estado después de 3 segundos
      setTimeout(() => setIsSaved(false), 3000);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const toggleUsageInfo = () => {
    setShowUsageInfo(!showUsageInfo);
  };

  // Función para renderizar el icono de la plataforma mejorado
  const renderPlatformIcon = () => {
    switch (platform) {
      case 'instagram':
        return (
          <div className="w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <linearGradient id="instagramGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFDC80" />
                <stop offset="12.5%" stopColor="#FCAF45" />
                <stop offset="25%" stopColor="#F77737" />
                <stop offset="37.5%" stopColor="#F56040" />
                <stop offset="50%" stopColor="#FD1D1D" />
                <stop offset="62.5%" stopColor="#E1306C" />
                <stop offset="75%" stopColor="#C13584" />
                <stop offset="87.5%" stopColor="#833AB4" />
                <stop offset="100%" stopColor="#5851DB" />
              </linearGradient>
              <path 
                fill="url(#instagramGradient)" 
                d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 01-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 01-1.772-1.153 4.904 4.904 0 01-1.153-1.772c-.247-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.218-1.79.465-2.428a4.88 4.88 0 011.153-1.772A4.897 4.897 0 015.45 2.525c.638-.247 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 1.802c-2.67 0-2.987.01-4.04.059-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.053-.059 1.37-.059 4.04 0 2.672.01 2.988.059 4.042.044.976.207 1.504.344 1.856.182.466.399.8.748 1.15.35.35.684.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.059 4.04.059 2.672 0 2.988-.01 4.042-.059.976-.044 1.504-.207 1.856-.344.466-.182.8-.398 1.15-.748.35-.35.566-.684.748-1.15.137-.352.3-.88.344-1.856.048-1.054.059-1.37.059-4.041 0-2.67-.01-2.987-.059-4.04-.044-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.352-.137-.88-.3-1.856-.344-1.054-.048-1.37-.059-4.041-.059zm0 3.063A5.135 5.135 0 1 1 12 17.135 5.135 5.135 0 0 1 12 6.865zm0 8.468A3.333 3.333 0 1 0 12 8.667a3.333 3.333 0 0 0 0 6.666zm6.538-8.669a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"
              />
            </svg>
          </div>
        );
      case 'tiktok':
        return (
          <div className="w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path 
                d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .6.04.88.12V9.4c-.3-.03-.6-.07-.88-.07a6.25 6.25 0 1 0 0 12.5 6.18 6.18 0 0 0 6.24-6.07V9.8a8.16 8.16 0 0 0 5.06 1.73v-3.62c-.47.02-.91.02-1.19-.02z" 
                fill="#000000"
                className="dark:fill-white"
              />
            </svg>
          </div>
        );
      case 'youtube':
      case 'youtube-shorts':
        return (
          <div className="w-7 h-7 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path 
                fill="#FF0000" 
                d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.13C19.54 3.47 12 3.47 12 3.47s-7.54 0-9.38.59a3.02 3.02 0 0 0-2.12 2.13C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.13c1.84.59 9.38.59 9.38.59s7.54 0 9.38-.59a3.02 3.02 0 0 0 2.12-2.13C24 15.97 24 12 24 12s0-3.97-.5-5.81z"
              />
              <path 
                fill="#FFFFFF" 
                d="M9.6 15.6V8.4l6.4 3.6-6.4 3.6z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full">
            <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {renderPlatformIcon()}
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transcripción completada</h3>
          </div>
          <div className="flex space-x-2">
            {usageInfo && (
              <button
                onClick={toggleUsageInfo}
                className="flex items-center gap-1 py-1 px-3 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-full transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Info</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 py-1 px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-full transition"
            >
              {copySuccess ? (
                <>
                  <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  <span>Copiar</span>
                </>
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={`flex items-center gap-1 py-1 px-3 text-sm ${
                isSaved
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:hover:bg-purple-800/50'
              } rounded-full transition`}
            >
              {isSaved ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Guardado</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
                  </svg>
                  <span>Guardar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Información de uso y costos */}
        {showUsageInfo && usageInfo && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border dark:border-blue-800 rounded-lg">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Información de uso de API</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Duración estimada:</span>
                <span className="font-medium dark:text-white">{Math.round(usageInfo.durationInSeconds)} seg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Costo:</span>
                <span className="font-medium dark:text-white">${usageInfo.estimatedCost.toFixed(4)} USD</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">URL del contenido:</span>
          </div>
          <a 
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all"
          >
            {url}
          </a>
        </div>

        <div>
          <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Transcripción:</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap text-gray-800 dark:text-gray-100">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionResults;