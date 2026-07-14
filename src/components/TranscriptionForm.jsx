import React, { useState, useRef } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const ACCEPTED_FORMATS = '.mp4,.mov,.avi,.mkv,.webm,.m4v,.flv,.wmv,.mp3,.wav,.m4a,.ogg,.opus';

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

  const tabClass = (active) =>
    `flex-1 py-1.5 px-2 text-xs sm:text-sm font-semibold text-center rounded-full transition-colors ${
      active
        ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm'
        : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
    }`;

  return (
    <div className="card p-6 w-full max-w-3xl mx-auto">
      {/* Selector de modo */}
      <div className="flex gap-1 mb-6 p-1 rounded-full bg-ink-100 dark:bg-ink-900">
        <button
          type="button"
          onClick={() => { setMode('url'); setFileError(''); }}
          className={tabClass(mode === 'url')}
          disabled={isLoading}
        >
          Pegar URL
        </button>
        <button
          type="button"
          onClick={() => { setMode('file'); setUrlError(''); }}
          className={tabClass(mode === 'file')}
          disabled={isLoading}
        >
          Subir archivo
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'url' ? (
          <div>
            <label htmlFor="video-url" className="form-label">
              Link del video
            </label>
            <input
              id="video-url"
              type="text"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://www.instagram.com/reel/ , https://youtube.com/shorts/ , https://facebook.com/..."
              className={`input ${urlError ? 'border-danger dark:border-danger-bright' : ''}`}
              disabled={isLoading}
            />
            {urlError ? (
              <p className="mt-1.5 text-sm text-danger dark:text-danger-bright">{urlError}</p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
                Al transcribir desde URL podrás descargar el video original (máx 1 h).
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="form-label">Archivo de video o audio</label>

            {!selectedFile ? (
              <label
                htmlFor="video-file"
                className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                  fileError
                    ? 'border-danger/60 dark:border-danger-bright/60 bg-danger-soft/60 dark:bg-danger-deep/40'
                    : 'border-ink-300 dark:border-ink-600 bg-ink-100/60 dark:bg-ink-900/60 hover:bg-ink-100 dark:hover:bg-ink-900'
                } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-ink-400 dark:text-ink-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm text-ink-500 dark:text-ink-400">
                  Arrastra un archivo o haz clic para seleccionar
                </span>
                <span className="text-xs text-ink-400 dark:text-ink-500 mt-1">Video: MP4, MOV, AVI, MKV, WEBM · Audio: MP3, M4A, OGG, OPUS (WhatsApp) · max 500 MB</span>
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
              <div className="flex items-center gap-3 p-3 border border-ink-200 dark:border-ink-700 rounded-xl bg-ink-100 dark:bg-ink-900">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent dark:text-accent-bright flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs font-mono tabular-nums text-ink-400 dark:text-ink-500">{formatFileSize(selectedFile.size)}</p>
                </div>
                {!isLoading && (
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    aria-label="Quitar archivo"
                    className="text-ink-400 hover:text-danger dark:hover:text-danger-bright transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            )}

            {fileError && <p className="mt-1.5 text-sm text-danger dark:text-danger-bright">{fileError}</p>}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn btn-accent w-full"
        >
          {isLoading ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <span>Procesando…</span>
            </>
          ) : (
            <span>Transcribir →</span>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
          <p className="text-danger dark:text-danger-bright text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default TranscriptionForm;
