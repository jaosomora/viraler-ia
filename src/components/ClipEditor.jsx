import React, { useState, useEffect, useMemo } from 'react';
import { useClips } from '../context/ClipsContext';
import VideoPreview from './VideoPreview';

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

const ASPECT_RATIOS = [
  { id: '9:16', label: '9:16', sub: 'IG / TikTok' },
  { id: '1:1', label: '1:1', sub: 'Feed cuadrado' },
  { id: '4:5', label: '4:5', sub: 'Feed vertical' },
];

const FONT_FAMILY = {
  Anton: "'Anton', sans-serif",
  BebasNeue: "'Bebas Neue', sans-serif",
  LeagueSpartan: "'League Spartan', sans-serif",
  MontserratBlack: "'Montserrat', sans-serif",
  Oswald: "'Oswald', sans-serif",
  InterSemiBold: "'Inter', sans-serif",
  InterBold: "'Inter', sans-serif",
  MontserratSemiBold: "'Montserrat', sans-serif",
  MontserratBold: "'Montserrat', sans-serif",
  PoppinsBold: "'Poppins', sans-serif",
  LeagueSpartanBold: "'League Spartan', sans-serif",
};

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

const ClipEditor = ({ clip, onClose }) => {
  const { fontCatalog, activeJob, updateClip, regenerateCaption, downloadClip, loadFonts, applyFontsToAll, redetectKeywords } = useClips();
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [applyingFonts, setApplyingFonts] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [previewKey, setPreviewKey] = useState(0); // remount VideoPreview tras descargar

  useEffect(() => { if (!fontCatalog) loadFonts(); }, [fontCatalog, loadFonts]);

  useEffect(() => {
    if (!clip) return;
    const initial = {
      title: clip.title || '',
      hook: clip.hook || '',
      caption: clip.caption || '',
      keywords: Array.isArray(clip.keywords) ? clip.keywords : [],
      post_caption: clip.post_caption || '',
      post_caption_tone: clip.post_caption_tone || 'pregunta',
      start_seconds: clip.start_seconds,
      end_seconds: clip.end_seconds,
      font_hook: clip.font_hook || 'Anton',
      font_caption: clip.font_caption || 'InterSemiBold',
      font_keyword: clip.font_keyword || 'MontserratBold',
      keyword_color: clip.keyword_color || '#FDE047',
      camera_motion: clip.camera_motion || 'zoom-in',
      sub_position: clip.sub_position ?? 68,
      aspect_ratio: clip.aspect_ratio || '9:16',
    };
    setDraft(initial);
    setOriginal(initial);
  }, [clip]);

  if (!clip || !draft || !original) return null;

  const update = (patch) => setDraft(d => ({ ...d, ...patch }));

  const persist = async () => {
    setSaving(true);
    try { await updateClip(clip.id, draft); } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleClose = async () => { await persist(); onClose(); };

  const handleReset = () => { setDraft(original); };

  // Solo selecciona el tono (no regenera). El usuario debe pulsar "Regenerar" para aplicar.
  const handleSelectTone = (tone) => update({ post_caption_tone: tone });

  const handleRegenerateCaption = async () => {
    setRegenerating(true);
    try {
      await updateClip(clip.id, { ...draft });
      const res = await regenerateCaption(clip.id, draft.post_caption_tone);
      update({ post_caption: res.post_caption });
    } catch (e) { alert(e.message); }
    setRegenerating(false);
  };

  const handleRedetectKeywords = async () => {
    setRedetecting(true);
    try {
      await updateClip(clip.id, { caption: draft.caption, hook: draft.hook });
      const res = await redetectKeywords(clip.id);
      update({ keywords: res.keywords || [] });
    } catch (e) { alert(e.message); }
    setRedetecting(false);
  };

  const handleApplyFontsToAll = async () => {
    if (!confirm('¿Aplicar estas fuentes (hook, caption, keyword + color) a TODOS los clips de este job?')) return;
    setApplyingFonts(true);
    try {
      await applyFontsToAll(clip.job_id, {
        font_hook: draft.font_hook,
        font_caption: draft.font_caption,
        font_keyword: draft.font_keyword,
        keyword_color: draft.keyword_color,
      });
      alert('Fuentes aplicadas a todos los clips');
    } catch (e) { alert(e.message); }
    setApplyingFonts(false);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await persist();
      await downloadClip({ ...clip, ...draft }, clip.output_resolution || '1080');
      setPreviewKey(k => k + 1); // forzar reload del VideoPreview con MP4 actualizado
    } catch (e) { alert(e.message); }
    setDownloading(false);
  };

  const removeKeyword = (idx) => update({ keywords: draft.keywords.filter((_, i) => i !== idx) });

  const addKeyword = () => {
    const k = newKeyword.trim();
    if (!k) return;
    if (draft.keywords.some(x => x.toLowerCase() === k.toLowerCase())) {
      setNewKeyword(''); return;
    }
    update({ keywords: [...draft.keywords, k] });
    setNewKeyword('');
  };

  const fontOptions = (role) => (fontCatalog?.catalog?.[role] || []).map(f => (
    <option key={f.id} value={f.id}>{f.name}{f.recommended ? ' ⭐ recomendada' : ''}</option>
  ));

  const dur = draft.end_seconds - draft.start_seconds;
  const hashtagCount = (draft.post_caption.match(/#\w+/g) || []).length;

  // Posición en la lista de clips del job
  const clipsList = activeJob?.clips || [];
  const clipPos = clipsList.findIndex(c => c.id === clip.id) + 1;
  const clipTotal = clipsList.length;

  // Para el trim slider: bounds amplios (±15s sobre el clip actual, mínimo 0)
  const sourceMax = activeJob?.duration_seconds || draft.end_seconds + 30;
  const trimMin = Math.max(0, draft.start_seconds - 30);
  const trimMax = Math.min(sourceMax, draft.end_seconds + 30);

  const aspectClass = draft.aspect_ratio === '1:1' ? 'aspect-square' : draft.aspect_ratio === '4:5' ? 'aspect-[4/5]' : 'aspect-[9/16]';
  const hookFont = FONT_FAMILY[draft.font_hook] || FONT_FAMILY.Anton;
  const captionFont = FONT_FAMILY[draft.font_caption] || FONT_FAMILY.InterSemiBold;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">Editando clip {clipPos} de {clipTotal} · Score {clip.virality_score}</div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">{draft.title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleReset} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
              Restablecer cambios
            </button>
            <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-800 p-6 bg-gray-50 dark:bg-gray-950/50 overflow-y-auto">
            <div className={`${aspectClass} max-w-[280px] mx-auto bg-gradient-to-br from-indigo-900 via-purple-700 to-cyan-700 rounded-xl relative shadow-2xl overflow-hidden group`}>
              <div className="absolute top-[13%] left-0 right-0 h-px bg-yellow-400/30 z-10"></div>
              <div className="absolute bottom-[25%] left-0 right-0 h-px bg-yellow-400/30 z-10"></div>
              <VideoPreview
                key={previewKey}
                clipId={clip.id}
                resolution={clip.output_resolution || '1080'}
                overlay={
                  <div className="absolute left-[8%] right-[8%] bottom-[32%] text-center text-white pointer-events-none z-10">
                    <div className="font-black uppercase mb-2" style={{ fontFamily: hookFont, fontSize: '1.4rem', lineHeight: 0.95, textShadow: '0 2px 6px rgba(0,0,0,.85)' }}>
                      {draft.hook}
                    </div>
                    <div className="text-xs font-semibold" style={{ fontFamily: captionFont, textShadow: '0 2px 4px rgba(0,0,0,.85)' }}>
                      {draft.caption.split(/(\s+)/).map((token, i) => {
                        const trimmed = token.replace(/[.,!?]/g, '').toLowerCase();
                        const isKw = draft.keywords.some(k => k && k.toLowerCase() === trimmed);
                        return isKw
                          ? <span key={i} style={{ color: draft.keyword_color, fontWeight: 800, fontFamily: FONT_FAMILY[draft.font_keyword] }}>{token}</span>
                          : <span key={i}>{token}</span>;
                      })}
                    </div>
                  </div>
                }
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-3 mb-5">
              Click en el preview para reproducir · Líneas amarillas: zona segura de Instagram
            </p>

            {/* Trim */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold uppercase tracking-wide">Recortar</span>
                <span className="font-mono">{fmtTime(dur)}</span>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Inicio · {fmtTime(draft.start_seconds)}</label>
                <input type="range" min={trimMin} max={Math.max(trimMin + 1, draft.end_seconds - 5)} step={0.1}
                  value={draft.start_seconds}
                  onChange={(e) => update({ start_seconds: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-1 block">Fin · {fmtTime(draft.end_seconds)}</label>
                <input type="range" min={Math.min(trimMax - 1, draft.start_seconds + 5)} max={trimMax} step={0.1}
                  value={draft.end_seconds}
                  onChange={(e) => update({ end_seconds: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500" />
              </div>
              <p className="text-[10px] text-gray-500">Rango: {fmtTime(trimMin)} – {fmtTime(trimMax)}</p>
            </div>
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
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white" style={{ fontFamily: hookFont }} />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Caption (línea de soporte)</label>
                    <textarea rows={2} value={draft.caption} onChange={e => update({ caption: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white" />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[11px] text-gray-500">Palabras clave detectadas</label>
                      <button type="button" onClick={handleRedetectKeywords} disabled={redetecting}
                        className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 disabled:opacity-50">
                        {redetecting ? 'Detectando…' : 'Volver a detectar'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {draft.keywords.map((k, i) => (
                        <span key={i} onClick={() => removeKeyword(i)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer"
                          style={{ background: `${draft.keyword_color}20`, border: `1px solid ${draft.keyword_color}80`, color: draft.keyword_color }}>
                          {k} ✕
                        </span>
                      ))}
                      {draft.keywords.length === 0 && <span className="text-[11px] text-gray-400">Sin keywords. Agrégalas manualmente o usa "Volver a detectar".</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                        placeholder="Agregar palabra clave manualmente…"
                        className="flex-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                      <button type="button" onClick={addKeyword} disabled={!newKeyword.trim()}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded text-xs font-medium">+</button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                    Texto del post <span className="text-gray-400 normal-case">· para pegar al publicar</span>
                  </h4>
                  <button type="button" onClick={handleRegenerateCaption} disabled={regenerating}
                    className="text-[11px] px-2 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 flex items-center gap-1 font-medium">
                    <svg className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {regenerating ? 'Generando…' : 'Regenerar con este tono'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                  {TONES.map(t => (
                    <button key={t.id} type="button" disabled={regenerating}
                      onClick={() => handleSelectTone(t.id)}
                      className={`px-2.5 py-1 rounded-md font-medium border transition ${draft.post_caption_tone === t.id
                        ? 'bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-300'
                        : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400'}`}>
                      {t.label}
                    </button>
                  ))}
                  <button type="button" disabled
                    title="Próximamente: pega tu framework personal"
                    className="px-2.5 py-1 rounded-md font-medium border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 italic cursor-not-allowed">
                    + Mi prompt
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  Selecciona un tono y pulsa "Regenerar" para que el LLM genere un nuevo texto.
                </p>
                <textarea rows={6} value={draft.post_caption} onChange={e => update({ post_caption: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm leading-relaxed resize-none text-gray-900 dark:text-white"
                  placeholder={regenerating ? 'Regenerando…' : ''} disabled={regenerating} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-gray-500">{(draft.post_caption || '').length} caracteres · {hashtagCount} hashtags</span>
                  <button type="button" onClick={() => navigator.clipboard.writeText(draft.post_caption || '').catch(() => {})}
                    className="text-[11px] text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md">
                    Copiar al portapapeles
                  </button>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Tipografías</h4>
                  <button type="button" onClick={handleApplyFontsToAll} disabled={applyingFonts}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 disabled:opacity-50">
                    {applyingFonts ? 'Aplicando…' : 'Aplicar a todos los clips'}
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Hook · fuente de impacto</label>
                    <select value={draft.font_hook} onChange={e => update({ font_hook: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white">
                      {fontOptions('hook')}
                      <option disabled>──── personalizada (próximamente) ────</option>
                      <option disabled>+ Subir mi propia fuente (.ttf)</option>
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
                            className={`w-9 h-9 rounded transition ${draft.keyword_color === c.hex ? 'ring-2 ring-offset-2 ring-offset-gray-50 dark:ring-offset-gray-900' : ''}`}
                            style={{ background: c.hex, '--tw-ring-color': c.hex }} />
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
                  <input type="range" min="40" max="90" value={draft.sub_position}
                    onChange={e => update({ sub_position: +e.target.value })}
                    className="w-full accent-purple-500" />
                  <div className="flex justify-between text-[10px] text-gray-500">
                    <span>abajo</span><span className="text-yellow-500">zona segura IG</span><span>arriba</span>
                  </div>
                </div>
              </section>

              <section>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Formato de salida</h4>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_RATIOS.map(a => (
                    <button key={a.id} type="button" onClick={() => update({ aspect_ratio: a.id })}
                      className={`border rounded-lg p-3 text-center transition ${draft.aspect_ratio === a.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{a.label}</div>
                      <div className="text-[10px] text-gray-500">{a.sub}</div>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/50 gap-3 flex-wrap">
          <div className="text-xs text-gray-500">
            {saving ? 'Guardando…' : 'Los cambios se aplican al descargar (re-renderiza el video).'}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm">
              Cerrar
            </button>
            <button onClick={handleDownload} disabled={downloading}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
              {downloading ? 'Renderizando…' : 'Descargar clip editado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
