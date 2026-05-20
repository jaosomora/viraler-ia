import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useClips } from '../context/ClipsContext';
import VideoPreview from './VideoPreview';
import TrimSlider from './TrimSlider';
import LiveCaptionOverlay, { FONT_FAMILY, FONT_WEIGHT } from './LiveCaptionOverlay';
import { CAPTION_TEMPLATES } from '../templates/captionTemplates';
import CollapsibleSection from './CollapsibleSection';
import Tooltip from './Tooltip';
import CaptionChunkEditor from './CaptionChunkEditor';
import TranscriptProseView from './TranscriptProseView';
import TransitionFader from './TransitionFader';

const KEYWORD_COLORS = [
  // Sutiles / brand-friendly
  { hex: '#FFFFFF', name: 'Blanco' },
  { hex: '#FCD34D', name: 'Mostaza' },
  { hex: '#FCA5A5', name: 'Coral suave' },
  { hex: '#86EFAC', name: 'Verde menta' },
  { hex: '#A78BFA', name: 'Lavanda' },
  { hex: '#7DD3FC', name: 'Azul cielo' },
  // Vibrantes (originales)
  { hex: '#FDE047', name: 'Amarillo' },
  { hex: '#22D3EE', name: 'Cyan' },
  { hex: '#F472B6', name: 'Rosa' },
  { hex: '#F87171', name: 'Rojo suave' },
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

// FONT_FAMILY y FONT_WEIGHT vienen de LiveCaptionOverlay para mantener un solo source-of-truth.

const fmtTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return `${m}:${sec.padStart(4, '0')}`;
};

