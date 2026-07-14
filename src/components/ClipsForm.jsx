import React, { useState, useEffect, useMemo } from 'react';
import { useClips } from '../context/ClipsContext';

const RESOLUTIONS = [
  { id: '720', label: '720×1280' },
  { id: '1080', label: '1080×1920 (recomendado)' },
  { id: '2k', label: '1440×2560 (2K)' },
  { id: '4k', label: '2160×3840 (4K)' },
];

const ClipsForm = () => {
  const { generate, loadFonts, fontCatalog, isGenerating, uploadProgress, error } = useClips();
  const [mode, setMode] = useState('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);

  const [selectionMode, setSelectionMode] = useState('auto'); // 'auto' | 'manual'
  const [hookAutoEnabled, setHookAutoEnabled] = useState(true);
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
      mode: selectionMode,
      hookAutoEnabled: hookAutoEnabled ? 1 : 0,
      clipCount: selectionMode === 'manual' ? null : (clipCount === 'auto' ? null : parseInt(clipCount, 10)),
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
    <option key={f.id} value={f.id} style={{ fontFamily: f.familyName || f.name, fontWeight: f.weight || 400 }}>
      {f.name}{f.recommended ? ' ⭐' : ''}
    </option>
  ));

  return (
    <details open className="card overflow-hidden">
      <summary className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-ink-100/60 dark:hover:bg-ink-800/40 transition-colors list-none">
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Paso 1 · Configuración</span>
          <span className="font-display font-semibold tracking-tight">Generar nuevos clips</span>
        </div>
        <svg className="w-5 h-5 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
      </summary>

      <form onSubmit={handleSubmit} className="p-6 border-t hairline grid lg:grid-cols-3 gap-6">
        {/* Columna izquierda: fuente + dropdowns (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Modo de selección: Auto (IA) vs Manual (yo elijo) */}
          <div>
            <label className="form-label">¿Quién elige qué va en los clips?</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setSelectionMode('auto')}
                className={`text-left border rounded-xl px-3 py-2.5 transition-colors ${selectionMode === 'auto' ? 'border-accent dark:border-accent-bright bg-accent-soft dark:bg-accent-deep' : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'}`}>
                <div className="text-sm font-medium text-ink-950 dark:text-paper">✨ Automático <span className="text-[10px] uppercase tracking-wide text-accent dark:text-accent-bright ml-1">IA</span></div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">La IA segmenta por capítulos y elige los mejores momentos.</div>
              </button>
              <button type="button" onClick={() => setSelectionMode('manual')}
                className={`text-left border rounded-xl px-3 py-2.5 transition-colors ${selectionMode === 'manual' ? 'border-accent dark:border-accent-bright bg-accent-soft dark:bg-accent-deep' : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600'}`}>
                <div className="text-sm font-medium text-ink-950 dark:text-paper">✂️ Yo elijo</div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400 mt-0.5">Te muestro la transcripción y marcas los fragmentos que quieres como clips.</div>
              </button>
            </div>
            {selectionMode === 'manual' && (
              <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-ink-500 dark:text-ink-400">
                <input type="checkbox" checked={hookAutoEnabled} onChange={e => setHookAutoEnabled(e.target.checked)}
                  className="accent-accent dark:accent-accent-bright" />
                <span>Que la IA genere gancho, nota y hashtags para cada fragmento</span>
              </label>
            )}
          </div>

          <div>
            <label className="form-label">Fuente del video</label>
            <div className="flex gap-1 mb-3 p-1 rounded-full bg-ink-100 dark:bg-ink-900">
              <button type="button" onClick={() => setMode('url')}
                className={`flex-1 py-1.5 px-4 text-sm font-semibold text-center rounded-full transition-colors ${mode === 'url' ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'}`}>
                URL
              </button>
              <button type="button" onClick={() => setMode('file')}
                className={`flex-1 py-1.5 px-4 text-sm font-semibold text-center rounded-full transition-colors ${mode === 'file' ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm' : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'}`}>
                Subir archivo
              </button>
            </div>
            {mode === 'url' ? (
              <>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                  className="input"
                  disabled={isGenerating} />
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-1.5">YouTube · Instagram · TikTok · Facebook · máx 60 minutos</p>
              </>
            ) : (
              <>
                <input type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
                  onChange={(e) => setFile(e.target.files[0])}
                  className="w-full text-sm text-ink-500 dark:text-ink-400 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:cursor-pointer file:bg-accent-soft dark:file:bg-accent-deep file:text-accent dark:file:text-accent-bright"
                  disabled={isGenerating} />
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-1.5">MP4, MOV, MKV, WEBM · máx 1GB</p>
              </>
            )}
          </div>

          <div className={`grid gap-4 ${selectionMode === 'auto' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {selectionMode === 'auto' && (
              <div>
                <label className="form-label">Cantidad de clips</label>
                <select value={clipCount} onChange={e => setClipCount(e.target.value)}
                  className="input">
                  <option value="auto">Auto (decide la IA)</option>
                  <option value="3">3 clips</option>
                  <option value="5">5 clips</option>
                  <option value="10">10 clips</option>
                </select>
              </div>
            )}
            <div>
              <label className="form-label">Resolución de salida</label>
              <select value={defaultResolution} onChange={e => setDefaultResolution(e.target.value)}
                className="input">
                {RESOLUTIONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Formato</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '9:16', label: '9:16', sub: 'IG / TikTok' },
                { id: '1:1', label: '1:1', sub: 'Feed cuadrado' },
                { id: '4:5', label: '4:5', sub: 'Feed vertical' },
              ].map(a => (
                <button key={a.id} type="button" onClick={() => setAspectRatio(a.id)}
                  className={`border rounded-xl px-3 py-2 text-center transition-colors ${aspectRatio === a.id ? 'border-accent dark:border-accent-bright bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright' : 'border-ink-200 dark:border-ink-700 hover:border-ink-300 dark:hover:border-ink-600 text-ink-500 dark:text-ink-400'}`}>
                  <div className="text-sm font-semibold">{a.label}</div>
                  <div className="text-[10px] opacity-70">{a.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Columna derecha: tipografías + botón (1/3) */}
        <div className="space-y-4">
          <label className="form-label">Tipografías</label>

          <div className="bg-ink-100 dark:bg-ink-900 border hairline rounded-xl p-3 space-y-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'auto'} onChange={() => setFontPresetMode('auto')} className="mt-0.5 accent-accent dark:accent-accent-bright" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink-950 dark:text-paper">Auto · Recomendado</div>
                <div className="text-[11px] text-ink-500 dark:text-ink-400">Anton + Inter SemiBold + Montserrat Bold</div>
              </div>
            </label>

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'role'} onChange={() => setFontPresetMode('role')} className="mt-0.5 accent-accent dark:accent-accent-bright" />
              <div className="flex-1"><div className="text-sm text-ink-950 dark:text-paper">Elegir una fuente por rol</div><div className="text-[11px] text-ink-500 dark:text-ink-400">Gancho, cuerpo y palabras destacadas por separado.</div></div>
            </label>
            {fontPresetMode === 'role' && (
              <div className="space-y-2 pl-6">
                <select value={fontHook} onChange={e => setFontHook(e.target.value)}
                  className="input px-2 py-1.5 text-xs dark:bg-ink-850">
                  {fontOpts('hook')}
                </select>
                <select value={fontCaption} onChange={e => setFontCaption(e.target.value)}
                  className="input px-2 py-1.5 text-xs dark:bg-ink-850">
                  {fontOpts('caption')}
                </select>
                <select value={fontKeyword} onChange={e => setFontKeyword(e.target.value)}
                  className="input px-2 py-1.5 text-xs dark:bg-ink-850">
                  {fontOpts('keyword')}
                </select>
              </div>
            )}

            <label className="flex items-start gap-2 cursor-pointer">
              <input type="radio" name="font-mode" checked={fontPresetMode === 'single'} onChange={() => setFontPresetMode('single')} className="mt-0.5 accent-accent dark:accent-accent-bright" />
              <div className="flex-1"><div className="text-sm text-ink-950 dark:text-paper">Una sola fuente</div><div className="text-[11px] text-ink-500 dark:text-ink-400">La misma tipografía para todo.</div></div>
            </label>
            {fontPresetMode === 'single' && (
              <div className="pl-6">
                <select value={singleFont} onChange={e => setSingleFont(e.target.value)}
                  className="input px-2 py-1.5 text-xs dark:bg-ink-850">
                  {allFonts.map(f => (
                    <option key={f.id} value={f.id} style={{ fontFamily: f.familyName || f.name, fontWeight: f.weight || 400 }}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright px-3 py-2 text-xs">
              {error}
            </div>
          )}

          <button type="submit"
            disabled={isGenerating || (mode === 'url' ? !url.trim() : !file)}
            className="btn btn-accent w-full">
            {isGenerating
              ? (uploadProgress
                  ? `Subiendo… ${Math.round(uploadProgress.pct * 100)}% (${(uploadProgress.loaded / 1024 / 1024).toFixed(1)}/${(uploadProgress.total / 1024 / 1024).toFixed(1)} MB)`
                  : 'Procesando…')
              : 'Generar clips →'}
          </button>
          {isGenerating && uploadProgress && (
            <div className="h-1.5 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden -mt-1">
              <div className="h-full bg-accent dark:bg-accent-bright transition-all duration-200"
                   style={{ width: `${Math.round(uploadProgress.pct * 100)}%` }} />
            </div>
          )}
        </div>
      </form>
    </details>
  );
};

export default ClipsForm;
