import React, { useState, useEffect } from 'react';
import { useClips } from '../context/ClipsContext';

const ClipsForm = () => {
  const { generate, loadFonts, fontCatalog, isGenerating, error } = useClips();
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => { if (!fontCatalog) loadFonts(); }, [fontCatalog, loadFonts]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'url') {
        if (!url.trim()) return;
        await generate({ url: url.trim() });
        setUrl('');
      } else {
        if (!file) return;
        await generate({ file });
        setFile(null);
      }
    } catch {/* handled by context */}
  };

  return (
    <details open className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <summary className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">+</span>
          <span className="font-semibold text-gray-900 dark:text-white">Generar nuevos clips</span>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      <form onSubmit={handleSubmit} className="p-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode('url')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'url' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            Desde URL
          </button>
          <button type="button" onClick={() => setMode('file')}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'file' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
            Subir archivo
          </button>
        </div>

        {mode === 'url' ? (
          <div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…  ·  Instagram, TikTok, Facebook"
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">YouTube · Instagram · TikTok · Facebook · máx 60 minutos</p>
          </div>
        ) : (
          <div>
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/40"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">MP4, MOV, MKV, WEBM · máx 1GB</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ~$0.10 / 14 min · Whisper + GPT-4o · highlights, hooks, post copy en una pasada
          </p>
          <button
            type="submit"
            disabled={isGenerating || (mode === 'url' ? !url.trim() : !file)}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white text-sm"
          >
            {isGenerating ? 'Procesando…' : '✨ Generar clips'}
          </button>
        </div>
      </form>
    </details>
  );
};

export default ClipsForm;
