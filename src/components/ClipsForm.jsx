import React, { useState, useEffect, useMemo } from 'react';
import { useClips } from '../context/ClipsContext';

const RESOLUTIONS = [
  { id: '720', label: '720×1280' },
  { id: '1080', label: '1080×1920 (recomendado)' },
  { id: '2k', label: '1440×2560 (2K)' },
  { id: '4k', label: '2160×3840 (4K)' },
];

const ClipsForm = () => {
  const { generate, loadFonts, fontCatalog, isGenerating, error } = useClips();
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);

  const [clipCount, setClipCount] = useState('auto');
  const [defaultResolution, setDefaultResolution] = useState('1080');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [fontPresetMode, setFontPresetMode] = useState('auto'); // auto | role | single
  const [fontHook, setFontHook] = useState('Anton');
  const [fontCaption, setFontCaption] = useState('InterSemiBold');
  const [fontKeyword, setFontKeyword] = useState('MontserratBold');
  const [singleFont, setSingleFont] = useState('Anton');

  useEffect(() => { if (!fontCatalog) loadFonts(); }, [fontCatalog, loadFonts]);

  const allFonts = useMemo(() => {
    if (!fontCatalog?.catalog) return [];
    const map = new Map();
    Object.values(fontCatalog.catalog).forEach(arr => arr.forEach(f => map.set(f.id, f)));
    return Array.from(map.values());
  }, [fontCatalog]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const options = {
      clipCount: clipCount === 'auto' ? null : parseInt(clipCount, 10),
      defaultResolution,
      aspectRatio,
      fontPresetMode,
      fontHook: fontPresetMode === 'single' ? singleFont : fontHook,
      fontCaption: fontPresetMode === 'single' ? singleFont : fontCaption,
      fontKeyword: fontPresetMode === 'single' ? singleFont : fontKeyword,
    };
    try {
      if (mode === 'url') {
        if (!url.trim()) return;
        await generate({ url: url.trim(), options });
        setUrl('');
      } else {
        if (!file) return;
        await generate({ file, options });
        setFile(null);
      }
    } catch {/* manejado por context */}
  };

  const fontOpts = (role) => (fontCatalog?.catalog?.[role] || []).map(f => (
    <option key={f.id} value={f.id}>{f.name}{f.recommended ? ' ⭐' : ''}</option>
  ));

  return (
    <details open className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
      <summary className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 list-none">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">1</span>
          <span className="font-semibold text-gray-900 dark:text-white">Generar nuevos clips</span>
        </div>
        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </summary>

      <form onSubmit={handleSubmit} className="p-6 border-t border-gray-200 dark:border-gray-700 grid lg:grid-cols-3 gap-6">
        {/* Columna izquierda: fuente + dropdowns (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block font-semibold">Fuente del video</label>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setMode('url')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'url' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                URL
              </button>
              <button type="button" onClick={() => setMode('file')}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${mode === 'file' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                Subir archivo
              </button>
            </div>
            {mode === 'url' ? (
              <>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  disabled={isGenerating} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">YouTube · Instagram · TikTok · Facebook · máx 60 minutos</p>
              </>
            ) : (
              <>
                <input type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-300"
                  disabled={isGenerating} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">MP4, MOV, MKV, WEBM · máx 1GB</p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block font-semibold">Cantidad de clips</label>
              <select value={clipCount} onChange={e => setClipCount(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                <option value="auto">Auto (LLM decide)</option>
                <option value="3">3 clips</option>
                <option value="5">5 clips</option>
                <option value="10">10 clips</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block font-semibold">Resolución de salida</label>
              <select value={defaultResolution} onChange={e => setDefaultResolution(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100">
                {RESOLUTIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 block font-semibold">Formato</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '9:16', label: '9:16', sub: 'IG / TikTok' },
                { id: '1:1', label: '1:1', sub: 'Feed cuadrado' },
                { id: '4:5', label: '4:5', sub: 'Feed vertical' },
              ].map(a => (
                <button key={a.id} type="button" onClick={() => setAspectRatio(a.id)}
                  className={`border rounded-lg px-3 py-2 text-center transition ${aspectRatio === a.id ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 text-gray-700 dark:text-gray-300'}`}>
                  <div className="text-sm font-medium">{a.label}</div>
                  <div className="text-[10px] opacity-70">{a.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: tipografías + botón (1/3) */}
        <div className="space-y-4">
          <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 block font-semibold">Tipografías</label>

          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'auto'} onChange={() => setFontPresetMode('auto')} className="mt-0.5 accent-purple-500" />
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Auto · Recomendado</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">Anton + Inter SB + Mont Bold</div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'role'} onChange={() => setFontPresetMode('role')} className="mt-0.5 accent-purple-500" />
              <div className="flex-1"><div className="text-sm text-gray-900 dark:text-white">Personalizar por rol</div></div>
            </label>
            {fontPresetMode === 'role' && (
              <div className="space-y-2 pl-6">
                <select value={fontHook} onChange={e => setFontHook(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs">
                  {fontOpts('hook')}
                </select>
                <select value={fontCaption} onChange={e => setFontCaption(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs">
                  {fontOpts('caption')}
                </select>
                <select value={fontKeyword} onChange={e => setFontKeyword(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs">
                  {fontOpts('keyword')}
                </select>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'single'} onChange={() => setFontPresetMode('single')} className="mt-0.5 accent-purple-500" />
              <div className="flex-1"><div className="text-sm text-gray-900 dark:text-white">Una sola fuente</div></div>
            </label>
            {fontPresetMode === 'single' && (
              <div className="pl-6">
                <select value={singleFont} onChange={e => setSingleFont(e.target.value)}
                  className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-2 py-1.5 text-xs">
                  {allFonts.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <button type="submit"
            disabled={isGenerating || (mode === 'url' ? !url.trim() : !file)}
            className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white text-sm">
            {isGenerating ? 'Procesando…' : '✨ Generar clips'}
          </button>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center">~$0.46 / hora de video procesado</p>
        </div>
      </form>
    </details>
  );
};

export default ClipsForm;
