import React, { useState, useRef } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import Spinner from './Spinner';

const ACCEPTED_FORMATS = '.mp4,.mov,.avi,.mkv,.webm,.m4v,.flv,.wmv,.mp3,.wav,.m4a,.ogg';

const TranscriptionForm = () => {
  const [mode, setMode] = useState('url'); // 'url' | 'file'
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);
  const { processTranscription, processFileTranscription, isLoading, error } = useTranscriptionContext();

  const validateUrl = (input) => {
    const supportedPlatforms = [
      { name: 'Instagram', regex: /https:\/\/(www\.)?instagram\.com\/(reel|p)\/[a-zA-Z0-9_-]+\/?/ },
      { name: 'TikTok', regex: /https:\/\/(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/ },
      { name: 'YouTube', regex: /https:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/ },
      { name: 'YouTube Shorts', regex: /https:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/ },
      { name: 'Facebook', regex: /https:\/\/(www\.)?(facebook\.com|fb\.watch)\/(share\/v|watch|reel|.*\/videos)\/[\w/?=&-]+/ }
    ];

    if (!input) return 'Por favor ingresa una URL';
    if (!supportedPlatforms.some(p => p.regex.test(input))) {
      return 'URL no válida. Soportamos Instagram Reels, TikTok, YouTube, YouTube Shorts y Facebook';
    }
    return '';
  };

  const handleUrlChange = (e) => {
    setUrl(e.target.value);
    setUrlError('');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    // 500 MB limit
    if (file.size > 500 * 1024 * 1024) {
      setFileError('El archivo es demasiado grande. Máximo 500 MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (mode === 'url') {
      const err = validateUrl(url);
      if (err) { setUrlError(err); return; }
      try { await processTranscription(url); } catch (_) {}
    } else {
      if (!selectedFile) { setFileError('Selecciona un archivo'); return; }
      try { await processFileTranscription(selectedFile); } catch (_) {}
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-2 text-center">Transcribir Contenido</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
        Transcribe contenido de otros creadores para inspirarte y crear tu propia version
      </p>

      {/* Mode tabs */}
      <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => { setMode('url'); setFileError(''); }}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition ${
            mode === 'url'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          disabled={isLoading}
        >
          Pegar URL
        </button>
        <button
          type="button"
          onClick={() => { setMode('file'); setUrlError(''); }}
          className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition ${
            mode === 'file'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
          disabled={isLoading}
        >
          Subir Archivo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'url' ? (
          <div>
            <label htmlFor="video-url" className="block text-sm font-medium mb-1">
              Link del Video
            </label>
            <input
              id="video-url"
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://www.instagram.com/reel/ , https://youtube.com/shorts/ , https://facebook.com/..."
              className={`w-full px-4 py-3 rounded-lg border ${
                urlError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500`}
              disabled={isLoading}
            />
            {urlError && <p className="mt-1 text-sm text-red-500">{urlError}</p>}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium mb-1">Archivo de Video o Audio</label>

            {!selectedFile ? (
              <label
                htmlFor="video-file"
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition ${
                  fileError
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                    : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Arrastra un archivo o haz clic para seleccionar
                </span>
                <span className="text-xs text-gray-400 mt-1">MP4, MOV, AVI, MKV, WEBM, MP3, WAV (max 500 MB)</span>
                <input
                  ref={fileInputRef}
                  id="video-file"
                  type="file"
                  accept={ACCEPTED_FORMATS}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(selectedFile.size)}</p>
                </div>
                {!isLoading && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="text-gray-400 hover:text-red-500 transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {fileError && <p className="mt-1 text-sm text-red-500">{fileError}</p>}
          </div>
        )}

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
