import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useClips } from '../context/ClipsContext';

// Componente de selección manual de rangos para un job en status='awaiting_selection'.
// Muestra el transcript (segmentos con palabras-clickables, agrupados por segmento Whisper),
// permite marcar rangos con click-click (1er click=inicio, 2do click=fin, auto-agrega),
// muestra panel lateral con rangos guardados y CTA "Generar N clips".
//
// Conventions:
// - Rangos en segundos absolutos del video, alineados a fronteras de palabra del transcript.
// - Warning soft si un rango cae fuera de [30s, 90s] (rango ideal); el backend solo rechaza
//   rangos menores a 10s (clicks accidentales). Sin máximo: el usuario decide la duración.
// - Click-click: el 1er click setea startWordIdx. El 2do click marca endWordIdx en la palabra
//   clickeada (orden auto-resuelto). Se push al array de ranges y se resetea estado pendiente.

const MIN_IDEAL = 30;
const MAX_IDEAL = 90;
const MIN_HARD = 10;

const formatTime = (s) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

const ManualClipSelection = ({ job }) => {
  const { fetchTranscript, submitRanges } = useClips();
  const [transcript, setTranscript] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [pendingStartWord, setPendingStartWord] = useState(null); // { idx, time }
  const [ranges, setRanges] = useState([]); // [{start_seconds, end_seconds, previewText}]
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [autoFollow, setAutoFollow] = useState(true);
  const [copiedFeedback, setCopiedFeedback] = useState(false);
  const videoRef = useRef(null);
  const transcriptScrollRef = useRef(null);
  const isProgrammaticScroll = useRef(false);
  const lastFollowedWordIdx = useRef(-1);

  // Copia toda la transcripción al portapapeles con timestamps por segmento.
  // Formato: "[mm:ss] texto del segmento" — útil para llevarse a otro chat/LLM
  // y pedir sugerencias de qué clipar; luego se vuelve acá y se marca manualmente.
  const handleCopyTranscript = async () => {
    if (!transcript?.segments) return;
    const text = transcript.segments
      .map(s => `[${formatTime(s.start)}] ${s.text.trim()}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFeedback(true);
      setTimeout(() => setCopiedFeedback(false), 2000);
    } catch (err) {
      // Fallback antiguo (algunos browsers/contexts sin permiso a clipboard API)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); setCopiedFeedback(true); setTimeout(() => setCopiedFeedback(false), 2000); }
      catch {}
      document.body.removeChild(ta);
    }
  };

  // URL del video fuente con token en query (el <video> tag no manda Authorization headers).
  // El endpoint /source-video usa authMiddlewareMedia que acepta ?token=. Mientras tengamos
  // sesión, podemos servir el video con Range requests para seek instantáneo.
  const sourceVideoUrl = useMemo(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) return null;
    return `/api/clips/jobs/${job.id}/source-video?token=${encodeURIComponent(token)}`;
  }, [job.id]);

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      // Si el usuario está marcando rangos, mostramos el contexto reproduciendo,
      // pero no auto-play para no asustarlo en mobile o si hay autoplay block.
    }
  };

  // Si el usuario scrollea manualmente, apaga el auto-follow (no se quiere pelear contigo).
  // El botón "Volver al momento del video" lo reactiva.
  const handleTranscriptScroll = () => {
    if (isProgrammaticScroll.current) return;
    if (autoFollow) setAutoFollow(false);
  };

  // NOTA: scrollToActiveWord, el useEffect de auto-follow y resumeAutoFollow viven más abajo,
  // después de la definición de wordTokens (useMemo) para evitar temporal dead zone.

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTranscript(job.id)
      .then((data) => { if (alive) { setTranscript(data); setLoading(false); } })
      .catch((err) => { if (alive) { setLoadError(err.message); setLoading(false); } });
    return () => { alive = false; };
  }, [job.id, fetchTranscript]);

  // Tokenizar segmentos en palabras con su tiempo aproximado (usando whisper.words si existe,
  // si no usamos el inicio del segmento como tiempo de cada palabra y repartimos uniformemente).
  const wordTokens = useMemo(() => {
    if (!transcript) return [];
    const tokens = [];
    const segments = transcript.segments || [];
    const whisperWords = transcript.words || [];
    let globalIdx = 0;
    let wordCursor = 0;
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      // Palabras dentro de este segmento: las del array global whisperWords cuyo tiempo cae en [seg.start, seg.end]
      const segWords = [];
      while (wordCursor < whisperWords.length) {
        const w = whisperWords[wordCursor];
        const wTime = (typeof w.start === 'number') ? w.start : seg.start;
        if (wTime >= seg.end) break;
        segWords.push({ ...w, segIdx });
        wordCursor += 1;
      }
      // Fallback: si no hay words alineadas, partir el texto del segmento por espacios
      const finalWords = segWords.length > 0
        ? segWords
        : seg.text.trim().split(/\s+/).map((w, i, arr) => ({
            word: w,
            start: seg.start + (i / arr.length) * (seg.end - seg.start),
            end: seg.start + ((i + 1) / arr.length) * (seg.end - seg.start),
            segIdx,
          }));
      for (const w of finalWords) {
        tokens.push({
          idx: globalIdx,
          text: w.word || w.text || '',
          start: typeof w.start === 'number' ? w.start : seg.start,
          end: typeof w.end === 'number' ? w.end : seg.end,
          segIdx,
        });
        globalIdx += 1;
      }
    }
    return tokens;
  }, [transcript]);

  // Scrollea el transcript a la palabra que se está diciendo ahora en el video.
  // Marca el scroll como "programático" para que el listener no apague el auto-follow.
  const scrollToActiveWord = (smooth = true) => {
    const t = currentTime;
    const active = wordTokens.find(w => t >= w.start && t < w.end) || wordTokens.find(w => w.start >= t);
    if (!active) return;
    const el = transcriptScrollRef.current?.querySelector(`[data-word-idx="${active.idx}"]`);
    if (el) {
      isProgrammaticScroll.current = true;
      el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'center' });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 800);
    }
  };

  // Auto-follow: cuando avanza la palabra activa, scrollear suave para mantenerla centrada.
  // Usamos 'center' (no 'nearest') para que el follow sea continuo y la palabra activa quede
  // siempre cerca del centro del viewport, no pegada al borde inferior. Throttle por palabra.
  useEffect(() => {
    if (!autoFollow) return;
    const t = currentTime;
    const active = wordTokens.find(w => t >= w.start && t < w.end);
    if (!active) return;
    if (active.idx === lastFollowedWordIdx.current) return;
    lastFollowedWordIdx.current = active.idx;
    const el = transcriptScrollRef.current?.querySelector(`[data-word-idx="${active.idx}"]`);
    if (el) {
      isProgrammaticScroll.current = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { isProgrammaticScroll.current = false; }, 800);
    }
  }, [currentTime, autoFollow, wordTokens]);

  const resumeAutoFollow = () => {
    setAutoFollow(true);
    lastFollowedWordIdx.current = -1;
    scrollToActiveWord(true);
  };

  // Mapa idx → en qué rango guardado cae (para subrayar). Solo el primero que lo contiene.
  const wordInSavedRange = useMemo(() => {
    const map = new Map();
    for (let r = 0; r < ranges.length; r++) {
      const range = ranges[r];
      for (const t of wordTokens) {
        if (t.start >= range.start_seconds && t.end <= range.end_seconds) {
          if (!map.has(t.idx)) map.set(t.idx, r);
        }
      }
    }
    return map;
  }, [ranges, wordTokens]);

  const wordInPendingRange = useMemo(() => {
    if (!pendingStartWord) return new Set();
    const set = new Set();
    const startTime = pendingStartWord.time;
    for (const t of wordTokens) {
      if (t.start >= startTime) set.add(t.idx);
    }
    return set;
  }, [pendingStartWord, wordTokens]);

  const handleWordClick = (token) => {
    // Click siempre seekea el video al momento de esa palabra — así el usuario
    // escucha exactamente cómo se dijo antes de decidir.
    seekTo(token.start);
    if (!pendingStartWord) {
      setPendingStartWord({ idx: token.idx, time: token.start });
      return;
    }
    // Segundo click: cerrar rango
    let startSec = pendingStartWord.time;
    let endSec = token.end;
    if (endSec < startSec) { [startSec, endSec] = [endSec, startSec]; }
    // Preview text: palabras entre startSec y endSec
    const preview = wordTokens
      .filter(t => t.start >= startSec && t.end <= endSec)
      .map(t => t.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 140);
    setRanges([...ranges, { start_seconds: startSec, end_seconds: endSec, preview }]);
    setPendingStartWord(null);
  };

  const handleCancelPending = () => setPendingStartWord(null);

  const handleRemoveRange = (idx) => {
    setRanges(ranges.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitRanges(job.id, ranges.map(r => ({ start: r.start_seconds, end: r.end_seconds })));
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="card p-8 text-center text-ink-500 dark:text-ink-400">
        <div className="animate-pulse">Cargando transcripción…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-danger/30 dark:border-danger-bright/30 bg-danger-soft dark:bg-danger-deep text-danger dark:text-danger-bright p-6 text-sm">
        Error cargando transcripción: {loadError}
      </div>
    );
  }

  const totalDuration = ranges.reduce((s, r) => s + (r.end_seconds - r.start_seconds), 0);
  const hookAutoOn = job.hook_auto_enabled !== 0;
  const estimatedCost = hookAutoOn ? (ranges.length * 0.001) : 0;

  // Agrupar tokens por segmento para render
  const segmentGroups = [];
  let currentGroup = null;
  for (const t of wordTokens) {
    if (!currentGroup || currentGroup.segIdx !== t.segIdx) {
      currentGroup = { segIdx: t.segIdx, start: t.start, tokens: [] };
      segmentGroups.push(currentGroup);
    }
    currentGroup.tokens.push(t);
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b hairline flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <span className="eyebrow">Paso 2 · Selección</span>
          <div className="mt-1 font-display font-semibold tracking-tight">Selecciona tus fragmentos</div>
          <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
            Click en palabra de inicio · click en palabra de fin · se agrega como rango.
            {transcript?.title && <span className="ml-2 text-ink-400 dark:text-ink-500">· {transcript.title}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyTranscript}
          title="Copia toda la transcripción con timestamps. Útil para llevártela a un LLM y pedir sugerencias antes de marcar."
          className="btn btn-ghost btn-sm shrink-0">
          {copiedFeedback ? <>✓ Copiado</> : <>📋 Copiar transcripción</>}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-0">
        {/* LEFT: video sticky + transcript */}
        <div
          ref={transcriptScrollRef}
          onScroll={handleTranscriptScroll}
          className="p-5 max-h-[80vh] overflow-y-auto border-r border-ink-200 dark:border-ink-700">
          {sourceVideoUrl && (
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 px-5 pt-5 pb-3 bg-white dark:bg-ink-850 border-b hairline">
              <video
                ref={videoRef}
                src={sourceVideoUrl}
                controls
                preload="metadata"
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                className="w-full max-h-[300px] rounded-xl bg-ink-950"
              >
                Tu navegador no soporta el tag video.
              </video>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] text-ink-500 dark:text-ink-400 flex items-center gap-1.5 flex-1 min-w-0">
                  {autoFollow ? (
                    <>
                      <span className="text-accent dark:text-accent-bright">●</span>
                      <span className="truncate">Auto-sync activo · el texto avanza con el video. Scrollea manual para pausarlo.</span>
                    </>
                  ) : (
                    <>
                      <span>💡</span>
                      <span className="truncate">Click en palabra → video salta. El auto-sync se pausó (scrolleaste manualmente).</span>
                    </>
                  )}
                </div>
                {!autoFollow && (
                  <button
                    type="button"
                    onClick={resumeAutoFollow}
                    className="btn btn-ghost btn-sm shrink-0">
                    ↩ Volver al momento del video
                  </button>
                )}
              </div>
            </div>
          )}
          {pendingStartWord && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-accent-soft dark:bg-accent-deep border border-accent/30 dark:border-accent-bright/30 text-xs text-accent dark:text-accent-bright flex items-center justify-between">
              <span>▶ Inicio marcado en <b className="font-mono tabular-nums">{formatTime(pendingStartWord.time)}</b>. Click en la palabra de fin para cerrar.</span>
              <button onClick={handleCancelPending} className="link-accent font-medium">Cancelar</button>
            </div>
          )}
          <div className="font-serif leading-relaxed text-ink-950 dark:text-ink-100" style={{ fontFamily: 'Georgia, serif' }}>
            {segmentGroups.map((g) => (
              <p key={g.segIdx} className="mb-3">
                <span className="font-mono tabular-nums text-[10px] text-ink-400 dark:text-ink-500 mr-1.5 select-none">{formatTime(g.start)}</span>
                {g.tokens.map((t, i) => {
                  const inSaved = wordInSavedRange.has(t.idx);
                  const isPending = pendingStartWord?.idx === t.idx;
                  const inPending = !inSaved && pendingStartWord && wordInPendingRange.has(t.idx);
                  // Palabra siendo "dicha" ahora en el video (highlight activo)
                  const isActive = currentTime >= t.start && currentTime < t.end;
                  let cls = 'cursor-pointer rounded px-[1px] transition-colors hover:bg-ink-100 dark:hover:bg-ink-800';
                  if (isPending) cls += ' bg-accent text-white dark:bg-accent-bright dark:text-ink-950 px-1';
                  else if (isActive && !inSaved) cls += ' bg-accent-soft text-accent dark:bg-accent-deep dark:text-accent-bright';
                  else if (inSaved) cls += ' bg-accent-soft/60 dark:bg-accent-deep/60 border-b border-accent/60 dark:border-accent-bright/60';
                  else if (inPending) cls += ' bg-accent-soft/50 dark:bg-accent-deep/50';
                  return (
                    <span key={i}>
                      <span className={cls} data-word-idx={t.idx} onClick={() => handleWordClick(t)}>{t.text}</span>
                      {' '}
                    </span>
                  );
                })}
              </p>
            ))}
          </div>
        </div>

        {/* RIGHT: ranges panel */}
        <div className="p-5 bg-ink-100/60 dark:bg-ink-900/40">
          <h4 className="eyebrow mb-3">
            Tus fragmentos ({ranges.length})
          </h4>

          {ranges.length === 0 && !pendingStartWord && (
            <div className="text-xs text-ink-500 dark:text-ink-400 italic py-4 text-center border border-dashed border-ink-300 dark:border-ink-700 rounded-xl">
              Click en cualquier palabra del transcript para marcar el inicio.
            </div>
          )}

          {ranges.map((r, i) => {
            const dur = r.end_seconds - r.start_seconds;
            const tooShort = dur < MIN_IDEAL;
            const tooLong = dur > MAX_IDEAL;
            const warn = tooShort || tooLong;
            return (
              <div key={i} className={`mb-2 p-3 rounded-xl border ${warn ? 'border-warn/50 dark:border-warn-bright/40 bg-warn-soft/60 dark:bg-warn-deep/40' : 'border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-850'}`}>
                <div className="flex justify-between items-baseline mb-1 gap-2">
                  <div className="timecode font-semibold">{formatTime(r.start_seconds)} → {formatTime(r.end_seconds)}</div>
                  <span className={`chip font-mono tabular-nums ${warn ? 'chip-warn' : 'chip-neutral'}`}>
                    {Math.round(dur)}s
                  </span>
                </div>
                <div className="text-xs italic text-ink-500 dark:text-ink-400 leading-snug" style={{ fontFamily: 'Georgia, serif' }}>
                  "{r.preview}…"
                </div>
                {warn && (
                  <div className="text-[10px] text-warn dark:text-warn-bright mt-1.5">
                    {tooShort ? 'Muy corto' : 'Muy largo'} · suele rendir mejor entre {MIN_IDEAL}-{MAX_IDEAL}s. Puedes generarlo igual.
                  </div>
                )}
                <button onClick={() => handleRemoveRange(i)}
                  className="text-[11px] text-ink-400 dark:text-ink-500 hover:text-danger dark:hover:text-danger-bright transition-colors mt-2">
                  Eliminar
                </button>
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t hairline">
            <div className="text-[11px] text-ink-500 dark:text-ink-400 mb-2">
              Hook + hashtags por IA: <b>{hookAutoOn ? 'activado' : 'desactivado'}</b>
            </div>
            {submitError && (
              <div className="mb-2 px-2 py-1.5 bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright rounded-lg text-[11px]">
                {submitError}
              </div>
            )}
            <button onClick={handleSubmit}
              disabled={submitting || ranges.length === 0}
              className="btn btn-accent w-full">
              {submitting ? 'Enviando…' : `Generar ${ranges.length} clip${ranges.length === 1 ? '' : 's'} →`}
            </button>
            <div className="text-[10px] text-ink-500 dark:text-ink-400 text-center mt-1.5 font-mono tabular-nums">
              {ranges.length > 0 && <>~{Math.round(totalDuration)}s totales</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualClipSelection;
