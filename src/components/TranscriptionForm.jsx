import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import Spinner from './Spinner';

const TranscriptionForm = () => {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const { processTranscription, isLoading, error } = useTranscriptionContext();

  const validateUrl = (input) => {
    const supportedPlatforms = [
      { name: 'Instagram', regex: /https:\/\/(www\.)?instagram\.com\/(reel|p)\/[a-zA-Z0-9_-]+\/?/ },
      { name: 'TikTok', regex: /https:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/ },
      { name: 'YouTube', regex: /https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/ },
      { name: 'YouTube Shorts', regex: /https:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/ }
    ];

    // Verificar si la URL coincide con alguna plataforma soportada
    const matchedPlatform = supportedPlatforms.find(platform => platform.regex.test(input));
    
    if (!input) {
      return 'Por favor ingresa una URL';
    }
    
    if (!matchedPlatform) {
      return 'URL no válida. Soportamos Instagram Reels, TikTok, YouTube videos y YouTube Shorts';
    }
    
    return '';
  };

  const handleUrlChange = (e) => {
    const inputUrl = e.target.value;
    setUrl(inputUrl);
    setUrlError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validar URL
    const error = validateUrl(url);
    if (error) {
      setUrlError(error);
      return;
    }
    
    try {
      await processTranscription(url);
    } catch (err) {
      // El error ya se maneja en el contexto
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-2 text-center">Transcribir Contenido</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
        Transcribe contenido de otros creadores para inspirarte y crear tu propia versión
      </p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="video-url" className="block text-sm font-medium mb-1">
            Link del Video
          </label>
          <input
            id="video-url"
            type="text"
            value={url}
            onChange={handleUrlChange}
            placeholder="https://www.instagram.com/reel/ o https://youtube.com/shorts/"
            className={`w-full px-4 py-3 rounded-lg border ${
              urlError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
            } bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500`}
            disabled={isLoading}
          />
          {urlError && (
            <p className="mt-1 text-sm text-red-500">{urlError}</p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition duration-300 disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span>Procesando...</span>
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4V5h12v10z" clipRule="evenodd" />
                <path d="M8 7a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zM8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              </svg>
              <span>Transcribir Contenido</span>
            </>
          )}
        </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TranscriptionForm;