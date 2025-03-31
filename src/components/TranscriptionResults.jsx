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

  // Función para renderizar el icono de la plataforma
  const renderPlatformIcon = () => {
    switch (platform) {
      case 'instagram':
        return (
          <svg className="h-5 w-5 text-pink-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="h-5 w-5 text-black dark:text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298.006.596.045.885.115V9.4a6.13 6.13 0 00-1-.08A6.26 6.26 0 005 20.83a6.26 6.26 0 009.5-5.29V9.71a8.16 8.16 0 005.07 1.56V7.83a4.85 4.85 0 01-.98-.14z" />
          </svg>
        );
      case 'youtube':
      case 'youtube-shorts':
        return (
          <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        );
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {renderPlatformIcon()}
            <h3 className="text-lg font-medium">Transcripción completada</h3>
          </div>
          <div className="flex space-x-2">
            {usageInfo && (
              <button
                onClick={toggleUsageInfo}
                className="flex items-center gap-1 py-1 px-3 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-800/40 text-blue-700 dark:text-blue-300 rounded-full transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Info</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 py-1 px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-full transition"
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
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-800/40'
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
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Información de uso de API</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Duración estimada:</span>
                <span className="font-medium">{Math.round(usageInfo.durationInSeconds)} seg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Costo:</span>
                <span className="font-medium">${usageInfo.estimatedCost.toFixed(4)} USD</span>
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
          <h4 className="font-medium mb-2">Transcripción:</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionResults;