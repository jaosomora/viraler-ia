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
import { useToast, useConfirm } from './ui/feedback';

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
  { id: 'pregunta', label: 'Pregunta' },
  { id: 'storytelling', label: 'Historia' },
  { id: 'insight', label: 'Idea + llamada a la acción' },
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
  const toast = useToast();
  const confirmDialog = useConfirm();
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
  const [cropPreviewActive, setCropPreviewActive] = useState(false); // true mientras arrastrás el slider → muestra overlay con still del source
  const [cropThumbUrl, setCropThumbUrl] = useState(null); // blob URL del still del source (fetched con Bearer token)
  const [chunks, setChunks] = useState([]);
  const [renderMode, setRenderMode] = useState('overlay');
  const [captionsView, setCaptionsView] = useState('prose'); // 'prose' | 'list'
  // Acordeón: solo una sección abierta a la vez. Default: Plantillas.
  const [openSection, setOpenSection] = useState('plantillas');
  const sectionProps = (id) => ({
    open: openSection === id,
    onToggle: () => setOpenSection(openSection === id ? null : id),
  });
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

  // Prefetch del thumbnail del source (con Bearer token) para preview en vivo del slider.
  // Se descarga 1 sola vez por clip; las modificaciones del slider solo cambian object-position CSS.
  useEffect(() => {
    if (!clip?.id) return;
    let revokeUrl = null;
    let cancelled = false;
    const token = localStorage.getItem('token');
    fetch(`/api/clips/${clip.id}/source-thumbnail`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setCropThumbUrl(url);
      })
      .catch(() => {});
    return () => { cancelled = true; if (revokeUrl) URL.revokeObjectURL(revokeUrl); };
  }, [clip?.id]);

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
    try { await updateClip(clip.id, draft); } catch (e) { toast(e.message, { type: 'danger' }); }
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
    } catch (e) { toast(e.message, { type: 'danger' }); }
    setRegenerating(false);
  };

  const handleRedetectKeywords = async () => {
    setRedetecting(true);
    try {
      await updateClip(clip.id, { caption: draft.caption, hook: draft.hook });
      const res = await redetectKeywords(clip.id);
      update({ keywords: res.keywords || [] });
    } catch (e) { toast(e.message, { type: 'danger' }); }
    setRedetecting(false);
  };

  const handleApplyFontsToAll = async () => {
    const okFonts = await confirmDialog({
      title: 'Aplicar fuentes a todos',
      message: '¿Aplicar estas fuentes (hook, caption, keyword + color) a TODOS los clips de este job?',
      confirmLabel: 'Aplicar',
    });
    if (!okFonts) return;
    setApplyingFonts(true);
    try {
      await applyFontsToAll(clip.job_id, {
        font_hook: draft.font_hook,
        font_caption: draft.font_caption,
        font_keyword: draft.font_keyword,
        keyword_color: draft.keyword_color,
      });
      toast('Fuentes aplicadas a todos los clips', { type: 'ok' });
    } catch (e) { toast(e.message, { type: 'danger' }); }
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
    } catch (e) { toast(e.message, { type: 'danger' }); }
    setExporting(false);
  };

  const applyTemplate = (tpl) => {
    update({ ...tpl.params });
  };

  const applyTemplateToAll = async (tpl) => {
    if (!activeJob) return;
    const total = activeJob.clips?.length || 0;
    const okTpl = await confirmDialog({
      title: `Aplicar plantilla "${tpl.name}"`,
      message: `Se aplicará a los ${total} clips de este job. Los cambios sobrescriben los estilos actuales.`,
      confirmLabel: 'Aplicar',
    });
    if (!okTpl) return;
    try {
      await applyStyleToAll(activeJob.id, tpl.params);
      update({ ...tpl.params }); // también el clip activo
    } catch (e) { toast(e.message, { type: 'danger' }); }
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
    catch (e) { toast(e.message, { type: 'danger' }); }
  };

  const handleDeleteCustomTemplate = async (e, tpl) => {
    e.stopPropagation();
    const okDelete = await confirmDialog({
      title: '¿Eliminar plantilla?',
      message: `Se eliminará "${tpl.name}".`,
      danger: true,
    });
    if (!okDelete) return;
    try { await deleteUserTemplate(tpl.id); }
    catch (err) { toast(err.message, { type: 'danger' }); }
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
    return {
      fontFamily: f.familyName || f.name,
      fontWeight: f.weight || 400,
      fontStyle: f.italic ? 'italic' : 'normal',
    };
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
    <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="card shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-ink-200 dark:border-ink-700 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
              <span className="eyebrow">Editor de clip</span>
              <span className="text-xs text-ink-400 dark:text-ink-500 tabular-nums">Editando clip {clipPos} de {clipTotal} · Score {clip.virality_score}</span>
            </div>
            <h3 className="font-display font-semibold tracking-tight text-lg truncate">{draft.title}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleReset} className="btn btn-ghost btn-sm">
              Restablecer cambios
            </button>
            <button onClick={handleClose} aria-label="Cerrar editor" className="w-9 h-9 rounded-full border border-ink-200 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-500 dark:text-ink-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Superficie de video: siempre oscura, aunque el modo sea claro. La clase
              `dark` ancla las variantes dark: de todos los descendientes (incl. TrimSlider)
              para que los controles se rendericen claros sobre ink-950 en ambos modos. */}
          <div className="dark lg:col-span-5 border-b lg:border-b-0 lg:border-r border-ink-200 dark:border-ink-700 p-6 bg-ink-950 overflow-y-auto">
            <div className={`${aspectClass} max-w-[280px] mx-auto bg-ink-900 ring-1 ring-ink-700 rounded-xl relative overflow-hidden group`}>
              <div className="absolute top-[13%] left-0 right-0 h-px bg-warn-bright/40 z-10"></div>
              <div className="absolute bottom-[25%] left-0 right-0 h-px bg-warn-bright/40 z-10"></div>
              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur rounded text-[10px] text-white z-20"
                title={`Cámara: ${draft.camera_motion}`}>
                {draft.camera_motion === 'zoom-in' ? '🔍 zoom in' : draft.camera_motion === 'zoom-out' ? '🔎 zoom out' : '⏸ estático'}
              </div>
              {/* Preview en vivo durante el drag del slider de encuadre.
                  Tapa el video con un still del source (16:9 sin crop) y aplica
                  object-position con el valor del slider — el usuario ve EXACTAMENTE
                  cómo va a quedar el crop antes de soltar. Al soltar, el state oculta
                  el overlay y arranca el regen del base.mp4 con el valor final. */}
              {cropPreviewActive && cropThumbUrl && (
                <div className="absolute inset-0 z-30 bg-black">
                  <img
                    src={cropThumbUrl}
                    alt="preview de encuadre"
                    className="w-full h-full"
                    style={{ objectFit: 'cover', objectPosition: `${cropSliderValue}% center` }}
                  />
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[10px] rounded-full font-mono pointer-events-none">
                    encuadre {cropSliderValue}%
                  </div>
                </div>
              )}
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
            <p className="text-[11px] text-ink-400 text-center mt-3 mb-5">
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

              {/* 1 · Elegir un estilo base */}
              <CollapsibleSection id="plantillas" icon="🎨" title="Elegir un estilo base" {...sectionProps('plantillas')}>
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Plantillas listas para usar</h5>
                  <button type="button" onClick={handleSaveCustomTemplate}
                    title="Guarda los estilos actuales como una plantilla reutilizable"
                    className="btn btn-ghost btn-sm">
                    Guardar el estilo actual
                  </button>
                </div>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
                  Click = solo este clip · Click + Shift = todos los clips del job.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {CAPTION_TEMPLATES.map(tpl => (
                    <div key={tpl.id} className="relative group/tpl">
                      <button type="button"
                        onClick={(e) => e.shiftKey ? applyTemplateToAll(tpl) : applyTemplate(tpl)}
                        title={tpl.description + ' · shift+click para aplicar a todos los clips'}
                        className="w-full border border-ink-200 dark:border-ink-700 hover:border-accent dark:hover:border-accent-bright rounded-lg overflow-hidden transition">
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
                        <div className="px-2 py-1.5 bg-white dark:bg-ink-900 text-[11px] font-medium text-ink-950 dark:text-paper">
                          {tpl.name}
                        </div>
                      </button>
                      <button type="button" onClick={() => applyTemplateToAll(tpl)}
                        title="Aplicar a todos los clips del job"
                        className="absolute top-1 right-1 px-1.5 py-0.5 bg-ink-950/70 backdrop-blur text-paper text-[10px] rounded-full opacity-0 group-hover/tpl:opacity-100 transition hover:bg-accent hover:text-white dark:hover:bg-accent-bright dark:hover:text-ink-950">
                        → todos
                      </button>
                    </div>
                  ))}
                </div>

                {userTemplates.length > 0 && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mt-4 mb-2">Mis plantillas guardadas</div>
                    <div className="grid grid-cols-3 gap-2">
                      {userTemplates.map(tpl => (
                        <div key={tpl.id} className="relative group/tpl">
                          <button type="button"
                            onClick={(e) => e.shiftKey ? applyTemplateToAll(tpl) : applyTemplate(tpl)}
                            title={`Tu plantilla · shift+click para aplicar a todos los clips`}
                            className="w-full border border-ink-200 dark:border-ink-700 hover:border-accent dark:hover:border-accent-bright rounded-lg overflow-hidden transition">
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
                            <div className="px-2 py-1.5 bg-white dark:bg-ink-900 text-[11px] font-medium text-ink-950 dark:text-paper truncate">
                              {tpl.name}
                            </div>
                          </button>
                          <button type="button" onClick={(e) => handleDeleteCustomTemplate(e, tpl)}
                            title="Eliminar plantilla"
                            className="absolute top-1 right-1 w-5 h-5 bg-danger hover:bg-[#9A3C31] dark:bg-danger-bright dark:hover:bg-[#EBA49B] text-white dark:text-ink-950 text-[10px] rounded-full opacity-0 group-hover/tpl:opacity-100 transition flex items-center justify-center">
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
              </CollapsibleSection>

              {/* 2 · Definir el formato y el encuadre */}
              <CollapsibleSection id="lienzo" icon="🎬" title="Definir el formato y el encuadre" badge={draft.aspect_ratio} {...sectionProps('lienzo')}>
                <section className="mb-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">Formato del video</h4>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-3">
                    Define la forma final. Cambiarlo después puede mover el texto y el encuadre fuera de lugar.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map(a => (
                      <button key={a.id} type="button" onClick={() => update({ aspect_ratio: a.id })}
                        className={`border rounded-lg p-3 text-center transition ${draft.aspect_ratio === a.id
                          ? 'border-accent bg-accent-soft dark:border-accent-bright dark:bg-accent-deep'
                          : 'border-ink-200 dark:border-ink-700 hover:border-ink-400 dark:hover:border-ink-500'}`}>
                        <div className="text-xs font-medium text-ink-950 dark:text-paper">{a.label}</div>
                        <div className="text-[10px] text-ink-500 dark:text-ink-400">{a.sub}</div>
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <Tooltip text="Útil cuando el video original tiene a una persona a un lado. Mueve el corte para mantenerla centrada.">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-2">Qué parte del cuadro mostrar</h4>
                  </Tooltip>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-3">
                    Útil cuando el video original tiene a una persona a un lado.
                  </p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { id: 0, label: 'Lado izquierdo', icon: '◧' },
                      { id: 50, label: 'Centro', icon: '▣' },
                      { id: 100, label: 'Lado derecho', icon: '◨' },
                    ].map(o => (
                      <button key={o.id} type="button" onClick={() => update({ crop_x_pct: o.id })}
                        className={`border rounded-lg p-3 text-center transition ${draft.crop_x_pct === o.id
                          ? 'border-accent bg-accent-soft dark:border-accent-bright dark:bg-accent-deep'
                          : 'border-ink-200 dark:border-ink-700 hover:border-ink-400 dark:hover:border-ink-500'}`}>
                        <div className="text-2xl mb-1">{o.icon}</div>
                        <div className="text-xs font-medium text-ink-950 dark:text-paper">{o.label}</div>
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] text-ink-500 dark:text-ink-400">Ajuste fino</label>
                      <span className="text-[10px] text-ink-500 dark:text-ink-400 font-mono tabular-nums">{cropSliderValue}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="1" value={cropSliderValue}
                      onMouseDown={() => setCropPreviewActive(true)}
                      onTouchStart={() => setCropPreviewActive(true)}
                      onFocus={() => setCropPreviewActive(true)}
                      onChange={e => setCropSliderValue(+e.target.value)}
                      onMouseUp={e => { setCropPreviewActive(false); update({ crop_x_pct: +e.target.value }); }}
                      onTouchEnd={e => { setCropPreviewActive(false); update({ crop_x_pct: +e.target.value }); }}
                      onKeyUp={e => { setCropPreviewActive(false); update({ crop_x_pct: +e.target.value }); }}
                      onBlur={e => { if (cropPreviewActive) { setCropPreviewActive(false); update({ crop_x_pct: +e.target.value }); } }}
                      className="w-full accent-accent dark:accent-accent-bright" />
                    <div className="flex justify-between text-[10px] text-ink-500 dark:text-ink-400 mt-0.5">
                      <span>← izquierda</span><span>centro</span><span>derecha →</span>
                    </div>
                    <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-1.5 leading-snug">
                      Mueve el deslizador para ver el encuadre en vivo. Al soltar, se aplica al video.
                    </p>
                  </div>
                </section>
              </CollapsibleSection>

              {/* 3 · Revisar lo que se transcribió */}
              {!isLegacy && (
                <CollapsibleSection id="subtitulos" icon="💬" title="Revisar lo que se transcribió" badge={`${chunks.length} líneas`} {...sectionProps('subtitulos')}>
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm text-ink-500 dark:text-ink-400 font-semibold sr-only">
                      Subtítulos del clip
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono tabular-nums text-ink-400 dark:text-ink-500">{chunks.length} línea{chunks.length === 1 ? '' : 's'}</span>
                      <div className="flex bg-ink-100 dark:bg-ink-900 rounded-full p-0.5 text-[11px]">
                        <button type="button" onClick={() => setCaptionsView('prose')}
                          className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${captionsView === 'prose' ? 'bg-white dark:bg-ink-850 shadow-sm text-ink-950 dark:text-paper' : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'}`}>
                          Texto fluido
                        </button>
                        <button type="button" onClick={() => setCaptionsView('list')}
                          className={`px-2.5 py-0.5 rounded-full font-medium transition-colors ${captionsView === 'list' ? 'bg-white dark:bg-ink-850 shadow-sm text-ink-950 dark:text-paper' : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'}`}>
                          Lista editable
                        </button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
                    {captionsView === 'prose'
                      ? 'Click en cualquier palabra para saltar a ese momento del video. Para corregir el texto cambia a "Lista editable".'
                      : 'Edita el texto de cada línea. Click en el tiempo para saltar a ese momento. Los cambios se previsualizan al instante.'}
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

              {/* 4 · Escribir el texto del clip */}
              <CollapsibleSection id="texto" icon="📝" title="Escribir el texto del clip" {...sectionProps('texto')}>
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">Texto sobre el video</h4>
                <div className="space-y-3">
                  <div>
                    <label className="form-label">Título <span className="text-ink-400 dark:text-ink-500">· solo interno, no aparece en el video</span></label>
                    <input type="text" value={draft.title} onChange={e => update({ title: e.target.value })}
                      className="input" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Tooltip text="Línea grande que aparece quemada en los primeros 4 segundos del video. Sirve para captar al espectador antes de que haga scroll.">
                        <label className="text-sm font-medium text-ink-500 dark:text-ink-400">Gancho <span className="text-ink-400 dark:text-ink-500">· línea grande, primeros segundos</span></label>
                      </Tooltip>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={!!draft.hook_enabled}
                          onChange={e => update({ hook_enabled: e.target.checked ? 1 : 0 })}
                          className="accent-accent dark:accent-accent-bright w-3.5 h-3.5" />
                        <span className="text-[11px] text-ink-500 dark:text-ink-400">
                          {draft.hook_enabled ? 'Mostrar gancho en el video' : 'Gancho desactivado'}
                        </span>
                      </label>
                    </div>
                    <textarea rows={2} value={draft.hook} onChange={e => update({ hook: e.target.value })}
                      disabled={!draft.hook_enabled}
                      className="input resize-none"
                      style={{ fontFamily: hookFont }} />
                  </div>
                  <div>
                    <label className="form-label">
                      Nota {isLegacy
                        ? '(línea de soporte)'
                        : <span className="text-ink-400 dark:text-ink-500">· resumen interno · los subtítulos del video se editan en "Revisar lo que se transcribió"</span>}
                    </label>
                    <textarea rows={2} value={draft.caption} onChange={e => update({ caption: e.target.value })}
                      className="input resize-none" />
                  </div>
                  <div className="bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Tooltip text="Palabras del subtítulo que se pintan con color o fondo distinto. La IA las detecta automáticamente y se pueden editar o detectar de nuevo.">
                        <label className="text-[11px] text-ink-500 dark:text-ink-400">Palabras destacadas</label>
                      </Tooltip>
                      <button type="button" onClick={handleRedetectKeywords} disabled={redetecting}
                        className="text-[11px] font-medium link-accent disabled:opacity-50">
                        {redetecting ? 'Detectando…' : 'Detectar de nuevo'}
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
                      {draft.keywords.length === 0 && <span className="text-[11px] text-ink-400 dark:text-ink-500">Sin palabras destacadas. Agrégalas manualmente o usa "Detectar de nuevo".</span>}
                    </div>
                    <div className="flex gap-1.5">
                      <input type="text" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(); } }}
                        placeholder="Agregar palabra manualmente…"
                        className="flex-1 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2.5 py-1 text-xs text-ink-950 dark:text-paper placeholder-ink-400 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      <button type="button" onClick={addKeyword} disabled={!newKeyword.trim()}
                        className="btn btn-accent btn-sm">+</button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                    Texto para publicar <span className="text-ink-400 dark:text-ink-500 normal-case">· lo que copias y pegas al subirlo</span>
                  </h4>
                  <button type="button" onClick={handleRegenerateCaption} disabled={regenerating}
                    className="btn btn-accent btn-sm"
                    title="Pide una nueva variación del texto en el tono seleccionado">
                    <svg className={`w-3 h-3 ${regenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    {regenerating ? 'Generando…' : 'Pedir otra versión'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3 text-[11px]">
                  {TONES.map(t => (
                    <button key={t.id} type="button" disabled={regenerating}
                      onClick={() => handleSelectTone(t.id)}
                      className={`px-2.5 py-1 rounded-full font-medium border transition ${draft.post_caption_tone === t.id
                        ? 'bg-accent-soft dark:bg-accent-deep border-accent dark:border-accent-bright text-accent dark:text-accent-bright'
                        : 'bg-ink-100 dark:bg-ink-800 border-ink-200 dark:border-ink-700 text-ink-500 dark:text-ink-400 hover:border-ink-400 dark:hover:border-ink-500'}`}>
                      {t.label}
                    </button>
                  ))}
                  <button type="button" disabled
                    title="Próximamente: pega tu framework personal"
                    className="px-2.5 py-1 rounded-full font-medium border border-dashed border-ink-300 dark:border-ink-600 text-ink-400 dark:text-ink-500 italic cursor-not-allowed">
                    + Mi propio prompt
                  </button>
                </div>
                <p className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
                  Click en un tono para ver su versión guardada. "Pedir otra versión" genera una nueva con el tono activo.
                </p>
                <textarea rows={6} value={draft.post_caption} onChange={e => update({ post_caption: e.target.value })}
                  className="input leading-relaxed resize-none"
                  placeholder={regenerating ? 'Regenerando…' : ''} disabled={regenerating} />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-mono tabular-nums text-ink-500 dark:text-ink-400">{(draft.post_caption || '').length} caracteres · {hashtagCount} hashtags</span>
                  <button type="button" onClick={() => navigator.clipboard.writeText(draft.post_caption || '').catch(() => {})}
                    className="btn btn-ghost btn-sm">
                    Copiar al portapapeles
                  </button>
                </div>
              </section>
              </CollapsibleSection>

              {/* 5 · Afinar la tipografía y los colores */}
              <CollapsibleSection id="estilo" icon="🖌️" title="Afinar la tipografía y los colores" {...sectionProps('estilo')}>
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400">Tipografías</h4>
                  <button type="button" onClick={handleApplyFontsToAll} disabled={applyingFonts}
                    className="text-[11px] font-medium link-accent disabled:opacity-50">
                    {applyingFonts ? 'Aplicando…' : 'Aplicar a todos los clips'}
                  </button>
                </div>
                <div className="space-y-4">
                  {/* Hook */}
                  <div className="bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-semibold text-ink-950 dark:text-paper">Gancho · línea de impacto</h5>
                      <span className="inline-flex items-center justify-center min-w-[48px] h-8 rounded-lg bg-ink-950 px-2 shrink-0" title="Vista previa con la fuente y color actuales">
                        <span style={{
                          ...fontStyleFor('hook', draft.font_hook),
                          color: draft.hook_color,
                          fontStyle: draft.hook_italic ? 'italic' : (fontStyleFor('hook', draft.font_hook).fontStyle || 'normal'),
                          textDecoration: draft.hook_underline ? 'underline' : 'none',
                        }} className="text-lg leading-none">Aa</span>
                      </span>
                    </div>
                    <select value={draft.font_hook} onChange={e => update({ font_hook: e.target.value })}
                      style={{ ...fontStyleFor('hook', draft.font_hook), fontSize: '17px' }}
                      className="input">
                      {fontOptions('hook')}
                      <option disabled>──── personalizada (próximamente) ────</option>
                      <option disabled>+ Subir mi propia fuente (.ttf)</option>
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 shrink-0">Tamaño</label>
                      <input type="range" min="40" max="180" step="2"
                        value={draft.hook_font_size || 90}
                        onChange={e => update({ hook_font_size: +e.target.value })}
                        className="flex-1 accent-accent dark:accent-accent-bright" />
                      <input type="number" min="20" max="240"
                        value={draft.hook_font_size || 90}
                        onChange={e => update({ hook_font_size: +e.target.value })}
                        className="w-16 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono tabular-nums text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      <span className="text-[10px] text-ink-500 dark:text-ink-400">px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ hook_italic: draft.hook_italic ? 0 : 1 })}
                        title="Itálica"
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.hook_italic ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>I</button>
                      <button type="button" onClick={() => update({ hook_underline: draft.hook_underline ? 0 : 1 })}
                        title="Subrayado"
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.hook_underline ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>U</button>
                      <button type="button" onClick={() => update({ hook_font_size: null, hook_italic: 0, hook_underline: 0 })}
                        title="Auto (tamaño según largo)"
                        className="ml-auto text-[10px] text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper px-2 py-1">
                        auto
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 shrink-0">Color</label>
                      <input type="color" value={draft.hook_color}
                        onChange={e => update({ hook_color: e.target.value })}
                        className="w-9 h-7 border border-ink-200 dark:border-ink-700 rounded-lg cursor-pointer" />
                      <input type="text" value={draft.hook_color}
                        onChange={e => {
                          const v = e.target.value.trim();
                          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ hook_color: v.startsWith('#') ? v : '#' + v });
                        }}
                        className="flex-1 max-w-[110px] rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono uppercase text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      <button type="button" onClick={() => update({ hook_color: '#FFFFFF' })}
                        className="text-[10px] text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper">reset</button>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-semibold text-ink-950 dark:text-paper">Cuerpo · subtítulos</h5>
                      <span className="inline-flex items-center justify-center min-w-[48px] h-8 rounded-lg bg-ink-950 px-2 shrink-0" title="Vista previa con la fuente y color actuales">
                        <span style={{
                          ...fontStyleFor('caption', draft.font_caption),
                          color: draft.caption_color,
                          fontStyle: draft.caption_italic ? 'italic' : (fontStyleFor('caption', draft.font_caption).fontStyle || 'normal'),
                          textDecoration: draft.caption_underline ? 'underline' : 'none',
                        }} className="text-lg leading-none">Aa</span>
                      </span>
                    </div>
                    <select value={draft.font_caption} onChange={e => update({ font_caption: e.target.value })}
                      style={{ ...fontStyleFor('caption', draft.font_caption), fontSize: '15px' }}
                      className="input">
                      {fontOptions('caption')}
                    </select>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 shrink-0">Tamaño</label>
                      <input type="range" min="30" max="120" step="2"
                        value={draft.caption_font_size}
                        onChange={e => update({ caption_font_size: +e.target.value })}
                        className="flex-1 accent-accent dark:accent-accent-bright" />
                      <input type="number" min="20" max="200"
                        value={draft.caption_font_size}
                        onChange={e => update({ caption_font_size: +e.target.value })}
                        className="w-16 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono tabular-nums text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      <span className="text-[10px] text-ink-500 dark:text-ink-400">px</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ caption_italic: draft.caption_italic ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.caption_italic ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>I</button>
                      <button type="button" onClick={() => update({ caption_underline: draft.caption_underline ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.caption_underline ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>U</button>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 shrink-0">Color</label>
                      <input type="color" value={draft.caption_color}
                        onChange={e => update({ caption_color: e.target.value })}
                        className="w-9 h-7 border border-ink-200 dark:border-ink-700 rounded-lg cursor-pointer" />
                      <input type="text" value={draft.caption_color}
                        onChange={e => {
                          const v = e.target.value.trim();
                          if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ caption_color: v.startsWith('#') ? v : '#' + v });
                        }}
                        className="flex-1 max-w-[110px] rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono uppercase text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      <button type="button" onClick={() => update({ caption_color: '#FFFFFF' })}
                        className="text-[10px] text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper">reset</button>
                    </div>
                  </div>

                  {/* Keyword */}
                  <div className="bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-semibold text-ink-950 dark:text-paper">Palabras destacadas · énfasis</h5>
                      <span className="inline-flex items-center justify-center min-w-[48px] h-8 rounded-lg bg-ink-950 px-2 shrink-0" title="Vista previa con la fuente, color y fondo actuales"
                        style={draft.keyword_bg_color ? { backgroundColor: draft.keyword_bg_color } : undefined}>
                        <span style={{
                          ...fontStyleFor('keyword', draft.font_keyword),
                          color: draft.keyword_color,
                          fontStyle: draft.keyword_italic ? 'italic' : (fontStyleFor('keyword', draft.font_keyword).fontStyle || 'normal'),
                          textDecoration: draft.keyword_underline ? 'underline' : 'none',
                        }} className="text-lg leading-none">Aa</span>
                      </span>
                    </div>
                    <select value={draft.font_keyword} onChange={e => update({ font_keyword: e.target.value })}
                      style={{ ...fontStyleFor('keyword', draft.font_keyword), fontSize: '15px' }}
                      className="input">
                      {fontOptions('keyword')}
                    </select>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => update({ keyword_italic: draft.keyword_italic ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm italic rounded ${draft.keyword_italic ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>I</button>
                      <button type="button" onClick={() => update({ keyword_underline: draft.keyword_underline ? 0 : 1 })}
                        className={`px-2.5 py-1 text-sm underline rounded ${draft.keyword_underline ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright ring-1 ring-accent dark:ring-accent-bright' : 'bg-white dark:bg-ink-900 text-ink-500 dark:text-ink-400 border border-ink-200 dark:border-ink-700'}`}>U</button>
                    </div>

                    <div>
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 mb-1.5 block">Color del texto</label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {KEYWORD_COLORS.map(c => (
                          <button key={c.hex} title={c.name} type="button" onClick={() => update({ keyword_color: c.hex })}
                            className={`w-8 h-8 rounded transition border border-black/10 dark:border-white/20 ${draft.keyword_color.toLowerCase() === c.hex.toLowerCase() ? 'ring-2 ring-offset-2 ring-accent dark:ring-accent-bright ring-offset-ink-100 dark:ring-offset-ink-900' : ''}`}
                            style={{ background: c.hex }} />
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={draft.keyword_color}
                          onChange={e => update({ keyword_color: e.target.value })}
                          className="w-10 h-8 border border-ink-200 dark:border-ink-700 rounded-lg cursor-pointer" />
                        <input type="text" value={draft.keyword_color}
                          onChange={e => {
                            const v = e.target.value.trim();
                            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
                              update({ keyword_color: v.startsWith('#') ? v : '#' + v });
                            }
                          }}
                          placeholder="#FDE047"
                          className="flex-1 max-w-[120px] rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono uppercase text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-ink-200 dark:border-ink-700">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] text-ink-500 dark:text-ink-400 font-medium">Color de fondo de palabra</label>
                        <input type="checkbox"
                          checked={!!draft.keyword_bg_color}
                          onChange={e => update({ keyword_bg_color: e.target.checked ? '#000000' : '' })}
                          className="accent-accent dark:accent-accent-bright w-4 h-4" />
                      </div>
                      {draft.keyword_bg_color && (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <input type="color" value={draft.keyword_bg_color}
                              onChange={e => update({ keyword_bg_color: e.target.value })}
                              className="w-10 h-8 border border-ink-200 dark:border-ink-700 rounded-lg cursor-pointer" />
                            <input type="text" value={draft.keyword_bg_color}
                              onChange={e => {
                                const v = e.target.value.trim();
                                if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) {
                                  update({ keyword_bg_color: v.startsWith('#') ? v : '#' + v });
                                }
                              }}
                              placeholder="#000000"
                              className="flex-1 max-w-[120px] rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono uppercase text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                            <span className="text-[10px] text-ink-500 dark:text-ink-400 font-mono tabular-nums">{draft.keyword_bg_opacity}%</span>
                          </div>
                          <input type="range" min="0" max="100"
                            value={draft.keyword_bg_opacity}
                            onChange={e => update({ keyword_bg_opacity: +e.target.value })}
                            className="w-full accent-accent dark:accent-accent-bright" />
                          <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-1">El fondo se quema en el video como un resaltado detrás de cada palabra destacada.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <Tooltip text="El borde ayuda a que el texto se lea sobre cualquier fondo. La sombra suaviza la lectura. Si el texto es oscuro, cambia el color del borde a claro o desactívalo.">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">Borde y sombra del texto</h4>
                </Tooltip>
                <div className="space-y-3 bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-ink-950 dark:text-paper">Borde alrededor del texto</span>
                    <input type="checkbox" checked={!!draft.outline_enabled}
                      onChange={e => update({ outline_enabled: e.target.checked ? 1 : 0 })}
                      className="accent-accent dark:accent-accent-bright w-4 h-4" />
                  </label>
                  {draft.outline_enabled ? (
                    <>
                      <div>
                        <label className="text-[11px] text-ink-500 dark:text-ink-400 mb-1 block">Grosor del borde · <span className="font-mono tabular-nums">{draft.outline_thickness}</span></label>
                        <input type="range" min="1" max="10" value={draft.outline_thickness}
                          onChange={e => update({ outline_thickness: +e.target.value })}
                          className="w-full accent-accent dark:accent-accent-bright" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-ink-500 dark:text-ink-400 shrink-0">Color del borde</label>
                        <input type="color" value={draft.outline_color}
                          onChange={e => update({ outline_color: e.target.value })}
                          className="w-9 h-7 border border-ink-200 dark:border-ink-700 rounded-lg cursor-pointer" />
                        <input type="text" value={draft.outline_color}
                          onChange={e => {
                            const v = e.target.value.trim();
                            if (/^#?[0-9A-Fa-f]{0,6}$/.test(v)) update({ outline_color: v.startsWith('#') ? v : '#' + v });
                          }}
                          className="flex-1 max-w-[110px] rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 px-2 py-1 text-xs font-mono uppercase text-ink-950 dark:text-paper focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent" />
                        <button type="button" onClick={() => update({ outline_color: '#000000' })}
                          className="text-[10px] text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper">reset</button>
                      </div>
                      <p className="text-[10px] text-ink-500 dark:text-ink-400 -mt-1">
                        Tip: si el texto es oscuro, usa borde claro (o desactívalo). Si es claro, borde negro.
                      </p>
                    </>
                  ) : null}
                  <div>
                    <label className="text-[11px] text-ink-500 dark:text-ink-400 mb-1 block">Opacidad de la sombra · <span className="font-mono tabular-nums">{draft.shadow_opacity}%</span></label>
                    <input type="range" min="0" max="100" value={draft.shadow_opacity}
                      onChange={e => update({ shadow_opacity: +e.target.value })}
                      className="w-full accent-accent dark:accent-accent-bright" />
                    <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-1">0% = sin sombra · 100% = sombra negra fuerte</p>
                  </div>
                </div>

                <Tooltip text="Las palabras se iluminan al pronunciarse. Las que aún no se dijeron se ven atenuadas. Solo se ve en el MP4 exportado, no en la vista previa.">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3 mt-4">Efecto karaoke</h4>
                </Tooltip>
                <div className="space-y-2 bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl p-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm text-ink-950 dark:text-paper">Cada palabra se ilumina cuando se dice</span>
                    <input type="checkbox" checked={!!draft.karaoke_enabled}
                      onChange={e => update({ karaoke_enabled: e.target.checked ? 1 : 0 })}
                      className="accent-accent dark:accent-accent-bright w-4 h-4" />
                  </label>
                  {draft.karaoke_enabled ? (
                    <div>
                      <label className="text-[11px] text-ink-500 dark:text-ink-400 mb-1 block">
                        Atenuación de palabras no dichas · <span className="font-mono tabular-nums">{draft.karaoke_dim_opacity}%</span>
                      </label>
                      <input type="range" min="20" max="80" value={draft.karaoke_dim_opacity}
                        onChange={e => update({ karaoke_dim_opacity: +e.target.value })}
                        className="w-full accent-accent dark:accent-accent-bright" />
                      <p className="text-[10px] text-ink-500 dark:text-ink-400 mt-1">
                        Más bajo = más atenuado. El efecto solo se ve en el MP4 exportado.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
              </CollapsibleSection>

              {/* 6 · Añadir movimiento y transiciones */}
              <CollapsibleSection id="movimiento" icon="🎞️" title="Añadir movimiento y transiciones" {...sectionProps('movimiento')}>
              <section>
                <Tooltip text="Movimiento lento que abarca todo el clip (acercamiento cinematográfico, alejamiento o sin movimiento). Distinto a las transiciones, que son golpes rápidos en los bordes.">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">Movimiento de cámara</h4>
                </Tooltip>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'zoom-in', emoji: '🔍', label: 'Acercar' },
                    { id: 'zoom-out', emoji: '🔎', label: 'Alejar' },
                    { id: 'static', emoji: '⏸', label: 'Sin movimiento' },
                  ].map(o => (
                    <button key={o.id} type="button" onClick={() => update({ camera_motion: o.id })}
                      className={`border rounded-lg p-3 text-center transition ${draft.camera_motion === o.id
                        ? 'border-accent bg-accent-soft dark:border-accent-bright dark:bg-accent-deep'
                        : 'border-ink-200 dark:border-ink-700 hover:border-ink-400 dark:hover:border-ink-500'}`}>
                      <div className="text-2xl mb-1">{o.emoji}</div>
                      <div className="text-xs font-medium text-ink-950 dark:text-paper">{o.label}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="text-[11px] text-ink-500 dark:text-ink-400 mb-1.5 block">Posición del subtítulo</label>
                  <input type="range" min="40" max="90" value={draft.sub_position}
                    onChange={e => update({ sub_position: +e.target.value })}
                    className="w-full accent-accent dark:accent-accent-bright" />
                  <div className="flex justify-between text-[10px] text-ink-500 dark:text-ink-400">
                    <span>abajo</span><span className="text-warn dark:text-warn-bright">zona segura de Instagram</span><span>arriba</span>
                  </div>
                </div>
              </section>

              <section>
                <Tooltip text="Efecto en los primeros y últimos segundos del clip. Funciona junto al movimiento de cámara: el movimiento es lento y abarca todo el clip; la transición es un golpe rápido en los bordes.">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-500 dark:text-ink-400 mb-3">Cómo entra y sale el clip</h4>
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
                        ? 'border-accent bg-accent-soft dark:border-accent-bright dark:bg-accent-deep'
                        : 'border-ink-200 dark:border-ink-700 hover:border-ink-400 dark:hover:border-ink-500'}`}>
                      <div className="text-xl mb-0.5">{o.emoji}</div>
                      <div className="text-[10px] font-medium text-ink-950 dark:text-paper leading-tight">{o.label}</div>
                    </button>
                  ))}
                </div>
              </section>
              </CollapsibleSection>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-ink-200 dark:border-ink-700 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-ink-500 dark:text-ink-400">
            {saving
              ? 'Guardando…'
              : isLegacy
                ? 'Clip legacy · descarga re-renderiza el MP4 completo.'
                : 'Edición en vivo · al exportar se quema el MP4 final con tus cambios (rápido, sobre el video base).'}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleClose} className="btn btn-ghost">
              Cerrar
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="btn btn-accent">
              {exporting ? 'Exportando…' : isLegacy ? 'Descargar MP4 →' : 'Exportar MP4 con subtítulos →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClipEditor;