const ClipEditor = ({ clip, onClose }) => {
  const { fontCatalog, activeJob, updateClip, regenerateCaption, downloadClip, exportClip, loadCaptions, loadFonts, applyFontsToAll, applyStyleToAll, redetectKeywords, userTemplates, loadUserTemplates, saveUserTemplate, deleteUserTemplate } = useClips();
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [applyingFonts, setApplyingFonts] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [previewKey, setPreviewKey] = useState(0); // remount VideoPreview si cambian params del base
  const [cropSliderValue, setCropSliderValue] = useState(50); // state local del slider de encuadre, se commitea a draft.crop_x_pct al soltar
  const [chunks, setChunks] = useState([]);
  const [renderMode, setRenderMode] = useState('overlay');
  const [captionsView, setCaptionsView] = useState('prose'); // 'prose' | 'list'
  const videoRef = useRef(null);
  const isLegacy = renderMode === 'burned-legacy';

  useEffect(() => { if (!fontCatalog) loadFonts(); }, [fontCatalog, loadFonts]);
  useEffect(() => { loadUserTemplates(); }, [loadUserTemplates]);

  useEffect(() => {
    if (!clip) return;
    const initial = {
      title: clip.title || '',
      hook: clip.hook || '',
      caption: clip.caption || '',
      keywords: Array.isArray(clip.keywords) ? clip.keywords : [],
      post_caption: clip.post_caption || '',
      post_caption_tone: clip.post_caption_tone || 'pregunta',
      post_captions_cache: clip.post_captions_cache || { pregunta: clip.post_caption || '', storytelling: '', insight: '' },
      start_seconds: clip.start_seconds,
      end_seconds: clip.end_seconds,
      font_hook: clip.font_hook || 'Anton',
      font_caption: clip.font_caption || 'InterSemiBold',
      font_keyword: clip.font_keyword || 'MontserratBold',
      keyword_color: clip.keyword_color || '#FDE047',
      camera_motion: clip.camera_motion || 'zoom-in',
      sub_position: clip.sub_position ?? 68,
      aspect_ratio: clip.aspect_ratio || '9:16',
      outline_enabled: clip.outline_enabled === undefined ? 1 : clip.outline_enabled,
      outline_thickness: clip.outline_thickness ?? 5,
      shadow_opacity: clip.shadow_opacity ?? 50,
      hook_font_size: clip.hook_font_size || null,
      caption_font_size: clip.caption_font_size || 58,
      hook_italic: clip.hook_italic ? 1 : 0,
      hook_underline: clip.hook_underline ? 1 : 0,
      caption_italic: clip.caption_italic ? 1 : 0,
      caption_underline: clip.caption_underline ? 1 : 0,
      keyword_italic: clip.keyword_italic ? 1 : 0,
      keyword_underline: clip.keyword_underline ? 1 : 0,
      keyword_bg_color: clip.keyword_bg_color || '',
      keyword_bg_opacity: clip.keyword_bg_opacity ?? 100,
      transition: clip.transition || 'none',
      hook_enabled: clip.hook_enabled === undefined ? 1 : clip.hook_enabled,
      hook_color: clip.hook_color || '#FFFFFF',
      caption_color: clip.caption_color || '#FFFFFF',
      outline_color: clip.outline_color || '#000000',
      karaoke_enabled: clip.karaoke_enabled ? 1 : 0,
      karaoke_dim_opacity: clip.karaoke_dim_opacity ?? 50,
      crop_x_pct: clip.crop_x_pct ?? 50,
      caption_overrides: (() => {
        try { return clip.caption_overrides ? (typeof clip.caption_overrides === 'string' ? JSON.parse(clip.caption_overrides) : clip.caption_overrides) : []; }
        catch { return []; }
      })(),
    };
    setDraft(initial);
    setOriginal(initial);
    setCropSliderValue(initial.crop_x_pct);
  }, [clip]);

  // Mantiene el slider sincronizado cuando draft.crop_x_pct cambia desde fuera
  // (clicks en presets Izq/Centro/Der, reset, o reload del clip). NO se ejecuta
  // mientras arrastrás el slider porque ahí solo cambia cropSliderValue, no draft.
  useEffect(() => {
    if (draft && draft.crop_x_pct !== cropSliderValue) {
      setCropSliderValue(draft.crop_x_pct);
    }
  }, [draft?.crop_x_pct]); // eslint-disable-line react-hooks/exhaustive-deps

  // Carga los chunks de subtítulos cuando se abre el editor.
  useEffect(() => {
    if (!clip?.id) return;
    let cancelled = false;
    loadCaptions(clip.id)
      .then(data => {
        if (cancelled) return;
        setChunks(data.chunks || []);
        setRenderMode(data.render_mode || 'overlay');
      })
      .catch(() => { if (!cancelled) setChunks([]); });
    return () => { cancelled = true; };
  }, [clip?.id, loadCaptions]);

  // Si el draft tiene overrides, aplicarlos sobre los chunks para sincronizar el preview en vivo.
  const liveChunks = useMemo(() => {
    if (!chunks.length) return [];
    const ovMap = new Map((draft?.caption_overrides || []).map(o => [o.idx, o]));
    return chunks.map(c => {
      const ov = ovMap.get(c.idx);
      return {
        ...c,
        text: ov?.text !== undefined ? ov.text : c.original_text || c.text,
        hidden: !!ov?.hidden,
      };
    });
  }, [chunks, draft?.caption_overrides]);

  const seekVideo = (t) => {
    const v = videoRef.current;
    if (!v) return;
    try { v.currentTime = Math.max(0, t); v.play().catch(() => {}); } catch {}
  };

  // Params que afectan el base.mp4. Si cambian, debemos persistir + regenerar antes de remontar el preview.
  const baseParamsSig = useMemo(() => {
    if (!draft) return '';
    return `${draft.start_seconds}|${draft.end_seconds}|${draft.aspect_ratio}|${draft.camera_motion}|${draft.transition}|${draft.crop_x_pct}`;
  }, [draft?.start_seconds, draft?.end_seconds, draft?.aspect_ratio, draft?.camera_motion, draft?.transition, draft?.crop_x_pct]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastSyncedSigRef = useRef(null);

  useEffect(() => {
    if (!draft || isLegacy) return;
    if (lastSyncedSigRef.current === null) {
      lastSyncedSigRef.current = baseParamsSig;
      return;
    }
    if (lastSyncedSigRef.current === baseParamsSig) return;

    const t = setTimeout(async () => {
      try {
        await updateClip(clip.id, {
          start_seconds: draft.start_seconds,
          end_seconds: draft.end_seconds,
          aspect_ratio: draft.aspect_ratio,
          camera_motion: draft.camera_motion,
          transition: draft.transition,
          crop_x_pct: draft.crop_x_pct,
        });
        lastSyncedSigRef.current = baseParamsSig;
        setPreviewKey(k => k + 1);
      } catch (e) {
        console.warn('[ClipEditor] auto-persist base params failed:', e.message);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [baseParamsSig, isLegacy, clip?.id, updateClip]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!clip || !draft || !original) return null;

  // El key SOLO usa previewKey (incrementado tras el POST de auto-persist), no baseParamsSig.
  // Antes ambos forzaban remount: el sig cambiaba al instante con el click, remontaba el preview
  // y el usuario veía el play button antes de que el POST terminara. Si clickeaba play impaciente,
  // el backend leía la DB todavía con el valor viejo → no regeneraba → devolvía el base.mp4 viejo.
  // Con previewKey solo, el preview viejo se mantiene visible hasta que la sync termina.
  const baseParamsKey = `${previewKey}`;
  const update = (patch) => setDraft(d => ({ ...d, ...patch }));

  const persist = async () => {
    setSaving(true);
    try { await updateClip(clip.id, draft); } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const handleClose = async () => { await persist(); onClose(); };

  const handleReset = () => { setDraft(original); };

  // Cambia el tono activo y carga el texto cacheado (sin llamar al LLM).
  const handleSelectTone = (tone) => {
    const cached = draft.post_captions_cache?.[tone] || '';
    update({ post_caption_tone: tone, post_caption: cached });
  };

  // Genera/regenera el texto del tono actual con LLM y lo guarda en cache.
  const handleRegenerateCaption = async () => {
    setRegenerating(true);
    try {
      const tone = draft.post_caption_tone;
      await updateClip(clip.id, { ...draft });
      const res = await regenerateCaption(clip.id, tone);
      update({
        post_caption: res.post_caption,
        post_captions_cache: { ...draft.post_captions_cache, [tone]: res.post_caption },
      });
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

  const handleExport = async () => {
    setExporting(true);
    try {
      await persist();
      if (isLegacy) {
        await downloadClip({ ...clip, ...draft }, clip.output_resolution || '1080');
      } else {
        await exportClip({ ...clip, ...draft }, clip.output_resolution || '1080');
      }
    } catch (e) { alert(e.message); }
    setExporting(false);
  };

  const applyTemplate = (tpl) => {
    update({ ...tpl.params });
  };

  const applyTemplateToAll = async (tpl) => {
    if (!activeJob) return;
    const total = activeJob.clips?.length || 0;
    if (!confirm(`Aplicar plantilla "${tpl.name}" a los ${total} clips de este job?\nLos cambios sobrescriben los estilos actuales.`)) return;
    try {
      await applyStyleToAll(activeJob.id, tpl.params);
      update({ ...tpl.params }); // también el clip activo
    } catch (e) { alert(e.message); }
  };

  const handleSaveCustomTemplate = async () => {
    const name = prompt('Nombre de tu plantilla:');
    if (!name?.trim()) return;
    // Snapshot de los params de estilo del draft actual
    const params = {
      font_hook: draft.font_hook, font_caption: draft.font_caption, font_keyword: draft.font_keyword,
      hook_color: draft.hook_color, caption_color: draft.caption_color, keyword_color: draft.keyword_color,
      keyword_bg_color: draft.keyword_bg_color, keyword_bg_opacity: draft.keyword_bg_opacity,
      outline_enabled: draft.outline_enabled, outline_color: draft.outline_color,
      outline_thickness: draft.outline_thickness, shadow_opacity: draft.shadow_opacity,
      hook_font_size: draft.hook_font_size, caption_font_size: draft.caption_font_size,
      hook_italic: draft.hook_italic, hook_underline: draft.hook_underline,
      caption_italic: draft.caption_italic, caption_underline: draft.caption_underline,
      keyword_italic: draft.keyword_italic, keyword_underline: draft.keyword_underline,
    };
    try { await saveUserTemplate(name.trim(), params); }
    catch (e) { alert(e.message); }
  };

  const handleDeleteCustomTemplate = async (e, tpl) => {
    e.stopPropagation();
    if (!confirm(`Eliminar plantilla "${tpl.name}"?`)) return;
    try { await deleteUserTemplate(tpl.id); }
    catch (err) { alert(err.message); }
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
    <option key={f.id} value={f.id} style={{ fontFamily: f.familyName || f.name, fontWeight: f.weight || 400, fontSize: '15px' }}>
      {f.name}{f.recommended ? ' ⭐ recomendada' : ''}
    </option>
  ));

  // Para que el <select> cerrado muestre el valor en la fuente seleccionada.
  const fontStyleFor = (role, id) => {
    const f = (fontCatalog?.catalog?.[role] || []).find(x => x.id === id);
    if (!f) return {};
    return { fontFamily: f.familyName || f.name, fontWeight: f.weight || 400 };
  };

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

  // Mapeo sub_position 40..90 → bottom percentage en preview (alineado con backend)
  const subPositionPercent = ((Math.max(40, Math.min(90, draft.sub_position)) - 40) / 50) * 47 + 10;

  // Construye text-shadow CSS combinando outline (multiple shadows tipo stroke) + sombra (un solo shadow grande)
  const textShadowCSS = (() => {
    const parts = [];
    if (draft.outline_enabled && draft.outline_thickness > 0) {
      const t = Math.round(draft.outline_thickness * 0.7); // pixel offset adaptado al preview
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        parts.push(`${dx * t}px ${dy * t}px 0 #000`);
      }
    }
    if (draft.shadow_opacity > 0) {
      const a = (draft.shadow_opacity / 100).toFixed(2);
      parts.push(`0 2px 6px rgba(0,0,0,${a})`);
    }
    return parts.join(', ') || 'none';
  })();

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
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] text-white z-20"
                title={`Cámara: ${draft.camera_motion}`}>
                {draft.camera_motion === 'zoom-in' ? '🔍 zoom in' : draft.camera_motion === 'zoom-out' ? '🔎 zoom out' : '⏸ estático'}
              </div>
              <VideoPreview
                key={baseParamsKey}
                ref={videoRef}
                clipId={clip.id}
                resolution={clip.output_resolution || '1080'}
                mode={isLegacy ? 'final' : 'base'}
                // Después del primer mount, si el preview se remonta es porque cambiaron
                // params del base (crop_x_pct, transición, etc). Auto-cargar para que
                // el cambio sea visible sin que el usuario tenga que clickear play de nuevo.
                autoPlayOnMount={previewKey > 0}
                overlay={
                  isLegacy ? (
                    // Legacy: el video ya tiene subs quemados, no aplicamos overlay sincronizado.
                    // Mostramos solo el hook fantasma como referencia visual del estilo configurado.
                    <div className="absolute left-[8%] right-[8%] text-center text-white pointer-events-none z-10 opacity-40"
                         style={{ bottom: `${subPositionPercent}%` }}>
                      <div className="font-black uppercase" style={{ fontFamily: hookFont, fontSize: '1.4rem', lineHeight: 0.95, textShadow: textShadowCSS }}>
                        {draft.hook}
                      </div>
                    </div>
                  ) : (
                    <>
                      <LiveCaptionOverlay videoRef={videoRef} chunks={liveChunks} draft={draft} />
                      <TransitionFader videoRef={videoRef} transition={draft.transition} />
                    </>
                  )
                }
              />
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-3 mb-5">
              {isLegacy
                ? 'Clip legacy: los subtítulos están quemados en el video. Re-genera el job para editarlos en vivo.'
                : 'Click en play y verás los subtítulos cambiar al ritmo del audio · Edita texto/estilos y se actualiza al instante.'}
            </p>

            <TrimSlider
              min={trimMin}
              max={trimMax}
              start={draft.start_seconds}
              end={draft.end_seconds}
              onChange={({ start, end }) => update({ start_seconds: start, end_seconds: end })}
            />
          </div>

          <div className="lg:col-span-7 overflow-y-auto">
            <div className="p-6 space-y-6">

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Plantillas</h4>
                  <button type="button" onClick={handleSaveCustomTemplate}
                    title="Guarda los estilos actuales como una plantilla reutilizable"
                    className="text-[11px] px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium">
                    + Guardar este estilo
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                  Click = aplica al clip actual. Shift+click o el botón "→ todos" aplica a TODOS los clips del job.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {CAPTION_TEMPLATES.map(tpl => (
                    <div key={tpl.id} className="relative group/tpl">
                      <button type="button"
                        onClick={(e) => e.shiftKey ? applyTemplateToAll(tpl) : applyTemplate(tpl)}
                        title={tpl.description + ' · shift+click para aplicar a todos los clips'}
                        className="w-full border border-gray-300 dark:border-gray-700 hover:border-purple-500 hover:shadow rounded-lg overflow-hidden transition">
                        <div className="aspect-[4/3] flex items-center justify-center" style={{ background: tpl.swatch.bg }}>
                          <div className="text-center px-2">
                            <div className="text-[11px] font-black uppercase mb-0.5" style={{ color: tpl.swatch.text, lineHeight: 1 }}>HOOK</div>
                            <div className="text-[9px] font-semibold" style={{ color: tpl.swatch.text }}>
                              con{' '}
                              <span style={{
                                color: tpl.swatch.accentBg ? tpl.params.keyword_color : tpl.swatch.accent,
                                backgroundColor: tpl.swatch.accentBg ? tpl.swatch.accent : 'transparent',
                                padding: tpl.swatch.accentBg ? '0 2px' : '0',
                                borderRadius: '1px',
                                fontWeight: 800,
                              }}>keyword</span>
                            </div>
                          </div>
                        </div>
                        <div className="px-2 py-1.5 bg-white dark:bg-gray-900 text-[11px] font-medium text-gray-900 dark:text-white">
                          {tpl.name}
                        </div>
                      </button>
                      <button type="button" onClick={() => applyTemplateToAll(tpl)}
                        title="Aplicar a todos los clips del job"
                        className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/70 backdrop-blur text-white text-[10px] rounded opacity-0 group-hover/tpl:opacity-100 transition hover:bg-purple-600">
                        → todos
                      </button>
                    </div>
                  ))}
                </div>

                {userTemplates.length > 0 && (
                  <>
                    <div className="text-[11px] text-gray-500 mt-4 mb-2 font-medium">Tus plantillas guardadas</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userTemplates.map(tpl => (
                        <div key={tpl.id} className="relative group/tpl">
                          <button type="button"
                            onClick={(e) => e.shiftKey ? applyTemplateToAll(tpl) : applyTemplate(tpl)}
                            title={`Tu plantilla · shift+click para aplicar a todos los clips`}
                            className="w-full border border-gray-300 dark:border-gray-700 hover:border-purple-500 hover:shadow rounded-lg overflow-hidden transition">
                            <div className="aspect-[4/3] flex items-center justify-center"
                              style={{ background: '#1f2937' }}>
                              <div className="text-center px-2">
                                <div className="text-[11px] font-black uppercase mb-0.5"
                                  style={{ color: tpl.params.hook_color || '#fff', lineHeight: 1 }}>HOOK</div>
                                <div className="text-[9px] font-semibold" style={{ color: tpl.params.caption_color || '#fff' }}>
                                  con{' '}
                                  <span style={{
                                    color: tpl.params.keyword_color || '#FDE047',
                                    backgroundColor: tpl.params.keyword_bg_color || 'transparent',
                                    padding: tpl.params.keyword_bg_color ? '0 2px' : '0',
                                    borderRadius: '1px',
                                    fontWeight: 800,
                                  }}>keyword</span>
                                </div>
                              </div>
                            </div>
                            <div className="px-2 py-1.5 bg-white dark:bg-gray-900 text-[11px] font-medium text-gray-900 dark:text-white truncate">
                              {tpl.name}
                            </div>
                          </button>
                          <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, tpl)}
                            title="Eliminar plantilla"
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white text-[10px] rounded opacity-0 group-hover/tpl:opacity-100 transition flex items-center justify-center">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <CollapsibleSection id="texto" icon="📝" title="Texto" defaultOpen={true}>
              <section>
                <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Texto del clip</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Título</label>
                    <input type="text" value={draft.title} onChange={e => update({ title: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Tooltip text="Texto grande estilo gancho que aparece quemado en los primeros 4 segundos del video. Sirve para enganchar al espectador antes de que haga scroll.">
                        <label className="text-[11px] text-gray-500">Hook (línea grande, fuente impacto)</label>
                      </Tooltip>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!draft.hook_enabled}
                          onChange={e => update({ hook_enabled: e.target.checked ? 1 : 0 })}
                          className="accent-purple-500 w-3.5 h-3.5" />
                        <span className="text-[11px] text-gray-600 dark:text-gray-400">
                          {draft.hook_enabled ? 'Mostrar gancho en el video' : 'Gancho desactivado'}
                        </span>
                      </label>
                    </div>
                    <textarea rows={2} value={draft.hook} onChange={e => update({ hook: e.target.value })}
                      disabled={!draft.hook_enabled}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white disabled:opacity-50"
                      style={{ fontFamily: hookFont }} />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">
                      Caption {isLegacy
                        ? '(línea de soporte)'
                        : <span className="text-gray-400">· nota interna · los subtítulos del video se editan abajo en "Subtítulos · texto por chunk"</span>}
                    </label>
                    <textarea rows={2} value={draft.caption} onChange={e => update({ caption: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm resize-none text-gray-900 dark:text-white" />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Tooltip text="Palabras del subtítulo que se pintan con color/fondo de keyword. El LLM las detecta automáticamente; puedes editarlas o re-detectar.">
                        <label className="text-[11px] text-gray-500">Palabras clave detectadas</label>
                      </Tooltip>
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
                    className="text-[11px] px-2.5 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50 flex items-center gap-1 font-medium"
                    title="Pide al LLM una nueva variación del texto en el tono seleccionado">
                    <svg className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {regenerating ? 'Generando…' : 'Pedir otra versión'}
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
                  Click en un tono para ver su versión cacheada. "Pedir otra versión" te genera una nueva con el tono activo.
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
              </CollapsibleSection>

              <CollapsibleSection id="estilo" icon="🎨" title="Estilo de texto" defaultOpen={true}>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Tipografías</h4>
                  <button type="button" onClick={handleApplyFontsToAll} disabled={applyingFonts}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-500 disabled:opacity-50">
                    {applyingFonts ? 'Aplicando…' : 'Aplicar a todos los clips'}
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Hook */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                    <label className="text-[11px] text-gray-500 block font-medium">Hook · fuente de impacto</label>
                    <select value={draft.font_hook} onChange={e => update({ font_hook: e.target.value })}
                      style={{ ...fontStyleFor('hook', draft.font_hook), fontSize: '17px' }}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white">
                      {fontOptions('hook')}
                      <option disabled>──── personalizada (próximamente) ────</option>
                      <option disabled>+ Subir mi propia fuente (.ttf)</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500 shrink-0">Tamaño</label>
                      <input type="range" min="40" max="180" step="2"
                        value={draft.hook_font_size || 90}
                        onChange={e => update({ hook_font_size: +e.target.value })}
                        className="flex-1 accent-purple-500" />
                      <input type="number" min="20" max="240"
                        value={draft.hook_font_size || 90}
                        onChange={e => update({ hook_font_size: +e.target.value })}
                        className="w-16 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                      <span className="text-[10px] text-gray-500">px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ hook_italic: draft.hook_italic ? 0 : 1 })}
                        title="Itálica"
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.hook_italic ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>I</button>
                      <button type="button" onClick={() => update({ hook_underline: draft.hook_underline ? 0 : 1 })}
                        title="Subrayado"
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.hook_underline ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>U</button>
                      <button type="button" onClick={() => update({ hook_font_size: null, hook_italic: 0, hook_underline: 0 })}
                        title="Auto (tamaño según largo)"
                        className="ml-auto text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1">
                        auto
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500 shrink-0">Color</label>
                      <input type="color" value={draft.hook_color}
                        onChange={e => update({ hook_color: e.target.value })}
                        className="w-9 h-7 border border-gray-300 dark:border-gray-700 rounded cursor-pointer" />
                      <input type="text" value={draft.hook_color}
                        onChange={e => {
                          const v = e.target.value.trim();
                          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ hook_color: v.startsWith('#') ? v : '#' + v });
                        }}
                        className="flex-1 max-w-[110px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono uppercase text-gray-900 dark:text-white" />
                      <button type="button" onClick={() => update({ hook_color: '#FFFFFF' })}
                        className="text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">reset</button>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                    <label className="text-[11px] text-gray-500 block font-medium">Caption · cuerpo legible</label>
                    <select value={draft.font_caption} onChange={e => update({ font_caption: e.target.value })}
                      style={{ ...fontStyleFor('caption', draft.font_caption), fontSize: '15px' }}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white">
                      {fontOptions('caption')}
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500 shrink-0">Tamaño</label>
                      <input type="range" min="30" max="120" step="2"
                        value={draft.caption_font_size}
                        onChange={e => update({ caption_font_size: +e.target.value })}
                        className="flex-1 accent-purple-500" />
                      <input type="number" min="20" max="200"
                        value={draft.caption_font_size}
                        onChange={e => update({ caption_font_size: +e.target.value })}
                        className="w-16 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs text-gray-900 dark:text-white" />
                      <span className="text-[10px] text-gray-500">px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ caption_italic: draft.caption_italic ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.caption_italic ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>I</button>
                      <button type="button" onClick={() => update({ caption_underline: draft.caption_underline ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.caption_underline ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>U</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-gray-500 shrink-0">Color</label>
                      <input type="color" value={draft.caption_color}
                        onChange={e => update({ caption_color: e.target.value })}
                        className="w-9 h-7 border border-gray-300 dark:border-gray-700 rounded cursor-pointer" />
                      <input type="text" value={draft.caption_color}
                        onChange={e => {
                          const v = e.target.value.trim();
                          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ caption_color: v.startsWith('#') ? v : '#' + v });
                        }}
                        className="flex-1 max-w-[110px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono uppercase text-gray-900 dark:text-white" />
                      <button type="button" onClick={() => update({ caption_color: '#FFFFFF' })}
                        className="text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">reset</button>
                    </div>
                  </div>

                  {/* Keyword */}
                  <div className="bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-800 rounded-lg p-3 space-y-2">
                    <label className="text-[11px] text-gray-500 block font-medium">Palabras clave · énfasis</label>
                    <select value={draft.font_keyword} onChange={e => update({ font_keyword: e.target.value })}
                      style={{ ...fontStyleFor('keyword', draft.font_keyword), fontSize: '15px' }}
                      className="w-full bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-900 dark:text-white">
                      {fontOptions('keyword')}
                    </select>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ keyword_italic: draft.keyword_italic ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.keyword_italic ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>I</button>
                      <button type="button" onClick={() => update({ keyword_underline: draft.keyword_underline ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.keyword_underline ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500' : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'}`}>U</button>
                    </div>

                    <div>
                      <label className="text-[11px] text-gray-500 mb-1.5 block">Color del texto</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {KEYWORD_COLORS.map(c => (
                          <button key={c.hex} title={c.name} type="button" onClick={() => update({ keyword_color: c.hex })}
                            className={`w-8 h-8 rounded transition border border-black/10 dark:border-white/20 ${draft.keyword_color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-purple-500 ring-offset-gray-50 dark:ring-offset-gray-900' : ''}`}
                            style={{ background: c.hex }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={draft.keyword_color}
                          onChange={e => update({ keyword_color: e.target.value })}
                          className="w-10 h-8 border border-gray-300 dark:border-gray-700 rounded cursor-pointer" />
                        <input type="text" value={draft.keyword_color}
                          onChange={e => {
                            const v = e.target.value.trim();
                            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
                              update({ keyword_color: v.startsWith('#') ? v : '#' + v });
                            }
                          }}
                          placeholder="#FDE047"
                          className="flex-1 max-w-[120px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono uppercase text-gray-900 dark:text-white" />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-200 dark:border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-gray-500 font-medium">Color de fondo de palabra</label>
                        <input type="checkbox"
                          checked={!!draft.keyword_bg_color}
                          onChange={e => update({ keyword_bg_color: e.target.checked ? '#000000' : '' })}
                          className="accent-purple-500 w-4 h-4" />
                      </div>
                      {draft.keyword_bg_color && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <input type="color" value={draft.keyword_bg_color}
                              onChange={e => update({ keyword_bg_color: e.target.value })}
                              className="w-10 h-8 border border-gray-300 dark:border-gray-700 rounded cursor-pointer" />
                            <input type="text" value={draft.keyword_bg_color}
                              onChange={e => {
                                const v = e.target.value.trim();
                                if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
                                  update({ keyword_bg_color: v.startsWith('#') ? v : '#' + v });
                                }
                              }}
                              placeholder="#000000"
                              className="flex-1 max-w-[120px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono uppercase text-gray-900 dark:text-white" />
                            <span className="text-[10px] text-gray-500 tabular-nums">{draft.keyword_bg_opacity}%</span>
                          </div>
                          <input type="range" min="0" max="100"
                            value={draft.keyword_bg_opacity}
                            onChange={e => update({ keyword_bg_opacity: +e.target.value })}
                            className="w-full accent-purple-500" />
                          <p className="text-[10px] text-gray-500 mt-1">El fondo es estilo "marker": se quema en el video como un highlight detrás de cada keyword.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <Tooltip text="El borde (outline) garantiza que el texto se lea sobre cualquier fondo. La sombra suaviza la lectura. Si tu texto es oscuro, cambia el color del borde a claro o desactívalo.">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Borde y sombra del texto</h4>
                </Tooltip>
                <div className="space-y-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-900 dark:text-white">Borde negro alrededor del texto</span>
                    <input type="checkbox" checked={!!draft.outline_enabled}
                      onChange={e => update({ outline_enabled: e.target.checked ? 1 : 0 })}
                      className="accent-purple-500 w-4 h-4" />
                  </label>
                  {draft.outline_enabled ? (
                    <>
                      <div>
                        <label className="text-[11px] text-gray-500 mb-1 block">Grosor del borde · {draft.outline_thickness}</label>
                        <input type="range" min="1" max="10" value={draft.outline_thickness}
                          onChange={e => update({ outline_thickness: +e.target.value })}
                          className="w-full accent-purple-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-500 shrink-0">Color del borde</label>
                        <input type="color" value={draft.outline_color}
                          onChange={e => update({ outline_color: e.target.value })}
                          className="w-9 h-7 border border-gray-300 dark:border-gray-700 rounded cursor-pointer" />
                        <input type="text" value={draft.outline_color}
                          onChange={e => {
                            const v = e.target.value.trim();
                            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ outline_color: v.startsWith('#') ? v : '#' + v });
                          }}
                          className="flex-1 max-w-[110px] bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 text-xs font-mono uppercase text-gray-900 dark:text-white" />
                        <button type="button" onClick={() => update({ outline_color: '#000000' })}
                          className="text-[10px] text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">reset</button>
                      </div>
                      <p className="text-[10px] text-gray-500 -mt-1">
                        Tip: si el texto es oscuro, usa borde claro (o desactívalo). Si es claro, borde negro.
                      </p>
                    </>
                  ) : null}
                  <div>
                    <label className="text-[11px] text-gray-500 mb-1 block">Opacidad de la sombra · {draft.shadow_opacity}%</label>
                    <input type="range" min="0" max="100" value={draft.shadow_opacity}
                      onChange={e => update({ shadow_opacity: +e.target.value })}
                      className="w-full accent-purple-500" />
                    <p className="text-[10px] text-gray-500 mt-1">0% = sin sombra · 100% = sombra negra fuerte</p>
                  </div>
                </div>

                <Tooltip text="Las palabras se 'iluminan' al ser dichas (estilo Submagic/Eddie). Las palabras no dichas aún se ven atenuadas; al pronunciarlas saltan al color full. Solo afecta al MP4 exportado, no al preview en vivo.">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 mt-4 font-semibold">Karaoke</h4>
                </Tooltip>
                <div className="space-y-2 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg p-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-gray-900 dark:text-white">Iluminar palabra al ser dicha</span>
                    <input type="checkbox" checked={!!draft.karaoke_enabled}
                      onChange={e => update({ karaoke_enabled: e.target.checked ? 1 : 0 })}
                      className="accent-purple-500 w-4 h-4" />
                  </label>
                  {draft.karaoke_enabled ? (
                    <div>
                      <label className="text-[11px] text-gray-500 mb-1 block">
                        Atenuación de palabras no dichas · {draft.karaoke_dim_opacity}%
                      </label>
                      <input type="range" min="20" max="80" value={draft.karaoke_dim_opacity}
                        onChange={e => update({ karaoke_dim_opacity: +e.target.value })}
                        className="w-full accent-purple-500" />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Más bajo = más atenuado (efecto karaoke fuerte). Solo se ve al exportar el MP4.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
              </CollapsibleSection>

              {!isLegacy && (
                <CollapsibleSection id="subtitulos" icon="💬" title="Subtítulos · texto y sync" defaultOpen={false} badge={`${chunks.length} chunks`}>
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs uppercase tracking-wide text-gray-500 font-semibold sr-only">
                      Subtítulos del clip
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{chunks.length} chunk{chunks.length === 1 ? '' : 's'}</span>
                      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-md p-0.5 text-[11px]">
                        <button type="button" onClick={() => setCaptionsView('prose')}
                          className={`px-2 py-0.5 rounded ${captionsView === 'prose' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          Texto fluido
                        </button>
                        <button type="button" onClick={() => setCaptionsView('list')}
                          className={`px-2 py-0.5 rounded ${captionsView === 'list' ? 'bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                          Lista editable
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                    {captionsView === 'prose'
                      ? 'Click en cualquier palabra para saltar a ese momento del video. Para corregir el texto cambia a "Lista editable".'
                      : 'Edita el texto de cada chunk. Click en el timestamp para saltar a ese momento. Los cambios se previsualizan al instante.'}
                  </p>
                  {captionsView === 'prose' ? (
                    <TranscriptProseView
                      chunks={liveChunks}
                      draft={draft}
                      videoRef={videoRef}
                      onSeek={seekVideo}
                    />
                  ) : (
                    <CaptionChunkEditor
                      chunks={chunks}
                      overrides={draft.caption_overrides}
                      onChange={(next) => update({ caption_overrides: next })}
                      onSeek={seekVideo}
                    />
                  )}
                </section>
                </CollapsibleSection>
              )}

              <CollapsibleSection id="movimiento" icon="🎬" title="Movimiento y transiciones" defaultOpen={false}>
              <section className="mb-5">
                <Tooltip text="Cuando la fuente es horizontal y el clip vertical, el recorte se hace por defecto desde el centro. Si tu video tiene dos personas lado a lado (entrevistas Zoom), el centro cae entre las dos: usá los presets o el slider para mover el encuadre hacia la persona que querés mostrar.">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Encuadre horizontal</h4>
                </Tooltip>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { id: 0, label: 'Izquierda', icon: '◧', sub: 'persona izq' },
                    { id: 50, label: 'Centro', icon: '▣', sub: 'default' },
                    { id: 100, label: 'Derecha', icon: '◨', sub: 'persona der' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => update({ crop_x_pct: o.id })}
                      className={`border rounded-lg p-3 text-center transition ${draft.crop_x_pct === o.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                      <div className="text-2xl mb-1">{o.icon}</div>
                      <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{o.label}</div>
                      <div className="text-[10px] text-gray-500">{o.sub}</div>
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] text-gray-500">Ajuste fino</label>
                    <span className="text-[10px] text-gray-500 font-mono">{cropSliderValue}%</span>
                  </div>
                  {/* El slider tiene state local (cropSliderValue) que cambia mientras arrastrás
                      para feedback visual. Solo al SOLTAR (onMouseUp / onTouchEnd / onPointerUp)
                      lo commiteamos a draft.crop_x_pct, lo que dispara el regen del base.mp4.
                      Sin esto, cada micro-movimiento encolaba un render ffmpeg → 502s. */}
                  <input type="range" min="0" max="100" step="1" value={cropSliderValue}
                    onChange={e => setCropSliderValue(+e.target.value)}
                    onMouseUp={e => update({ crop_x_pct: +e.target.value })}
                    onTouchEnd={e => update({ crop_x_pct: +e.target.value })}
                    onKeyUp={e => update({ crop_x_pct: +e.target.value })}
                    className="w-full accent-purple-500" />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                    <span>← izq</span><span>centro</span><span>der →</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
                    Mové el slider para ajustar fino — se aplica al soltar. Aplica solo si la fuente es más ancha que el formato del clip.
                  </p>
                </div>
              </section>

              <section>
                <Tooltip text="Movimiento lento que abarca todo el clip (zoom-in cinematográfico, zoom-out o estático). Distinto a las transiciones, que son punches en los bordes.">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Cámara y composición</h4>
                </Tooltip>
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
                <Tooltip text="Efecto en los primeros/últimos 0.5s del clip. Funciona junto al camera motion: el motion es lento y abarca todo, la transición es un punch rápido en los bordes.">
                  <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3 font-semibold">Transiciones</h4>
                </Tooltip>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'none', label: 'Ninguna', emoji: '—' },
                    { id: 'fade-cross', label: 'Fundido cruzado', emoji: '◐' },
                    { id: 'zoom-cross', label: 'Zoom cruzado', emoji: '⤧' },
                    { id: 'zoom-in', label: 'Acercar zoom', emoji: '🔍' },
                    { id: 'zoom-out', label: 'Alejar zoom', emoji: '🔎' },
                    { id: 'fade-in', label: 'Aparecer gradual', emoji: '◔' },
                    { id: 'fade-out', label: 'Desvanecer gradual', emoji: '◕' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => update({ transition: o.id })}
                      className={`border rounded-lg p-2 text-center transition ${draft.transition === o.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-300 dark:border-gray-700 hover:border-gray-400'}`}>
                      <div className="text-xl mb-0.5">{o.emoji}</div>
                      <div className="text-[10px] font-medium text-gray-700 dark:text-gray-300 leading-tight">{o.label}</div>
                    </button>
                  ))}
                </div>
              </section>
              </CollapsibleSection>

              <CollapsibleSection id="salida" icon="📐" title="Formato de salida" defaultOpen={false} badge={draft.aspect_ratio}>
              <section>
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
              </CollapsibleSection>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950/50 gap-3 flex-wrap">
          <div className="text-xs text-gray-500">
            {saving
              ? 'Guardando…'
              : isLegacy
                ? 'Clip legacy · descarga re-renderiza el MP4 completo.'
                : 'Edición en vivo · al exportar se quema el MP4 final con tus cambios (rápido, sobre el video base).'}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleClose} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm">
              Cerrar
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
              {exporting ? 'Exportando…' : isLegacy ? 'Descargar MP4' : 'Exportar MP4 con subtítulos'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
