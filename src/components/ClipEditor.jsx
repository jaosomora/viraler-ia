import React, { useState, useEffect } from 'react';
import { useClips } from '../context/ClipsContext';

const KEYWORD_COLORS = [
  { hex: '#FDE047', name: 'Amarillo' },
  { hex: '#22D3EE', name: 'Cyan' },
  { hex: '#F472B6', name: 'Rosa' },
  { hex: '#FFFFFF', name: 'Blanco' },
];

const TONES = [
  { id: 'pregunta', label: 'Pregunta provocadora' },
  { id: 'storytelling', label: 'Storytelling' },
  { id: 'insight', label: 'Insight + CTA' },
];

const ClipEditor = ({ clip, onClose }) => {
  const { fontCatalog, updateClip, regenerateCaption, downloadClip, loadFonts } = useClips();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resolution, setResolution] = useState('1080');
  const [newKeyword, setNewKeyword] = useState('');

  useEffect(() => { if (!fontCatalog) loadFonts(); }, [fontCatalog, loadFonts]);
  useEffect(() => {
    if (!clip) return;
    setDraft({
      title: clip.title || '',
      hook: clip.hook || '',
      caption: clip.caption || '',
      keywords: Array.isArray(clip.keywords) ? clip.keywords : [],
      post_caption: clip.post_caption || '',
      post_caption_tone: clip.post_caption_tone || 'pregunta',
      font_hook: clip.font_hook || 'Anton',
      font_caption: clip.font_caption || 'InterSemiBold',
      font_keyword: clip.font_keyword || 'MontserratBold',
      keyword_color: clip.keyword_color || '#FDE047',
      camera_motion: clip.camera_motion || 'zoom-in',
      sub_position: clip.sub_position ?? 68,
    });
  }, [clip]);

  if (!clip || !draft) return null;

  const update = (patch) => setDraft(d => ({ ...d, ...patch }));

  const persist = async () => {
    setSaving(true);
    try {
      await updateClip(clip.id, draft);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleClose = async () => {
    await persist();
    onClose();
  };

  const handleRegenerateCaption = async (tone) => {
    update({ post_caption_tone: tone });
    setRegenerating(true);
    try {
      // Persistir cambios actuales primero para que el LLM use texto/hook actualizados
      await updateClip(clip.id, { ...draft, post_caption_tone: tone });
      const res = await regenerateCaption(clip.id, tone);
      update({ post_caption: res.post_caption });
    } catch (e) { alert(e.message); }
    setRegenerating(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await persist();
      await downloadClip({ ...clip, ...draft }, resolution);
    } catch (e) { alert(e.message); }
    setDownloading(false);
  };

  const addKeyword = () => {
    const k = newKeyword.trim();
    if (!k) return;
    update({ keywords: [...draft.keywords, k] });
    setNewKeyword('');
  };

  const removeKeyword = (idx) => {
    update({ keywords: draft.keywords.filter((_, i) => i !== idx) });
  };

  const fontOptions = (role) => (fontCatalog?.catalog?.[role] || []).map(f => (
    <option key={f.id} value={f.id} style={{ fontFamily: f.familyName || f.name }}>
      {f.name}{f.recommended ? ' ⭐' : ''}
    </option>
  ));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Editando · Score {clip.virality_score}</div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{draft.title}</h3>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-950/50 overflow-y-auto">
            <div className="aspect-[9/16] max-w-[280px] mx-auto bg-gradient-to-br from-indigo-900 via-purple-700 to-cyan-700 rounded-xl relative shadow-2xl overflow-hidden">
              <div className="absolute top-[13%] left-0 right-0 h-px bg-yellow-400/30"></div>
              <div className="absolute bottom-[25%] left-0 right-0 h-px bg-yellow-400/30"></div>
              <div className="absolute inset-0 flex flex-col justify-end p-4 pb-16 text-center text-white">
                <div className="text-2xl font-black uppercase leading-tight mb-2" style={{ fontFamily: 'Anton, sans-serif', textShadow: '0 2px 6px rgba(0,0,0,.8)' }}>
                  {draft.hook}
                </div>
                <div className="text-sm font-semibold" style={{ textShadow: '0 2px 4px rgba(0,0,0,.8)' }}>
                  {draft.caption.split(/\s+/).map((w, i) => {
                    const isKw = draft.keywords.some(k => k && new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(w.replace(/[.,!?]/g, '')));
                    return <span key={i} style={isKw ? { color: draft.keyword_color, fontWeight: 800 } : {}}>{w} </span>;
                  })}
                </div>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 text-center mt-3">Líneas amarillas: zona segura de Instagram</p>
          </div>

          <div className="lg:col-span-7 overflow-y-auto">
            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Texto del clip</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Título</label>
                    <input type="text" value={draft.title} onChange={e => update({ title: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Hook (línea grande, fuente impacto)</label>
                    <textarea rows={2} value={draft.hook} onChange={e => update({ hook: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white" style={{ fontFamily: 'Anton, sans-serif' }} />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Caption (línea de soporte)</label>
                    <textarea rows={2} value={draft.caption} onChange={e => update({ caption: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white" />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                    <label className="text-[11px] text-gray-500 mb-2 block">Palabras clave (énfasis dentro del caption)</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {draft.keywords.map((k, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer"
                          style={{ background: `${draft.keyword_color}20`, border: `1px solid ${draft.keyword_color}80`, color: draft.keyword_color }}
                          onClick={() => removeKeyword(i)}>
                          {k} ✕
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                        placeholder="Agregar palabra…"
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs" />
                      <button type="button" onClick={addKeyword} className="px-2 py-1 bg-purple-600 text-white rounded text-xs">+</button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Texto del post · para pegar al publicar</h4>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                  {TONES.map(t => (
                    <button key={t.id} type="button" disabled={regenerating}
                      onClick={() => handleRegenerateCaption(t.id)}
                      className={`px-2.5 py-1 rounded-md font-medium border transition ${draft.post_caption_tone === t.id
                        ? 'bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea rows={6} value={draft.post_caption} onChange={e => update({ post_caption: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none text-gray-900 dark:text-white"
                  placeholder={regenerating ? 'Regenerando…' : ''} disabled={regenerating} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">{(draft.post_caption || '').length} caracteres</span>
                  <button type="button" onClick={async () => {
                    try { await navigator.clipboard.writeText(draft.post_caption || ''); } catch {}
                  }} className="text-[11px] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
                    Copiar al portapapeles
                  </button>
                </div>
              </section>

              <section>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Tipografías</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Hook · fuente de impacto</label>
                    <select value={draft.font_hook} onChange={e => update({ font_hook: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {fontOptions('hook')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Caption · cuerpo legible</label>
                    <select value={draft.font_caption} onChange={e => update({ font_caption: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {fontOptions('caption')}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Palabras clave · énfasis</label>
                    <div className="flex gap-2">
                      <select value={draft.font_keyword} onChange={e => update({ font_keyword: e.target.value })}
                        className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white">
                        {fontOptions('keyword')}
                      </select>
                      <div className="flex gap-1.5">
                        {KEYWORD_COLORS.map(c => (
                          <button key={c.hex} title={c.name} type="button" onClick={() => update({ keyword_color: c.hex })}
                            className={`w-9 h-9 rounded transition ${draft.keyword_color === c.hex ? 'ring-2 ring-offset-2 ring-offset-gray-900' : ''}`}
                            style={{ background: c.hex, ringColor: c.hex }} />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Cámara y composición</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'zoom-in', emoji: '🔍', label: 'Zoom in' },
                    { id: 'zoom-out', emoji: '🔎', label: 'Zoom out' },
                    { id: 'static', emoji: '⏸', label: 'Estático' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => update({ camera_motion: o.id })}
                      className={`border rounded-lg p-3 text-center transition ${draft.camera_motion === o.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                      <div className="text-2xl mb-1">{o.emoji}</div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{o.label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="text-[11px] text-gray-500 mb-1.5 block">Altura del subtítulo</label>
                  <input type="range" min="40" max="90" value={draft.sub_position} onChange={e => update({ sub_position: +e.target.value })}
                    className="w-full accent-purple-500" />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>abajo</span><span className="text-yellow-500">zona segura IG</span><span>arriba</span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/50">
          <div className="text-xs text-gray-500">
            {saving ? 'Guardando…' : 'Los cambios se aplican al descargar (re-renderiza el video).'}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm">
              Cerrar
            </button>
            <select value={resolution} onChange={e => setResolution(e.target.value)}
              className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
              <option value="720">720p</option>
              <option value="1080">1080p</option>
              <option value="2k">2K</option>
              <option value="4k">4K</option>
            </select>
            <button onClick={handleDownload} disabled={downloading}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
              {downloading ? 'Renderizando…' : 'Descargar editado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
