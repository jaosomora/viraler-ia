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
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
        <div className="animate-pulse">Cargando transcripción…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded-xl p-6 text-sm">
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
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">2</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-white">Selecciona tus fragmentos</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Click en palabra de inicio · click en palabra de fin · se agrega como rango.
            {transcript?.title && <span className="ml-2 text-gray-400">· {transcript.title}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCopyTranscript}
          title="Copia toda la transcripción con timestamps. Útil para llevártela a un LLM y pedir sugerencias antes de marcar."
          className="shrink-0 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium flex items-center gap-1.5">
          {copiedFeedback ? <>✓ Copiado</> : <>📋 Copiar transcripción</>}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-0">
        {/* LEFT: video sticky + transcript */}
        <div
          ref={transcriptScrollRef}
          onScroll={handleTranscriptScroll}
          className="p-5 max-h-[80vh] overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          {sourceVideoUrl && (
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-4 px-5 pt-5 pb-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <video
                ref={videoRef}
                src={sourceVideoUrl}
                controls
                preload="metadata"
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                className="w-full max-h-[300px] rounded-lg bg-black"
              >
                Tu navegador no soporta el tag video.
              </video>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-1 min-w-0">
                  {autoFollow ? (
                    <>
                      <span className="text-purple-600 dark:text-purple-400">●</span>
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
                    className="shrink-0 text-[11px] px-2 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700/50 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded">
                    ↩ Volver al momento del video
                  </button>
                )}
              </div>
            </div>
          )}
          {pendingStartWord && (
            <div className="mb-3 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
              <span>▶ Inicio marcado en <b>{formatTime(pendingStartWord.time)}</b>. Click en la palabra de fin para cerrar.</span>
              <button onClick={handleCancelPending} className="text-amber-700 dark:text-amber-300 hover:underline">Cancelar</button>
            </div>
          )}
          <div className="font-serif leading-relaxed text-gray-800 dark:text-gray-100" style={{ fontFamily: 'Georgia, serif' }}>
            {segmentGroups.map((g) => (
              <p key={g.segIdx} className="mb-3">
                <span className="text-[10px] text-gray-400 mr-1.5 select-none font-sans">{formatTime(g.start)}</span>
                {g.tokens.map((t, i) => {
                  const inSaved = wordInSavedRange.has(t.idx);
                  const isPending = pendingStartWord?.idx === t.idx;
                  const inPending = !inSaved && pendingStartWord && wordInPendingRange.has(t.idx);
                  // Palabra siendo "dicha" ahora en el video (highlight activo)
                  const isActive = currentTime >= t.start && currentTime < t.end;
                  let cls = 'cursor-pointer rounded px-[1px] transition-colors hover:bg-gray-100 dark:hover:bg-gray-700';
                  if (isPending) cls += ' bg-amber-500 text-white px-1';
                  else if (isActive && !inSaved) cls += ' bg-purple-200 dark:bg-purple-700/50 text-purple-900 dark:text-purple-100';
                  else if (inSaved) cls += ' bg-amber-200/40 dark:bg-amber-700/30 border-b border-amber-500 dark:border-amber-400';
                  else if (inPending) cls += ' bg-amber-200/50 dark:bg-amber-700/40';
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
        <div className="p-5 bg-gray-50 dark:bg-gray-900/30">
          <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-3">
            Tus fragmentos <span className="text-gray-400">({ranges.length})</span>
          </h4>

          {ranges.length === 0 && !pendingStartWord && (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic py-4 text-center border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
              Click en cualquier palabra del transcript para marcar el inicio.
            </div>
          )}

          {ranges.map((r, i) => {
            const dur = r.end_seconds - r.start_seconds;
            const tooShort = dur < MIN_IDEAL;
            const tooLong = dur > MAX_IDEAL;
            const warn = tooShort || tooLong;
            return (
              <div key={i} className={`mb-2 p-3 rounded-lg border ${warn ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                <div className="flex justify-between items-baseline mb-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{formatTime(r.start_seconds)} → {formatTime(r.end_seconds)}</div>
                  <div className={`text-[11px] ${warn ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-gray-500'}`}>
                    {Math.round(dur)}s {warn && '⚠'}
                  </div>
                </div>
                <div className="text-xs italic text-gray-600 dark:text-gray-300 leading-snug" style={{ fontFamily: 'Georgia, serif' }}>
                  "{r.preview}…"
                </div>
                {warn && (
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1.5">
                    {tooShort ? 'Muy corto' : 'Muy largo'} · suele rendir mejor entre {MIN_IDEAL}-{MAX_IDEAL}s. Puedes generarlo igual.
                  </div>
                )}
                <button onClick={() => handleRemoveRange(i)}
                  className="text-[11px] text-gray-500 hover:text-red-600 mt-2">
                  🗑 Eliminar
                </button>
              </div>
            );
          })}

          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-[11px] text-gray-500 mb-2">
              Hook + hashtags por IA: <b>{hookAutoOn ? 'activado' : 'desactivado'}</b>
            </div>
            {submitError && (
              <div className="mb-2 px-2 py-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 rounded text-[11px]">
                {submitError}
              </div>
            )}
            <button onClick={handleSubmit}
              disabled={submitting || ranges.length === 0}
              className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-semibold text-white text-sm">
              {submitting ? 'Enviando…' : `✨ Generar ${ranges.length} clip${ranges.length === 1 ? '' : 's'}`}
            </button>
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center mt-1.5">
              {ranges.length > 0 && <>~{Math.round(totalDuration)}s totales · estimado ${estimatedCost.toFixed(3)}</>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualClipSelection;
