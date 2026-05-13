import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  uploadReel, listReelJobs, getReelJob, applyCuts, deleteReelJob,
  updateReelStyle, updateReelTitle, renderReelPreview, finalizeReel, reopenSilences,
  continueToMusic, reopenStyle, updateMusic, mixMusic, suggestMusic,
  sourceVideoUrl, baseVideoUrl, outputVideoUrl, outputWithMusicUrl, downloadUrl,
} from '../services/reelsApi';
import { listMusicTracks, uploadMusicTrack, deleteMusicTrack, streamUrl as musicStreamUrl, curateMusic, getMusicProviders } from '../services/musicApi';

const fmtTime = s => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
};

// Parsea "mm:ss", "m:ss", "ss" o número decimal a segundos.
// Devuelve null si no se puede interpretar (campo vacío, garabato, etc.).
const parseTimeInput = str => {
  if (str == null) return null;
  const s = String(str).trim();
  if (!s) return null;
  if (s.includes(':')) {
    const [mm, ss] = s.split(':');
    const m = parseInt(mm, 10);
    const sec = parseFloat(ss);
    if (isNaN(m) || isNaN(sec)) return null;
    return m * 60 + sec;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};

const ReelsCleanerPage = () => {
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(localStorage.getItem('reels_active_job') || null);
  const [activeJob, setActiveJob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);

  const refreshList = async () => {
    try { setJobs(await listReelJobs()); }
    catch (e) { console.error(e); }
  };

  const loadActive = async (id) => {
    if (!id) { setActiveJob(null); return; }
    try { setActiveJob(await getReelJob(id)); }
    catch (e) { setError(e.message); setActiveJob(null); }
  };

  useEffect(() => { refreshList(); }, []);
  useEffect(() => {
    if (!activeJobId) { setActiveJob(null); return; }
    localStorage.setItem('reels_active_job', activeJobId);
    loadActive(activeJobId);
  }, [activeJobId]);

  // Polling cuando hay un job activo no terminal
  useEffect(() => {
    if (!activeJob) return;
    const idleStates = ['done', 'error', 'awaiting_review', 'awaiting_style_review', 'awaiting_music_review'];
    if (idleStates.includes(activeJob.status)) return;
    const t = setInterval(() => loadActive(activeJob.id), 2000);
    return () => clearInterval(t);
  }, [activeJob?.status, activeJob?.id]);

  // Cuando rendering pasa a done, refrescar la lista también
  useEffect(() => {
    if (activeJob?.status === 'done' || activeJob?.status === 'error') refreshList();
  }, [activeJob?.status]);

  const handleUpload = async (file) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const { jobId } = await uploadReel(file, file.name.replace(/\.[^.]+$/, ''), setUploadProgress);
      setActiveJobId(jobId);
      await refreshList();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleNewReel = () => {
    setActiveJobId(null);
    localStorage.removeItem('reels_active_job');
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este reel? Se borrarán video original y final.')) return;
    try {
      await deleteReelJob(id);
      if (activeJobId === id) handleNewReel();
      await refreshList();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">AS Tools</div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">
          Reels Cleaner
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Sube una toma vertical corta. Detectamos los silencios, tú validas qué cortar, y te entregamos el reel limpio con subtítulos.
        </p>
      </div>

      {error && (
        <div className="max-w-4xl mx-auto w-full p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50 rounded-lg text-rose-700 dark:text-rose-300 text-sm">
          {error} <button onClick={() => setError(null)} className="ml-2 underline">cerrar</button>
        </div>
      )}

      <div className="max-w-7xl mx-auto w-full space-y-6">
        {!activeJob && (
          <UploadForm onUpload={handleUpload} uploading={uploading} progress={uploadProgress} />
        )}

        {activeJob && !['awaiting_review', 'awaiting_style_review', 'awaiting_music_review', 'done', 'error'].includes(activeJob.status) && (
          <ProgressView job={activeJob} onBack={handleNewReel} />
        )}

        {activeJob && activeJob.status === 'error' && (
          <ErrorView job={activeJob} onBack={handleNewReel} onDelete={() => handleDelete(activeJob.id)} />
        )}

        {activeJob && activeJob.status === 'awaiting_review' && (
          <ReviewView
            job={activeJob}
            onSubmitted={() => loadActive(activeJob.id)}
            onError={setError}
          />
        )}

        {activeJob && activeJob.status === 'awaiting_style_review' && (
          <StyleReviewView
            job={activeJob}
            onChange={() => loadActive(activeJob.id)}
            onError={setError}
          />
        )}

        {activeJob && activeJob.status === 'awaiting_music_review' && (
          <MusicReviewView
            job={activeJob}
            onChange={() => loadActive(activeJob.id)}
            onError={setError}
          />
        )}

        {activeJob && activeJob.status === 'done' && (
          <DoneView job={activeJob} onBack={handleNewReel} onReopen={() => loadActive(activeJob.id)} onError={setError} />
        )}

        {jobs.length > 0 && (
          <JobsList
            jobs={jobs}
            activeId={activeJobId}
            onSelect={setActiveJobId}
            onDelete={handleDelete}
            onTitleChanged={refreshList}
          />
        )}
      </div>
    </div>
  );
};

// -------------------- Subcomponentes --------------------

const UploadForm = ({ onUpload, uploading, progress }) => {
  const inputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onUpload(f);
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
          dragOver ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-amber-400'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-m4v,.mp4,.mov,.mkv,.webm,.m4v"
          className="hidden"
          onChange={e => onUpload(e.target.files?.[0])}
        />
        {uploading ? (
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">Subiendo… {progress}%</div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden max-w-md mx-auto">
              <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">🎬</div>
            <div className="font-medium text-gray-900 dark:text-white mb-1">Arrastra tu toma o haz click</div>
            <p className="text-sm text-gray-500">MP4, MOV, MKV, WEBM, M4V · máximo 10 minutos · 500 MB</p>
          </>
        )}
      </div>
    </div>
  );
};

const ProgressView = ({ job, onBack }) => {
  const stages = job.stages || [];
  const currentStage = stages[job.stage_index] || stages[0] || { msg: 'Procesando…', percent: 50, emoji: '⏳' };
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
      <div className="text-5xl mb-4">{currentStage.emoji}</div>
      <h3 className="font-medium text-lg text-gray-900 dark:text-white mb-1">{currentStage.msg}</h3>
      <p className="text-sm text-gray-500 mb-4">{job.title || 'Tu toma'}</p>
      <div className="max-w-md mx-auto h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all" style={{ width: `${currentStage.percent}%` }} />
      </div>
      <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700 underline">
        ← Subir otra toma
      </button>
    </div>
  );
};

const ErrorView = ({ job, onBack, onDelete }) => (
  <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/50 rounded-xl p-6">
    <div className="font-medium text-rose-900 dark:text-rose-200 mb-1">No pudimos procesar este video</div>
    <p className="text-sm text-rose-700 dark:text-rose-300 mb-3">{job.error_message || 'Error desconocido'}</p>
    <div className="flex gap-2">
      <button onClick={onBack} className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50">
        Subir otra toma
      </button>
      <button onClick={onDelete} className="px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 rounded">
        Eliminar este job
      </button>
    </div>
  </div>
);

const DEFAULT_THRESHOLD = 0.5;

const ReviewView = ({ job, onSubmitted, onError }) => {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  // userOverrides: idx → 'cut' | 'keep' (override manual del usuario para ese gap)
  const [overrides, setOverrides] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [playWithCuts, setPlayWithCuts] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  // Trim cabeza/cola: segundos a descartar al inicio y al final del video original.
  // Se modela como dos cortes adicionales que pasan por el mismo pipeline (padding,
  // snap, render). El input es texto para permitir typing libre tipo "0:07".
  const [trimHeadStr, setTrimHeadStr] = useState('');
  const [trimTailStr, setTrimTailStr] = useState('');
  const videoRef = useRef();
  const transcriptContainerRef = useRef();
  const activeWordRef = useRef();
  const programmaticScrollRef = useRef(false);

  const words = job.words || [];
  const gaps = job.gaps || [];
  const totalDur = job.duration_seconds || 0;

  // Estado efectivo de cada gap considerando umbral + overrides
  const gapsWithState = useMemo(() => gaps.map(g => {
    const ov = overrides[g.idx];
    const action = ov || (g.duration >= threshold ? 'cut' : 'keep');
    return { ...g, action };
  }), [gaps, threshold, overrides]);

  // Cortes derivados de los inputs de trim. Clampeados a [0, totalDur] y descartados si
  // son cero o negativos. Si el usuario escribe basura → el parser devuelve null y no
  // generamos cut (sin error visible, simplemente no aplica).
  const trimCuts = useMemo(() => {
    const out = [];
    const head = parseTimeInput(trimHeadStr);
    const tail = parseTimeInput(trimTailStr);
    if (head != null && head > 0.05) {
      out.push({ start: 0, end: Math.min(head, totalDur) });
    }
    if (tail != null && tail > 0.05 && totalDur > 0) {
      out.push({ start: Math.max(0, totalDur - tail), end: totalDur });
    }
    return out;
  }, [trimHeadStr, trimTailStr, totalDur]);

  const cuts = useMemo(() => {
    const fromGaps = gapsWithState
      .filter(g => g.action === 'cut')
      .map(g => ({ start: g.start, end: g.end }));
    return [...fromGaps, ...trimCuts];
  }, [gapsWithState, trimCuts]);

  const removedSeconds = cuts.reduce((a, c) => a + (c.end - c.start), 0);
  const finalDuration = Math.max(0, totalDur - removedSeconds);

  const cutCount = gapsWithState.filter(g => g.action === 'cut').length;
  const keepCount = gapsWithState.filter(g => g.action === 'keep').length;

  const toggleGap = idx => {
    setOverrides(prev => {
      const current = gapsWithState.find(g => g.idx === idx);
      const next = current.action === 'cut' ? 'keep' : 'cut';
      return { ...prev, [idx]: next };
    });
  };

  const seek = t => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, t);
      videoRef.current.play().catch(() => {});
    }
  };

  // Modo "reproducir como queda final": monitorea currentTime con rAF y salta cualquier
  // rango de corte instantáneamente. Latencia ~16ms (un frame). Patrón usado por editores
  // como Descript para previews live.
  useEffect(() => {
    if (!playWithCuts) return;
    const v = videoRef.current;
    if (!v) return;
    // Ordenamos cuts una vez al montar el efecto.
    const sortedCuts = [...cuts].sort((a, b) => a.start - b.start);
    let raf;
    const tick = () => {
      if (!v.paused && !v.seeking) {
        const t = v.currentTime;
        // Si estamos dentro de un corte, saltar al final inmediatamente.
        const inside = sortedCuts.find(c => t >= c.start - 0.01 && t < c.end - 0.05);
        if (inside) v.currentTime = inside.end;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playWithCuts, cuts]);

  // Al activar el toggle, arrancar reproducción automática para que el usuario oiga el resultado.
  useEffect(() => {
    if (!playWithCuts) return;
    const v = videoRef.current;
    if (v && v.paused) v.play().catch(() => {});
  }, [playWithCuts]);

  // Trackear currentTime del video para resaltar la palabra activa en el transcript.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setVideoTime(v.currentTime);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('seeked', onTime);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('seeked', onTime);
    };
  }, []);

  // Auto-scroll del transcript para mantener la palabra activa visible.
  useEffect(() => {
    if (autoScrollPaused) return;
    const el = activeWordRef.current;
    const container = transcriptContainerRef.current;
    if (!el || !container) return;
    const elBox = el.getBoundingClientRect();
    const containerBox = container.getBoundingClientRect();
    // Solo scrollear si la palabra activa NO está dentro de la zona segura central
    // del contenedor (10%-80% del alto). Evita movimiento constante en cada palabra.
    const elTopRel = elBox.top - containerBox.top;
    const containerH = container.clientHeight;
    const inSafeZone = elTopRel > containerH * 0.1 && elTopRel < containerH * 0.8;
    if (inSafeZone) return;
    const elTopInContainer = elTopRel + container.scrollTop;
    const desiredTop = elTopInContainer - containerH * 0.4;
    programmaticScrollRef.current = true;
    container.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });
    setTimeout(() => { programmaticScrollRef.current = false; }, 800);
  }, [videoTime, autoScrollPaused]);

  // Detectar scroll manual del usuario para pausar auto-scroll por 3s.
  useEffect(() => {
    const container = transcriptContainerRef.current;
    if (!container) return;
    let timer;
    let lastTop = container.scrollTop;
    const onScroll = () => {
      const delta = Math.abs(container.scrollTop - lastTop);
      lastTop = container.scrollTop;
      if (programmaticScrollRef.current) return;
      if (delta > 5) {
        setAutoScrollPaused(true);
        clearTimeout(timer);
        timer = setTimeout(() => setAutoScrollPaused(false), 3000);
      }
    };
    container.addEventListener('scroll', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await applyCuts(job.id, cuts);
      onSubmitted();
    } catch (e) {
      onError(e.message);
      setSubmitting(false);
    }
  };

  // Construir un render intercalado palabra/pausa para el transcript.
  // Usamos gapsWithState (NO gaps) para que cada chip refleje el estado actual de threshold + overrides.
  const transcriptItems = useMemo(() => {
    if (words.length === 0) return [];
    const items = [];
    // Solo renderizamos chips para gaps INTERNOS. Leading/trailing se gestionan
    // desde el panel "Recortar inicio y final" — siguen contando como cortes en
    // gapsWithState/cuts (no se pierde nada), solo no aparecen como chip inline.
    const gapsSorted = [...gapsWithState]
      .filter(g => g.position === 'internal')
      .sort((a, b) => a.start - b.start);
    let gi = 0;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      items.push({ type: 'word', word: w, key: `w${i}` });
      while (gi < gapsSorted.length && gapsSorted[gi].start < w.end + 0.05) {
        items.push({ type: 'gap', gap: gapsSorted[gi], key: `g${gapsSorted[gi].idx}` });
        gi++;
      }
    }
    while (gi < gapsSorted.length) {
      items.push({ type: 'gap', gap: gapsSorted[gi], key: `g${gapsSorted[gi].idx}` });
      gi++;
    }
    return items;
  }, [words, gapsWithState]);

  return (
    <div>
      {/* Barra superior */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-4">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Duración</div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-mono text-gray-400 line-through">{fmtTime(totalDur)}</span>
            <span className="text-gray-400">→</span>
            <span className="text-3xl font-mono font-semibold text-gray-900 dark:text-white">{fmtTime(finalDuration)}</span>
            {removedSeconds > 0 && (
              <span className="text-sm text-rose-600 font-medium">−{Math.round(removedSeconds)}s</span>
            )}
          </div>
        </div>

        <div className="md:col-span-5">
          <div className="flex items-baseline justify-between mb-1 gap-2">
            <label className="text-xs text-gray-600 dark:text-gray-300">
              Voy a cortar cualquier silencio mayor a{' '}
              <span className="font-mono font-semibold text-gray-900 dark:text-white text-sm">{threshold.toFixed(1)}s</span>
            </label>
          </div>
          <input
            type="range" min="0.2" max="2.0" step="0.1"
            value={threshold}
            onChange={e => { setThreshold(parseFloat(e.target.value)); setOverrides({}); }}
            className="w-full accent-gray-900 dark:accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
            <span>← corto más (incluso pausas cortas)</span>
            <span>corto menos (solo pausas muy largas) →</span>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Resumen</div>
          <div className="text-sm text-gray-700 dark:text-gray-200 leading-snug">
            Voy a cortar <span className="text-rose-700 dark:text-rose-400 font-semibold">{cutCount} silencio{cutCount === 1 ? '' : 's'}</span>
            {removedSeconds > 0.1 && (
              <> <span className="text-gray-500">({Math.round(removedSeconds)}s menos)</span></>
            )}
            <br />
            y mantener <span className="font-semibold">{keepCount} pausa{keepCount === 1 ? '' : 's'}</span> tal cual.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Video sticky */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-black aspect-[9/16] flex items-center justify-center">
                <video
                  ref={videoRef}
                  src={sourceVideoUrl(job.id)}
                  controls
                  className="max-h-full max-w-full"
                />
              </div>
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {/* Toggle: previsualizar el resultado final saltando los cortes en vivo */}
                <button
                  onClick={() => setPlayWithCuts(v => !v)}
                  className={`w-full mb-3 px-3 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 ${
                    playWithCuts
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                      : 'bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 text-white'
                  }`}
                  title={playWithCuts ? 'Click para volver a reproducción normal (sin saltos)' : 'Reproduce saltando los cortes para escuchar cómo queda el reel final'}
                >
                  {playWithCuts
                    ? <>● Reproduciendo como queda final · click para volver al original</>
                    : <>▶ Escuchar cómo queda con los cortes aplicados</>}
                </button>
                {playWithCuts && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 text-center -mt-1 mb-2">
                    Si una palabra se oye cortada, marca esa pausa como "Mantener" en el transcript.
                  </p>
                )}

                {/* Trim cabeza/cola: dos cortes anclados a los extremos.
                    Funcionan exactamente igual que los chips del transcript pero los marca el usuario manualmente. */}
                <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                    Recortar inicio y final
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Quitar al inicio</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0:00"
                          value={trimHeadStr}
                          onChange={e => setTrimHeadStr(e.target.value)}
                          className="w-full px-2 py-1 text-sm font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setTrimHeadStr(fmtTime(videoRef.current?.currentTime || 0))}
                          className="px-2 py-1 text-[10px] rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 whitespace-nowrap"
                          title="Usar el tiempo actual del player"
                        >
                          Aquí
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Quitar al final</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0:00"
                          value={trimTailStr}
                          onChange={e => setTrimTailStr(e.target.value)}
                          className="w-full px-2 py-1 text-sm font-mono rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const t = videoRef.current?.currentTime;
                            if (t != null && totalDur > 0) setTrimTailStr(fmtTime(Math.max(0, totalDur - t)));
                          }}
                          className="px-2 py-1 text-[10px] rounded bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 whitespace-nowrap"
                          title="Cortar desde el tiempo actual hasta el final"
                        >
                          Aquí
                        </button>
                      </div>
                    </div>
                  </div>
                  {trimCuts.length > 0 && (
                    <div className="mt-2 text-[11px] text-rose-700 dark:text-rose-400">
                      {trimCuts[0]?.start === 0 && (
                        <>Inicio: <span className="font-mono">0:00 → {fmtTime(trimCuts[0].end)}</span></>
                      )}
                      {trimCuts.length === 2 && <span className="mx-1.5 text-gray-400">·</span>}
                      {trimCuts[trimCuts.length - 1]?.end === totalDur && (
                        <>Final: <span className="font-mono">{fmtTime(trimCuts[trimCuts.length - 1].start)} → {fmtTime(totalDur)}</span></>
                      )}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
                    Pulsa "▶ Escuchar cómo queda" para oír el resultado en vivo (sin renderizar).
                  </p>
                </div>

                <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">
                  Timeline (gris = mantener · rosa = cortar)
                </div>
                <TimelineBar totalDur={totalDur} gaps={gapsWithState} onSeek={seek} />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-mono">
                  <span>0:00</span><span>{fmtTime(totalDur)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting || cuts.length === 0 && removedSeconds < 0.1}
              className="w-full mt-4 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition"
            >
              {submitting ? 'Procesando…' : 'Generar reel limpio →'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              Render 9:16 · subs · cortes aplicados
            </p>
          </div>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Transcripción</h2>
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <span className="inline-block px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wide">✂ Cortar</span>
                <span className="text-gray-400">se elimina</span>
                <span className="text-gray-600">·</span>
                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60 text-[10px] font-semibold uppercase tracking-wide">⚠ Revisar</span>
                <span className="text-gray-400">pausa larga NO cortada</span>
                <span className="text-gray-600">·</span>
                <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700 text-[10px]">Mantener</span>
                <span className="text-gray-400">se conserva</span>
              </div>
            </div>

            <div ref={transcriptContainerRef} className="text-gray-800 dark:text-gray-100 leading-loose text-[15px] max-h-[600px] overflow-y-auto pr-2 relative">
              {autoScrollPaused && (
                <button onClick={() => {
                  setAutoScrollPaused(false);
                  activeWordRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }}
                  className="sticky top-0 z-10 w-full mb-2 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium rounded shadow-sm">
                  ↺ Volver al momento del video
                </button>
              )}
              {transcriptItems.map(item => {
                if (item.type === 'word') {
                  const w = item.word;
                  const isActive = videoTime >= w.start - 0.02 && videoTime < w.end + 0.02;
                  return (
                    <span
                      key={item.key}
                      ref={isActive ? activeWordRef : null}
                      onClick={() => seek(w.start)}
                      className={`cursor-pointer rounded px-0.5 transition ${
                        isActive
                          ? 'bg-amber-300 dark:bg-amber-600 text-gray-900 dark:text-white font-medium shadow-sm'
                          : 'hover:bg-amber-100 dark:hover:bg-amber-900/30'
                      }`}
                    >
                      {(w.word || '').trim()}{' '}
                    </span>
                  );
                }
                const isCut = item.gap.action === 'cut';
                const isLong = item.gap.duration >= 1.0;
                if (isCut) {
                  return (
                    <span
                      key={item.key}
                      onClick={() => toggleGap(item.gap.idx)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-1 rounded-full text-[11px] font-semibold cursor-pointer transition select-none uppercase tracking-wide bg-rose-600 text-white shadow-sm hover:bg-rose-700 align-middle"
                      title="Click para mantener este silencio"
                    >
                      ✂ Cortar · {item.gap.duration.toFixed(1)}s
                    </span>
                  );
                }
                if (isLong) {
                  // Pausa larga que se está conservando: amarilla, llama la atención.
                  return (
                    <span
                      key={item.key}
                      onClick={() => toggleGap(item.gap.idx)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-1 rounded-full text-[11px] font-semibold cursor-pointer transition select-none uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60 dark:hover:bg-amber-900/60 align-middle"
                      title="Pausa larga que NO se está cortando · click para cortarla"
                    >
                      ⚠ Revisar · {item.gap.duration.toFixed(1)}s
                    </span>
                  );
                }
                // Pausa corta que se conserva: chip discreto pero etiquetado.
                return (
                  <span
                    key={item.key}
                    onClick={() => toggleGap(item.gap.idx)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded-full text-[10px] cursor-pointer select-none align-middle transition bg-gray-100 text-gray-500 border border-gray-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:bg-gray-700/40 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-rose-900/30 dark:hover:text-rose-300"
                    title="Pausa corta · click para cortarla"
                  >
                    Mantener · {item.gap.duration.toFixed(1)}s
                  </span>
                );
              })}
            </div>
          </div>

          <div className="mt-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 text-sm text-amber-900 dark:text-amber-200">
            <strong className="font-semibold">Tres estados:</strong>
            <span className="inline-block mx-1 px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-semibold uppercase tracking-wide">✂ Cortar</span>
            se elimina del video.
            <span className="inline-block mx-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-semibold uppercase tracking-wide">⚠ Revisar</span>
            pausa larga (≥1s) que NO se está cortando — revisa si realmente la quieres conservar.
            <span className="inline-block mx-1 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 text-[10px]">Mantener</span>
            pausa corta que se conserva tal cual.
            Click sobre cualquier chip para cambiar su estado. Click en una palabra reproduce el video desde ahí.
          </div>
        </div>
      </div>
    </div>
  );
};

const TimelineBar = ({ totalDur, gaps, onSeek }) => {
  if (!totalDur) return null;
  // Construimos segmentos alternados: keep / cut según gaps de tipo 'cut'.
  // Cualquier rango fuera de gaps es "keep".
  const cuts = gaps.filter(g => g.action === 'cut').sort((a, b) => a.start - b.start);
  const segments = [];
  let cursor = 0;
  for (const c of cuts) {
    if (c.start > cursor) segments.push({ type: 'keep', start: cursor, end: c.start });
    segments.push({ type: 'cut', start: c.start, end: c.end });
    cursor = c.end;
  }
  if (cursor < totalDur) segments.push({ type: 'keep', start: cursor, end: totalDur });

  return (
    <div
      className="flex h-3 rounded overflow-hidden gap-px bg-gray-100 dark:bg-gray-900 cursor-pointer"
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pct = (e.clientX - rect.left) / rect.width;
        onSeek(pct * totalDur);
      }}
    >
      {segments.map((s, i) => (
        <div
          key={i}
          className={s.type === 'keep' ? 'bg-gray-500 dark:bg-gray-600' : 'bg-rose-300 dark:bg-rose-700'}
          style={{ width: `${((s.end - s.start) / totalDur) * 100}%` }}
        />
      ))}
    </div>
  );
};

// ==================== STYLE REVIEW VIEW ====================
// Paso 2: el usuario ve el preview con cortes aplicados y subs quemados,
// y puede ajustar fuente/color/posición + editar texto de cada chunk.
// Cualquier cambio marca "preview pendiente" hasta que pulse "Actualizar preview".
const COLOR_PRESETS = [
  { id: '#FFFFFF', name: 'Blanco' },
  { id: '#FDE047', name: 'Amarillo' },
  { id: '#F5D67E', name: 'Dorado' },
  { id: '#FCA5A5', name: 'Rosa' },
  { id: '#A7F3D0', name: 'Menta' },
  { id: '#000000', name: 'Negro' },
];

// Presets del color del borde — los más usados para subtítulos.
const OUTLINE_COLOR_PRESETS = [
  { id: '#000000', name: 'Negro' },
  { id: '#FFFFFF', name: 'Blanco' },
  { id: '#1F2937', name: 'Gris oscuro' },
  { id: '#FDE047', name: 'Amarillo' },
  { id: '#DC2626', name: 'Rojo' },
  { id: '#7C3AED', name: 'Violeta' },
  { id: '#0F766E', name: 'Verde oscuro' },
  { id: '#1E40AF', name: 'Azul' },
];

// Selector de color: presets + native picker para custom.
const ColorPicker = ({ value, onChange, presets }) => {
  const presetIds = new Set(presets.map(p => p.id.toUpperCase()));
  const isCustom = !presetIds.has((value || '').toUpperCase());
  return (
    <div className="flex gap-2 flex-wrap items-center">
      {presets.map(c => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`w-8 h-8 rounded-full border-2 transition ${value?.toUpperCase() === c.id.toUpperCase() ? 'border-amber-500 scale-110 shadow-md' : 'border-gray-300 dark:border-gray-600 hover:scale-105'}`}
          style={{ backgroundColor: c.id }}
          title={c.name}
        />
      ))}
      {/* Selector custom — native input type=color */}
      <label
        className={`relative w-8 h-8 rounded-full border-2 cursor-pointer flex items-center justify-center transition ${isCustom ? 'border-amber-500 scale-110 shadow-md' : 'border-gray-300 dark:border-gray-600 hover:scale-105'}`}
        style={{ background: isCustom
          ? value
          : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
        title="Color personalizado"
      >
        <input
          type="color"
          value={value || '#000000'}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        {!isCustom && <span className="text-white text-[10px] font-bold drop-shadow">+</span>}
      </label>
      {isCustom && (
        <span className="text-[11px] font-mono text-gray-500">{value}</span>
      )}
    </div>
  );
};

const StyleReviewView = ({ job, onChange, onError }) => {
  const [localStyle, setLocalStyle] = useState({
    font_caption: job.font_caption || 'InterSemiBold',
    caption_color: job.caption_color || '#FFFFFF',
    outline_color: job.outline_color || '#000000',
    caption_font_size: job.caption_font_size || 62,
    sub_position: job.sub_position ?? 68, // 68 = zona segura IG/TikTok
    outline_thickness: job.outline_thickness ?? 4, // 0..10
  });
  const [localChunks, setLocalChunks] = useState(job.chunks || []);
  const [dirty, setDirty] = useState(!!job.preview_dirty);
  const [rendering, setRendering] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bust cache del <video>
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [seekRequest, setSeekRequest] = useState({ time: 0, key: 0 });
  const [videoTime, setVideoTime] = useState(0);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const chunksContainerRef = useRef();
  const chunkRefs = useRef({});
  const programmaticScrollRef = useRef(false);

  const seekToChunk = chunk => {
    setSeekRequest({ time: chunk.start, key: Date.now() });
  };

  // Chunk activo: el que se está diciendo AHORA (estricto, puede ser null entre chunks).
  const activeChunk = localChunks.find(c => !c.hidden && videoTime >= c.start && videoTime < c.end);

  // Chunk seguido: lo usamos para el auto-scroll. Si no hay activo (entre chunks), tomamos
  // el más reciente que ya pasó, o el siguiente que viene. Así el highlight nunca se pierde.
  const trackedChunk = useMemo(() => {
    if (activeChunk) return activeChunk;
    if (!localChunks.length) return null;
    // El último que terminó antes de videoTime
    const visible = localChunks.filter(c => !c.hidden);
    if (!visible.length) return null;
    const past = [...visible].reverse().find(c => c.end <= videoTime);
    if (past) return past;
    return visible[0]; // estamos antes de todos los chunks
  }, [activeChunk, localChunks, videoTime]);

  // Auto-scroll del activo: posicionado a ~35% desde arriba del contenedor, así queda
  // claramente visible + suficientes líneas abajo (siguientes subtítulos por venir).
  // Marcamos programmaticScrollRef para que el listener de "user scrolled" no se confunda.
  useEffect(() => {
    if (!trackedChunk || autoScrollPaused) return;
    const el = chunkRefs.current[trackedChunk.idx];
    const container = chunksContainerRef.current;
    if (!el || !container) return;
    // Cálculo robusto: posición del chunk relativa al contenedor, independiente
    // de offsetParent (que puede saltar si hay sticky elements o positioning raro).
    const elBox = el.getBoundingClientRect();
    const containerBox = container.getBoundingClientRect();
    const elTopInContainer = elBox.top - containerBox.top + container.scrollTop;
    // Queremos que el chunk quede al ~50% del alto visible (centrado).
    const desiredTop = elTopInContainer - container.clientHeight * 0.5 + el.clientHeight / 2;
    programmaticScrollRef.current = true;
    container.scrollTo({ top: Math.max(0, desiredTop), behavior: 'smooth' });
    setTimeout(() => { programmaticScrollRef.current = false; }, 800);
  }, [trackedChunk?.idx, autoScrollPaused]);

  // Si el usuario scrollea manualmente, pausamos auto-scroll por 3s.
  useEffect(() => {
    const container = chunksContainerRef.current;
    if (!container) return;
    let timer;
    let lastTop = container.scrollTop;
    const onScroll = () => {
      const delta = Math.abs(container.scrollTop - lastTop);
      lastTop = container.scrollTop;
      // Ignorar scrolls programáticos (mi propio auto-scroll).
      if (programmaticScrollRef.current) return;
      if (delta > 5) {
        setAutoScrollPaused(true);
        clearTimeout(timer);
        timer = setTimeout(() => setAutoScrollPaused(false), 3000);
      }
    };
    container.addEventListener('scroll', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);

  // Sincronizar localChunks si el job cambia desde fuera (después de re-render)
  useEffect(() => {
    if (job.chunks) setLocalChunks(job.chunks);
  }, [job.chunks]);

  const fontOptions = job.font_options || [];

  const markDirty = () => setDirty(true);

  const setStyleField = (k, v) => {
    setLocalStyle(prev => ({ ...prev, [k]: v }));
    markDirty();
  };

  const updateChunkText = (idx, text) => {
    setLocalChunks(prev => prev.map(c => c.idx === idx ? { ...c, text } : c));
    markDirty();
  };

  const toggleChunkHidden = idx => {
    setLocalChunks(prev => prev.map(c => c.idx === idx ? { ...c, hidden: !c.hidden } : c));
    markDirty();
  };

  const resetChunkText = idx => {
    setLocalChunks(prev => prev.map(c => c.idx === idx ? { ...c, text: c.original_text } : c));
    markDirty();
  };

  // Genera overrides a partir de los chunks: solo diferencias del original.
  const computeOverrides = () => localChunks
    .filter(c => c.hidden || (c.text !== c.original_text))
    .map(c => ({ idx: c.idx, text: c.text, hidden: !!c.hidden }));

  const handleRenderPreview = async () => {
    setRendering(true);
    try {
      await updateReelStyle(job.id, {
        ...localStyle,
        caption_overrides: computeOverrides(),
      });
      await renderReelPreview(job.id);
      // Poll hasta que termine. Conservador: cada 1.5s.
      const tick = async () => {
        const fresh = await getReelJob(job.id);
        if (fresh.status === 'awaiting_style_review') {
          setDirty(false);
          setPreviewKey(k => k + 1);
          setRendering(false);
          onChange();
        } else if (fresh.status === 'error') {
          onError(fresh.error_message || 'Error re-renderizando');
          setRendering(false);
        } else {
          setTimeout(tick, 1500);
        }
      };
      setTimeout(tick, 1500);
    } catch (e) {
      onError(e.message);
      setRendering(false);
    }
  };

  const handleContinueToMusic = async () => {
    setFinalizing(true);
    try {
      if (dirty) {
        await updateReelStyle(job.id, {
          ...localStyle,
          caption_overrides: computeOverrides(),
        });
      }
      await continueToMusic(job.id);
      onChange();
    } catch (e) {
      onError(e.message);
      setFinalizing(false);
    }
  };

  const handleReopen = async () => {
    const hasEdits = localChunks.some(c => c.edited || c.hidden);
    const msg = hasEdits
      ? '⚠ Volver al paso de silencios va a re-cortar el video con nuevos boundaries.\n\nLo que SE CONSERVA:\n• Estilo (fuente, tamaño, colores, posición)\n• Música seleccionada\n• Transcripción original\n\nLo que SE PIERDE:\n• Tus correcciones de texto en los subtítulos\n• Líneas ocultas\n\nTip: copia la transcripción primero (botón 📋 arriba) si te interesa conservarla.\n\n¿Continuar?'
      : '¿Volver al paso de silencios? Tu estilo y música se conservan, solo confirmarás los cortes otra vez.';
    if (!confirm(msg)) return;
    try {
      await reopenSilences(job.id);
      onChange();
    } catch (e) { onError(e.message); }
  };

  const [copyOk, setCopyOk] = useState(false);
  const handleCopyTranscript = async () => {
    const fullText = localChunks
      .filter(c => !c.hidden)
      .map(c => c.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    try {
      await navigator.clipboard.writeText(fullText);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch (e) {
      onError('No pude copiar al portapapeles');
    }
  };

  const finalDur = job.output_duration_seconds || 0;

  return (
    <div>
      {/* Header con resumen y CTAs primarios */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Paso 2 de 3 · Revisar estilo</div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Verifica fuente, colores y texto antes de la música
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Reel de {fmtTime(finalDur)} · si un corte se llevó una palabra, vuelve atrás.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleReopen}
            className="px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg border border-amber-300 dark:border-amber-700/50"
          >
            ← Ajustar silencios
          </button>
          <button
            onClick={handleContinueToMusic}
            disabled={finalizing || rendering}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 text-white rounded-lg font-medium"
          >
            {finalizing ? 'Avanzando…' : 'Continuar a música →'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Preview sticky — WYSIWYG: base.mp4 sin subs + overlay HTML que refleja cambios en vivo */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <LiveCaptionPreview
                baseVideoSrc={baseVideoUrl(job.id)}
                chunks={localChunks}
                style={localStyle}
                fontOptions={fontOptions}
                showSafeZones={showSafeZones}
                seekRequest={seekRequest}
                onTimeChange={setVideoTime}
              />
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 flex items-center justify-between gap-3">
                <span className="text-emerald-700 dark:text-emerald-400">
                  ✓ Vista previa en vivo · los cambios se ven al instante
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                  <input type="checkbox" checked={showSafeZones} onChange={e => setShowSafeZones(e.target.checked)}
                    className="accent-rose-600" />
                  <span className="text-[11px]">Zonas IG/TikTok</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de edición */}
        <div className="lg:col-span-7 space-y-5">
          {/* Estilo */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 mb-4">Estilo de subtítulos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fuente</label>
                <select
                  value={localStyle.font_caption}
                  onChange={e => setStyleField('font_caption', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm"
                >
                  {fontOptions.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name}{f.recommended ? ' · recomendada' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Tamaño · {localStyle.caption_font_size}px</label>
                <input
                  type="range" min="40" max="100" step="2"
                  value={localStyle.caption_font_size}
                  onChange={e => setStyleField('caption_font_size', parseInt(e.target.value))}
                  className="w-full accent-gray-900 dark:accent-amber-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Color del texto</label>
                <ColorPicker
                  value={localStyle.caption_color}
                  onChange={v => setStyleField('caption_color', v)}
                  presets={COLOR_PRESETS}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Color del borde</label>
                <ColorPicker
                  value={localStyle.outline_color}
                  onChange={v => setStyleField('outline_color', v)}
                  presets={OUTLINE_COLOR_PRESETS}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Grosor del borde · {localStyle.outline_thickness === 0 ? 'sin borde' : `${localStyle.outline_thickness}px`}
                </label>
                <input
                  type="range" min="0" max="10" step="1"
                  value={localStyle.outline_thickness}
                  onChange={e => setStyleField('outline_thickness', parseInt(e.target.value))}
                  className="w-full accent-gray-900 dark:accent-amber-500"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>0 · sin borde</span>
                  <span>4 · default</span>
                  <span>10 · muy grueso</span>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-2">
                  ¿Dónde aparecen los subtítulos?
                </label>
                <SubPositionPicker
                  value={localStyle.sub_position}
                  onChange={v => setStyleField('sub_position', v)}
                />
              </div>
            </div>
          </div>

          {/* Subtítulos editables */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Subtítulos línea por línea</h3>
              <button
                onClick={handleCopyTranscript}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition ${
                  copyOk
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                }`}
                title="Copia toda la transcripción visible al portapapeles"
              >
                {copyOk ? '✓ Copiado' : '📋 Copiar transcripción'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Edita el texto si Whisper se equivocó. Oculta una línea si no quieres que aparezca. Los tiempos se conservan.
            </p>
            <div ref={chunksContainerRef} className="space-y-2 max-h-[640px] overflow-y-auto pr-2">
              {autoScrollPaused && (
                <button onClick={() => {
                  setAutoScrollPaused(false);
                  if (trackedChunk) {
                    const el = chunkRefs.current[trackedChunk.idx];
                    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                  }
                }}
                  className="sticky top-0 z-10 w-full mb-1 px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-medium rounded shadow-sm">
                  ↺ Volver al momento del video
                </button>
              )}
              {localChunks.map(ch => {
                const isActive = activeChunk?.idx === ch.idx;
                const isTracked = !isActive && trackedChunk?.idx === ch.idx;
                return (
                <div
                  key={ch.idx}
                  ref={el => { chunkRefs.current[ch.idx] = el; }}
                  className={`flex items-start gap-2 p-2 rounded-lg border transition ${
                    ch.hidden
                      ? 'bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700 opacity-50'
                      : isActive
                        ? 'bg-amber-100 dark:bg-amber-900/40 border-amber-500 dark:border-amber-600 shadow-md ring-1 ring-amber-400'
                        : isTracked
                          ? 'bg-amber-50/60 dark:bg-amber-900/15 border-amber-300 dark:border-amber-700/50'
                          : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-600'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => seekToChunk(ch)}
                    title="Saltar a este momento del video"
                    className="text-[10px] font-mono text-gray-400 hover:text-amber-700 dark:hover:text-amber-400 pt-1.5 w-12 shrink-0 text-left cursor-pointer hover:underline"
                  >
                    ▶ {fmtTime(ch.start)}
                  </button>
                  <input
                    type="text"
                    value={ch.text}
                    onChange={e => updateChunkText(ch.idx, e.target.value)}
                    onClick={() => seekToChunk(ch)}
                    disabled={ch.hidden}
                    className={`flex-1 px-2 py-1 text-sm bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-500 rounded ${ch.edited ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-gray-800 dark:text-gray-200'}`}
                  />
                  <div className="flex gap-1 shrink-0">
                    {ch.edited && (
                      <button
                        onClick={() => resetChunkText(ch.idx)}
                        className="text-[10px] px-1.5 py-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        title="Restaurar texto original"
                      >
                        ↺
                      </button>
                    )}
                    <button
                      onClick={() => toggleChunkHidden(ch.idx)}
                      className={`text-[10px] px-1.5 py-1 rounded ${ch.hidden ? 'text-emerald-700 hover:bg-emerald-50' : 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30'}`}
                      title={ch.hidden ? 'Volver a mostrar' : 'Ocultar esta línea'}
                    >
                      {ch.hidden ? '👁 mostrar' : '🚫 ocultar'}
                    </button>
                  </div>
                </div>
                );
              })}
              {localChunks.length === 0 && (
                <p className="text-xs text-gray-500">Sin subtítulos detectados (¿transcript vacío?)</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Live WYSIWYG: base.mp4 sin subs + overlay HTML con el chunk activo según currentTime.
// Es el equivalente al modelo overlay de AS Clips — los cambios de fuente/tamaño/color/posición
// se ven al instante sin re-renderizar ffmpeg.
//
// seekRequest: { time, key } — cuando cambia el `key`, salta el video a `time` (en segundos).
const LiveCaptionPreview = ({ baseVideoSrc, chunks, style, fontOptions, showSafeZones, seekRequest, onTimeChange }) => {
  const videoRef = useRef();
  const containerRef = useRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrentTime(v.currentTime);
      onTimeChange?.(v.currentTime);
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('seeked', onTime);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('seeked', onTime);
    };
  }, [baseVideoSrc, onTimeChange]);

  // Seek externo: cuando seekRequest.key cambia, salta a time + reproduce.
  useEffect(() => {
    if (!seekRequest || seekRequest.time == null) return;
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, seekRequest.time);
    v.play().catch(() => {});
  }, [seekRequest?.key]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Chunk activo: el que cae dentro del currentTime.
  const activeChunk = chunks.find(c => !c.hidden && currentTime >= c.start && currentTime < c.end);

  // Mapeo de fuente: lookup en fontOptions para obtener familyName + weight + italic.
  const fontMeta = fontOptions.find(f => f.id === style.font_caption) ||
    { familyName: 'Inter', weight: 600, italic: false };

  // Tamaño: ASS usa pixels sobre frame 1080×1920. El preview se renderiza a containerWidth.
  // Escala = containerWidth / 1080.
  const scale = containerWidth > 0 ? containerWidth / 1080 : 0;
  const fontSizePx = style.caption_font_size * scale;
  const bottomPct = subPositionToBottomPct(style.sub_position);

  // Outline simulado con text-shadow en 8 direcciones (≈ ASS BorderStyle 1).
  // El grosor se escala con el tamaño del preview (1 unit ASS ≈ 0.5px en preview a containerWidth/1080).
  const outlineColor = style.outline_color || '#000000';
  const thickAss = style.outline_thickness ?? 4;
  const t = Math.max(0, thickAss * scale * 0.5); // en px del preview
  const outline = thickAss === 0
    ? '0 2px 4px rgba(0,0,0,0.4)'  // sin borde, solo sombra suave
    : `
      ${-t}px ${-t}px 0 ${outlineColor},
      ${t}px ${-t}px 0 ${outlineColor},
      ${-t}px ${t}px 0 ${outlineColor},
      ${t}px ${t}px 0 ${outlineColor},
      0 ${-t}px 0 ${outlineColor},
      0 ${t}px 0 ${outlineColor},
      ${-t}px 0 0 ${outlineColor},
      ${t}px 0 0 ${outlineColor},
      0 ${t * 2}px ${t * 3}px rgba(0,0,0,0.5)
    `;

  return (
    <div ref={containerRef} className="bg-black aspect-[9/16] flex items-center justify-center relative overflow-hidden">
      <video ref={videoRef} src={baseVideoSrc} controls className="max-h-full max-w-full" />

      {activeChunk && (
        <div
          className="absolute left-0 right-0 pointer-events-none text-center px-4"
          style={{ bottom: `${bottomPct}%` }}
        >
          <span style={{
            fontFamily: `'${fontMeta.familyName}', sans-serif`,
            fontWeight: fontMeta.weight || 600,
            fontStyle: fontMeta.italic ? 'italic' : 'normal',
            fontSize: `${fontSizePx}px`,
            color: style.caption_color || '#FFFFFF',
            textShadow: outline,
            lineHeight: 1.15,
            display: 'inline-block',
            maxWidth: '92%',
          }}>{activeChunk.text}</span>
        </div>
      )}

      {showSafeZones && (
        <>
          <div className="absolute top-0 left-0 right-0 pointer-events-none"
            style={{ height: '11%', background: 'rgba(244, 63, 94, 0.25)', borderBottom: '1px dashed rgba(244, 63, 94, 0.7)' }}>
            <span className="absolute top-1 left-2 text-[9px] font-mono text-rose-100 bg-rose-900/60 px-1 rounded">IG header</span>
          </div>
          <div className="absolute top-[11%] bottom-[28%] right-0 pointer-events-none"
            style={{ width: '8%', background: 'rgba(244, 63, 94, 0.25)', borderLeft: '1px dashed rgba(244, 63, 94, 0.7)' }}>
            <span className="absolute top-1 right-1 text-[9px] font-mono text-rose-100 bg-rose-900/60 px-1 rounded">TT</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: '21%', background: 'rgba(244, 63, 94, 0.18)', borderTop: '1px dashed rgba(244, 63, 94, 0.5)' }}>
            <span className="absolute bottom-1 left-2 text-[9px] font-mono text-rose-100 bg-rose-900/60 px-1 rounded">IG bottom</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none"
            style={{ height: '28%', background: 'rgba(244, 63, 94, 0.18)', borderTop: '2px dashed rgba(244, 63, 94, 0.8)' }}>
            <span className="absolute bottom-1 right-2 text-[9px] font-mono text-rose-100 bg-rose-900/60 px-1 rounded">TT bottom</span>
          </div>
        </>
      )}
    </div>
  );
};

// Picker de posición vertical de subtítulos. 5 botones-preset + ajuste fino con flechas.
// Mapea a valores 40..90 que el .ass convierte a MarginV. Recomendado 68-75 (zona segura IG+TT).
const SUB_POSITION_PRESETS = [
  { value: 45, label: 'Pegado abajo', subtitle: 'Borde inferior', warn: true },
  { value: 58, label: 'Bajo', subtitle: 'OK Instagram', warn: 'amber' },
  { value: 68, label: 'Medio', subtitle: 'Recomendado IG+TikTok', warn: false, recommended: true },
  { value: 78, label: 'Alto', subtitle: 'Editorial elegante', warn: false },
  { value: 88, label: 'Casi mitad', subtitle: 'Centro pantalla', warn: 'amber' },
];

const SubPositionPicker = ({ value, onChange }) => {
  // El preset activo es el más cercano por valor.
  const closestPreset = SUB_POSITION_PRESETS.reduce((a, b) =>
    Math.abs(b.value - value) < Math.abs(a.value - value) ? b : a
  );

  const safetyBadge = () => {
    if (value < 60) return <span className="text-rose-600 dark:text-rose-400">⚠ Invade UI de TikTok — los subs pueden quedar tapados por el action bar.</span>;
    if (value < 65) return <span className="text-amber-600 dark:text-amber-400">⚠ Seguro en Instagram, riesgo en TikTok.</span>;
    if (value <= 85) return <span className="text-emerald-600 dark:text-emerald-400">✓ Zona segura en Instagram y TikTok.</span>;
    return <span className="text-amber-600 dark:text-amber-400">⚠ Muy alto, puede tapar al hablante.</span>;
  };

  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {SUB_POSITION_PRESETS.map(p => {
          const active = closestPreset.value === p.value;
          let cls = '';
          if (active && p.warn === true) cls = 'bg-rose-600 text-white border-rose-600';
          else if (active && p.warn === 'amber') cls = 'bg-amber-500 text-white border-amber-500';
          else if (active && p.recommended) cls = 'bg-emerald-600 text-white border-emerald-600';
          else if (active) cls = 'bg-gray-900 text-white border-gray-900 dark:bg-amber-600 dark:border-amber-600';
          else cls = 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-amber-400';
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange(p.value)}
              className={`px-2 py-2 rounded-lg border text-xs transition flex flex-col items-center gap-0.5 ${cls}`}
            >
              <span className="font-semibold">{p.label}</span>
              <span className="text-[10px] opacity-80">{p.subtitle}</span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange(Math.max(40, value - 2))}
            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">↓</button>
          <span className="text-xs text-gray-500">Ajuste fino</span>
          <button type="button" onClick={() => onChange(Math.min(90, value + 2))}
            className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm">↑</button>
        </div>
        <div className="text-[11px]">{safetyBadge()}</div>
      </div>
    </div>
  );
};

// Calcula bottom% del preview para una sub_position dada.
// sub_position 40..90 → marginV 200..1100 (sobre 1920) → bottom 10.4%..57.3%
function subPositionToBottomPct(sp) {
  const marginV = 200 + ((sp - 40) / 50) * 900;
  return (marginV / 1920) * 100;
}

// ==================== MUSIC REVIEW VIEW ====================
// Paso 3: el usuario busca/elige un track del catálogo, ajusta volumen/ducking/fades,
// re-mezcla on demand y finaliza. Puede saltarse el paso entero ("sin música").
const MusicReviewView = ({ job, onChange, onError }) => {
  const [tracks, setTracks] = useState([]);
  const [tagsCatalog, setTagsCatalog] = useState(job.music_tags_catalog || {});
  const [activeTags, setActiveTags] = useState([]);
  const [query, setQuery] = useState('');
  const [loadingTracks, setLoadingTracks] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [previewTrackId, setPreviewTrackId] = useState(null);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewVolume, setPreviewVolume] = useState(0.7);
  const previewAudioRef = useRef();

  // Selección actual desde el job
  const [selectedId, setSelectedId] = useState(job.music_track_id || null);
  const [music, setMusic] = useState({
    music_volume_db: job.music_volume_db ?? -16,
    music_ducking: job.music_ducking ?? 1,
    music_fade_in: job.music_fade_in ?? 1.0,
    music_fade_out: job.music_fade_out ?? 1.5,
    music_start_offset: job.music_start_offset ?? 0,
  });
  const [dirty, setDirty] = useState(false);
  const [mixing, setMixing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [curating, setCurating] = useState(false);
  const [providers, setProviders] = useState(null);
  const [curateResult, setCurateResult] = useState(null);

  useEffect(() => {
    getMusicProviders().then(setProviders).catch(() => {});
  }, []);

  const handleCurate = async () => {
    if (providers && !providers.jamendo?.configured) {
      onError('Falta configurar JAMENDO_CLIENT_ID en .env del servidor. Regístrate gratis en devportal.jamendo.com y reinicia.');
      return;
    }
    const filtered = activeTags.length > 0;
    const tagLabels = activeTags.map(id => {
      for (const g of Object.values(tagsCatalog || {})) {
        const t = g.find(x => x.id === id);
        if (t) return t.label;
      }
      return id;
    }).join(', ');
    const msg = filtered
      ? `Voy a traer más tracks de Jamendo SOLO con estos tags: ${tagLabels}. ¿Continuar?`
      : 'Voy a traer ~200 tracks variados (todos los moods/géneros) de Jamendo. Tarda ~40s. ¿Continuar?';
    if (!confirm(msg)) return;
    setCurating(true);
    setCurateResult(null);
    try {
      const result = await curateMusic({ activeTags });
      setCurateResult(result);
      const fresh = await listMusicTracks({ query, tags: activeTags });
      setTracks(fresh);
    } catch (e) {
      onError(e.message);
    } finally { setCurating(false); }
  };

  const finalDur = job.output_duration_seconds || 0;
  const selectedTrack = useMemo(
    () => tracks.find(t => t.id === selectedId) || job.music_track || null,
    [tracks, selectedId, job.music_track]
  );

  // Cargar tracks al montar y cuando cambian filtros
  useEffect(() => {
    let cancelled = false;
    setLoadingTracks(true);
    listMusicTracks({ query, tags: activeTags })
      .then(rows => { if (!cancelled) setTracks(rows); })
      .catch(e => { if (!cancelled) onError(e.message); })
      .finally(() => { if (!cancelled) setLoadingTracks(false); });
    return () => { cancelled = true; };
  }, [query, activeTags.join(',')]);

  const stopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setPreviewTrackId(null);
    setPreviewTime(0);
    setPreviewDuration(0);
  };

  const togglePreview = trackId => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewTrackId === trackId) {
      stopPreview();
      return;
    }
    const audio = new Audio(musicStreamUrl(trackId));
    audio.volume = previewVolume;
    audio.play().catch(() => {});
    audio.addEventListener('timeupdate', () => setPreviewTime(audio.currentTime));
    audio.addEventListener('loadedmetadata', () => setPreviewDuration(audio.duration || 0));
    audio.addEventListener('ended', () => stopPreview());
    previewAudioRef.current = audio;
    setPreviewTrackId(trackId);
    setPreviewTime(0);
    setPreviewDuration(0);
  };

  const seekPreview = pct => {
    const a = previewAudioRef.current;
    if (a && a.duration) a.currentTime = pct * a.duration;
  };

  const setVolumePreview = v => {
    setPreviewVolume(v);
    if (previewAudioRef.current) previewAudioRef.current.volume = v;
  };

  const playingTrack = tracks.find(t => t.id === previewTrackId);

  useEffect(() => () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
  }, []);

  const selectTrack = async track => {
    setSelectedId(track.id);
    setDirty(true);
    try {
      await updateMusic(job.id, { music_track_id: track.id });
    } catch (e) { onError(e.message); }
  };

  const setMusicField = (k, v) => {
    setMusic(prev => ({ ...prev, [k]: v }));
    setDirty(true);
  };

  const persistAndMix = async () => {
    setMixing(true);
    try {
      await updateMusic(job.id, { ...music, music_track_id: selectedId, music_skipped: 0 });
      await mixMusic(job.id);
      const tick = async () => {
        const fresh = await getReelJob(job.id);
        if (fresh.status === 'awaiting_music_review') {
          setDirty(false);
          setPreviewKey(k => k + 1);
          setMixing(false);
          onChange();
        } else if (fresh.status === 'error') {
          onError(fresh.error_message || 'Error mezclando');
          setMixing(false);
        } else {
          setTimeout(tick, 1500);
        }
      };
      setTimeout(tick, 1500);
    } catch (e) {
      onError(e.message);
      setMixing(false);
    }
  };

  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      if (dirty && selectedId) {
        await updateMusic(job.id, { ...music, music_track_id: selectedId, music_skipped: 0 });
      }
      await finalizeReel(job.id);
      onChange();
    } catch (e) {
      onError(e.message);
      setFinalizing(false);
    }
  };

  const handleSkip = async () => {
    setFinalizing(true);
    try {
      await updateMusic(job.id, { music_skipped: 1, music_track_id: null });
      await finalizeReel(job.id);
      onChange();
    } catch (e) {
      onError(e.message);
      setFinalizing(false);
    }
  };

  const handleBackToStyle = async () => {
    if (!confirm('¿Volver a editar fuente/subtítulos? Tu selección de música se conserva.')) return;
    try {
      await reopenStyle(job.id);
      onChange();
    } catch (e) { onError(e.message); }
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestions(null);
    try {
      const out = await suggestMusic(job.id);
      setSuggestions(out);
    } catch (e) {
      onError(e.message);
    } finally { setSuggesting(false); }
  };

  const toggleTag = id => {
    setActiveTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const previewSrc = job.has_music_mix
    ? outputWithMusicUrl(job.id) + '&v=' + previewKey
    : outputVideoUrl(job.id) + '&v=' + previewKey;

  return (
    <div>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">Paso 3 de 3 · Música de fondo (opcional)</div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Elige una canción y mezcla bajo la voz
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Tu reel dura {fmtTime(finalDur)} · si no quieres música, salta este paso.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleBackToStyle}
            className="px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg border border-amber-300 dark:border-amber-700/50">
            ← Volver a estilo
          </button>
          <button onClick={handleSkip} disabled={finalizing}
            className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
            Saltar música →
          </button>
          <button onClick={handleFinalize}
            disabled={finalizing || mixing || !selectedId}
            title={!selectedId ? 'Selecciona un track primero o usa "Saltar música"' : ''}
            className="px-4 py-2 text-sm bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium">
            {finalizing ? 'Finalizando…' : 'Exportar reel con música →'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Preview sticky */}
        <div className="lg:col-span-5">
          <div className="sticky top-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="bg-black aspect-[9/16] relative flex items-center justify-center">
                <video key={previewKey} src={previewSrc} controls className="max-h-full max-w-full" />
                {selectedTrack && job.has_music_mix && !dirty && (
                  <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/70 text-white text-[10px] flex items-center gap-1">
                    🎵 {selectedTrack.name} · {music.music_volume_db}dB
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-gray-200 dark:border-gray-700 text-xs">
                {!selectedId
                  ? <span className="text-gray-500">Selecciona un track de la lista para mezclar</span>
                  : dirty
                    ? <span className="text-amber-700 dark:text-amber-400">⚠ Preview sin la mezcla actual · pulsa "Mezclar preview"</span>
                    : <span className="text-emerald-700 dark:text-emerald-400">✓ Preview con la música al día</span>}
              </div>
            </div>
            <button
              onClick={persistAndMix}
              disabled={mixing || !selectedId || !dirty}
              className="w-full mt-3 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm"
            >
              {mixing ? 'Mezclando…' : 'Mezclar preview con esta música'}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              ~20s · re-mezcla audio sin re-cortar video
            </p>
          </div>
        </div>

        {/* Panel: sugerencia + búsqueda + lista + controles */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sugerencia IA — arriba según pediste */}
          <div className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-900/20 dark:to-rose-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <strong className="font-medium text-gray-900 dark:text-white">✨ ¿No sabes cuál escoger?</strong>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                  Que la IA lea tu transcript y te sugiera 3 opciones de tu biblioteca.
                </p>
              </div>
              <button onClick={handleSuggest} disabled={suggesting || tracks.length === 0}
                className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-lg disabled:opacity-50">
                {suggesting ? 'Pensando…' : 'Sugerir música'}
              </button>
            </div>
            {suggestions && (
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700/50">
                {suggestions.summary && (
                  <p className="text-xs italic text-gray-600 dark:text-gray-300 mb-2">"{suggestions.summary}"</p>
                )}
                {suggestions.suggestions.length === 0 ? (
                  <p className="text-xs text-gray-500">No encontré opciones claras en tu biblioteca.</p>
                ) : (
                  <div className="space-y-1">
                    {suggestions.suggestions.map((s, i) => {
                      const t = tracks.find(x => x.id === s.id);
                      if (!t) return null;
                      const isPlaying = previewTrackId === t.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { selectTrack(t); togglePreview(t.id); }}
                          className={`w-full text-left p-2 rounded-lg border flex items-center gap-2 transition ${
                            isPlaying
                              ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700/50'
                              : 'bg-white dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-900/30 border-amber-200 dark:border-amber-700/30'
                          }`}
                        >
                          <span className="text-xs font-mono text-amber-700 dark:text-amber-300">#{i + 1}</span>
                          <span className="w-6 h-6 rounded-full bg-gray-900 dark:bg-amber-600 text-white flex items-center justify-center text-[10px] shrink-0">
                            {isPlaying ? '⏸' : '▶'}
                          </span>
                          <span className="text-sm font-medium flex-1 truncate">{t.name}</span>
                          <span className="text-[11px] text-gray-500 truncate max-w-xs">{s.reason}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ampliar catálogo desde fuentes gratuitas */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  📚 {activeTags.length > 0 ? `Traer más tracks de los tags filtrados (${activeTags.length})` : 'Ampliar tu biblioteca con tracks gratis'}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {activeTags.length > 0
                    ? <>Trae más tracks de Jamendo <strong>solo</strong> para los tags que marcaste abajo. Cada pulsada trae la siguiente página, no los mismos.</>
                    : <>Trae ~200 tracks variados (todos los moods/géneros) desde <strong>Jamendo</strong> — Creative Commons, instrumentales. Para un mood específico, marca tags abajo y pulsa otra vez.</>}
                  {providers && !providers.jamendo?.configured && (
                    <span className="block text-rose-600 dark:text-rose-400 mt-1">
                      ⚠ Falta <code className="bg-rose-50 dark:bg-rose-900/30 px-1 rounded">JAMENDO_CLIENT_ID</code> en .env. Regístrate gratis en devportal.jamendo.com.
                    </span>
                  )}
                </p>
              </div>
              <button onClick={handleCurate} disabled={curating}
                className="px-3 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg whitespace-nowrap font-medium">
                {curating ? 'Buscando…' : activeTags.length > 0 ? `+ Traer más de estos tags` : '+ Ampliar catálogo'}
              </button>
            </div>
            {curateResult && (
              <div className="mt-3 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 rounded p-2 border border-emerald-200 dark:border-emerald-800/50">
                ✓ {curateResult.added} tracks nuevos · {curateResult.skipped} ya estaban
                {curateResult.errors?.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-rose-600 dark:text-rose-400">{curateResult.errors.length} errores</summary>
                    <ul className="mt-1 ml-4 list-disc">
                      {curateResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>

          {/* Buscador + upload */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, autor…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              </div>
              <button onClick={() => setShowUpload(true)}
                className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg whitespace-nowrap">
                ⬆ Subir track
              </button>
            </div>

            {/* Tags agrupados */}
            <TagsPicker catalog={tagsCatalog} activeTags={activeTags} onToggle={toggleTag} onClear={() => setActiveTags([])} />
          </div>

          {/* Mini-player encima de la lista — sticky para tenerlo a la mano */}
          {playingTrack && (
            <MiniPlayer
              track={playingTrack}
              currentTime={previewTime}
              duration={previewDuration}
              volume={previewVolume}
              onTogglePlay={() => togglePreview(playingTrack.id)}
              onSeek={seekPreview}
              onVolumeChange={setVolumePreview}
              onClose={stopPreview}
              tagsCatalog={tagsCatalog}
            />
          )}

          {/* Lista */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 text-xs uppercase tracking-wider text-gray-500 flex justify-between">
              <span>{loadingTracks ? 'Cargando…' : `${tracks.length} track${tracks.length === 1 ? '' : 's'} en tu biblioteca · scroll para ver más`}</span>
              {activeTags.length > 0 && (
                <button onClick={() => setActiveTags([])} className="hover:text-gray-700 dark:hover:text-gray-200">
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="max-h-[480px] overflow-y-auto">
            {tracks.length === 0 && !loadingTracks && (
              <div className="p-8 text-center text-sm text-gray-500">
                {query || activeTags.length
                  ? 'Sin resultados con esos filtros. Prueba con otra búsqueda o limpia los tags.'
                  : <>Tu biblioteca está vacía. <button onClick={() => setShowUpload(true)} className="underline text-amber-700 hover:text-amber-800">Sube tu primer track</button>.</>}
              </div>
            )}
            {tracks.map(t => (
              <TrackRow
                key={t.id}
                track={t}
                selected={selectedId === t.id}
                playing={previewTrackId === t.id}
                tagsCatalog={tagsCatalog}
                onSelect={() => selectTrack(t)}
                onTogglePreview={() => togglePreview(t.id)}
                onDelete={async () => {
                  if (!confirm(`¿Eliminar "${t.name}" de la biblioteca?`)) return;
                  try {
                    await deleteMusicTrack(t.id);
                    setTracks(prev => prev.filter(x => x.id !== t.id));
                    if (selectedId === t.id) setSelectedId(null);
                  } catch (e) { onError(e.message); }
                }}
              />
            ))}
            </div>
          </div>

          {/* Controles del track seleccionado */}
          {selectedTrack && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500 mb-1">
                Mezcla de "{selectedTrack.name}"
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Cualquier cambio aquí marca el preview como pendiente — pulsa "Mezclar preview" para escuchar.
              </p>
              <div className="space-y-5">
                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-sm text-gray-700 dark:text-gray-200">Volumen de la música</label>
                    <span className="text-sm font-mono font-semibold">{music.music_volume_db}dB</span>
                  </div>
                  <input type="range" min="-30" max="0" step="1"
                    value={music.music_volume_db}
                    onChange={e => setMusicField('music_volume_db', parseInt(e.target.value))}
                    className="w-full accent-gray-900 dark:accent-amber-500" />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                    <span>← muy suave (-30dB)</span><span>volumen pleno (0dB) →</span>
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg cursor-pointer">
                  <input type="checkbox"
                    checked={!!music.music_ducking}
                    onChange={e => setMusicField('music_ducking', e.target.checked ? 1 : 0)}
                    className="mt-1 accent-amber-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Bajar música automáticamente cuando hablas</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                      La música se atenúa cuando hay voz y vuelve a su nivel en pausas. Recomendado para que tu mensaje siempre se escuche claro.
                    </p>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fade in (entrada) · {music.music_fade_in.toFixed(1)}s</label>
                    <input type="range" min="0" max="3" step="0.5"
                      value={music.music_fade_in}
                      onChange={e => setMusicField('music_fade_in', parseFloat(e.target.value))}
                      className="w-full accent-gray-900 dark:accent-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Fade out (salida) · {music.music_fade_out.toFixed(1)}s</label>
                    <input type="range" min="0" max="3" step="0.5"
                      value={music.music_fade_out}
                      onChange={e => setMusicField('music_fade_out', parseFloat(e.target.value))}
                      className="w-full accent-gray-900 dark:accent-amber-500" />
                  </div>
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <label className="text-sm text-gray-700 dark:text-gray-200">Empezar el track desde</label>
                    <span className="text-xs font-mono text-gray-500">{fmtTime(music.music_start_offset)} {music.music_start_offset > 0 ? '(salta intro)' : ''}</span>
                  </div>
                  <input type="range" min="0" max={Math.max(0, (selectedTrack.duration_seconds || 60) - finalDur - 1)} step="1"
                    value={music.music_start_offset}
                    onChange={e => setMusicField('music_start_offset', parseFloat(e.target.value))}
                    className="w-full accent-gray-900 dark:accent-amber-500" />
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    Si el track empieza con silencio o intro pesada, salta unos segundos.
                  </div>
                </div>

                <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-900/50 rounded p-3 border border-gray-200 dark:border-gray-700">
                  💡 El track dura {fmtTime(selectedTrack.duration_seconds || 0)} y tu reel {fmtTime(finalDur)}.
                  {(selectedTrack.duration_seconds || 0) >= finalDur
                    ? ' La música se recorta a la duración del reel con fade-out.'
                    : ' La música hace loop con crossfade hasta cubrir el reel completo.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <UploadTrackModal
          tagsCatalog={tagsCatalog}
          onClose={() => setShowUpload(false)}
          onUploaded={track => {
            setTracks(prev => [track, ...prev]);
            setShowUpload(false);
          }}
          onError={onError}
        />
      )}
    </div>
  );
};

// --- Subcomponentes de MusicReviewView ---

// Mini-player sticky para previews. Muestra qué está sonando + progreso + controles.
const MiniPlayer = ({ track, currentTime, duration, volume, onTogglePlay, onSeek, onVolumeChange, onClose, tagsCatalog }) => {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const tagLabels = (track.tags || []).slice(0, 2).map(id => {
    for (const g of Object.values(tagsCatalog || {})) {
      const t = g.find(x => x.id === id);
      if (t) return `${t.emoji || ''} ${t.label}`.trim();
    }
    return id;
  });
  return (
    <div className="sticky top-0 z-20 -mt-1 pt-2 pb-2 bg-stone-50 dark:bg-gray-900">
      <div className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-amber-900/30 dark:to-rose-900/30 border-2 border-amber-400 dark:border-amber-600 rounded-xl p-3 shadow-md">
        <div className="flex items-center gap-3">
          {/* Thumbnail con barras animadas */}
          <div className="relative w-12 h-12 rounded shrink-0 overflow-hidden">
            {track.thumbnail_url ? (
              <img src={track.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-white">♪</div>
            )}
            <div className="absolute inset-0 bg-black/40 flex items-end justify-center gap-0.5 px-2 pb-1">
              <span className="w-1 bg-white rounded-t animate-eq-1" />
              <span className="w-1 bg-white rounded-t animate-eq-2" />
              <span className="w-1 bg-white rounded-t animate-eq-3" />
              <span className="w-1 bg-white rounded-t animate-eq-4" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">▶ Sonando</span>
              {tagLabels.map((l, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300">{l}</span>
              ))}
            </div>
            <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{track.name}</div>
            {track.artist && <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{track.artist}</div>}
          </div>

          {/* Controles */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onTogglePlay}
              className="w-10 h-10 rounded-full bg-gray-900 dark:bg-amber-600 hover:bg-gray-800 dark:hover:bg-amber-700 text-white flex items-center justify-center"
              title="Pausar"
            >⏸</button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center"
              title="Cerrar preview"
            >✕</button>
          </div>
        </div>

        {/* Progress + tiempo */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600 dark:text-gray-300 w-9 text-right">{fmtTime(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full cursor-pointer relative overflow-hidden"
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSeek((e.clientX - rect.left) / rect.width);
            }}
          >
            <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-gray-500 w-9">{fmtTime(duration)}</span>
        </div>

        {/* Volumen */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[10px] text-gray-500">🔉</span>
          <input
            type="range" min="0" max="1" step="0.05"
            value={volume}
            onChange={e => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 accent-amber-600 h-1"
          />
          <span className="text-[10px] font-mono text-gray-500 w-8">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
};

const TagsPicker = ({ catalog, activeTags, onToggle, onClear }) => {
  const groups = catalog && catalog.mood ? catalog : { mood: [], energy: [], genre: [] };
  const labelFor = id => {
    for (const g of Object.values(groups)) {
      const t = g.find(x => x.id === id);
      if (t) return `${t.emoji || ''} ${t.label}`.trim();
    }
    return id;
  };
  return (
    <div className="space-y-2">
      {Object.entries(groups).map(([groupKey, items]) => (
        <div key={groupKey}>
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            {groupKey === 'mood' ? 'Mood' : groupKey === 'energy' ? 'Energía' : 'Género'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map(t => {
              const active = activeTags.includes(t.id);
              return (
                <button key={t.id} onClick={() => onToggle(t.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
                    active
                      ? 'bg-gray-900 text-white border-gray-900 dark:bg-amber-600 dark:border-amber-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:border-amber-400'
                  }`}>
                  {t.emoji ? `${t.emoji} ` : ''}{t.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const TrackRow = ({ track, selected, playing, tagsCatalog, onSelect, onTogglePreview, onDelete }) => {
  const tagLabels = (track.tags || []).slice(0, 3).map(id => {
    for (const g of Object.values(tagsCatalog || {})) {
      const t = g.find(x => x.id === id);
      if (t) return `${t.emoji || ''} ${t.label}`.trim();
    }
    return id;
  });
  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 flex items-center gap-3 cursor-pointer transition ${
        playing
          ? 'bg-gradient-to-r from-amber-100 to-rose-100 dark:from-amber-900/40 dark:to-rose-900/40 border-l-4 border-l-rose-500'
          : selected
            ? 'bg-amber-50 dark:bg-amber-900/20 border-l-4 border-l-amber-600'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 border-l-4 border-l-transparent'
      }`}
    >
      <div className="relative shrink-0">
        {track.thumbnail_url ? (
          <img src={track.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover" loading="lazy" />
        ) : (
          <div className="w-10 h-10 rounded bg-gradient-to-br from-amber-300 to-rose-400 dark:from-amber-700 dark:to-rose-700 flex items-center justify-center text-white text-xs">♪</div>
        )}
        {/* Botón de play hover (cuando no está sonando) */}
        {!playing && (
          <button
            onClick={e => { e.stopPropagation(); onTogglePreview(); }}
            className="absolute inset-0 rounded bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition"
            title="Escuchar preview"
          >
            <span className="text-lg">▶</span>
          </button>
        )}
        {/* Cuando está sonando: ecualizador animado siempre visible + click para pausar */}
        {playing && (
          <button
            onClick={e => { e.stopPropagation(); onTogglePreview(); }}
            className="absolute inset-0 rounded bg-black/55 hover:bg-black/70 text-white flex items-end justify-center gap-0.5 px-2 pb-1.5 transition"
            title="Pausar"
          >
            <span className="w-1 bg-white rounded-t animate-eq-1" />
            <span className="w-1 bg-white rounded-t animate-eq-2" />
            <span className="w-1 bg-white rounded-t animate-eq-3" />
            <span className="w-1 bg-white rounded-t animate-eq-4" />
          </button>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{track.name}</span>
          {track.artist && <span className="text-xs text-gray-500">· {track.artist}</span>}
          {tagLabels.map((l, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{l}</span>
          ))}
        </div>
        <div className="text-[11px] text-gray-500 mt-0.5">
          {track.source || 'tu biblioteca'} · {track.bpm ? `${track.bpm} BPM · ` : ''}{fmtTime(track.duration_seconds || 0)}
          {track.license ? ` · ${track.license}` : ''}
        </div>
      </div>
      {playing && <span className="text-[10px] font-semibold uppercase tracking-wider text-white px-2 py-1 bg-rose-600 rounded-full shadow-sm">▶ Sonando</span>}
      {selected && !playing && <span className="text-[10px] font-semibold uppercase tracking-wider text-white px-2 py-1 bg-emerald-600 rounded-full shadow-sm">✓ Seleccionado</span>}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="text-gray-400 hover:text-rose-600 px-2"
        title="Eliminar de la biblioteca"
      >✕</button>
    </div>
  );
};

const UploadTrackModal = ({ tagsCatalog, onClose, onUploaded, onError }) => {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [source, setSource] = useState('subido_por_ti');
  const [license, setLicense] = useState('');
  const [bpm, setBpm] = useState('');
  const [tags, setTags] = useState([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const toggleTag = id => setTags(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    if (!file) { onError('Falta el archivo de audio'); return; }
    setUploading(true);
    try {
      const track = await uploadMusicTrack(file, {
        name: name || file.name.replace(/\.[^.]+$/, ''),
        artist, source, license, bpm, tags,
      }, setProgress);
      onUploaded(track);
    } catch (e) {
      onError(e.message);
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-lg">Subir track a tu biblioteca</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Archivo de audio</label>
            <input type="file"
              accept="audio/mpeg,audio/wav,audio/mp4,audio/ogg,.mp3,.wav,.m4a,.ogg,.aac,.flac"
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm" />
            <p className="text-[10px] text-gray-400 mt-1">MP3, WAV, M4A, OGG, AAC, FLAC · máximo 50MB</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nombre</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="(si vacío, usa nombre del archivo)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Artista (opcional)</label>
              <input type="text" value={artist} onChange={e => setArtist(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fuente</label>
              <select value={source} onChange={e => setSource(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900">
                <option value="subido_por_ti">Subido por ti</option>
                <option value="pixabay">Pixabay Music</option>
                <option value="youtube_audio_library">YouTube Audio Library</option>
                <option value="freesound">Freesound</option>
                <option value="epidemic_sound">Epidemic Sound</option>
                <option value="artlist">Artlist</option>
                <option value="otra">Otra</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Licencia / atribución</label>
              <input type="text" value={license} onChange={e => setLicense(e.target.value)}
                placeholder="Ej: royalty-free comercial"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">BPM (opcional)</label>
              <input type="number" value={bpm} onChange={e => setBpm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-900" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-2">Tags (selecciona los que apliquen, mejora búsqueda y sugerencias IA)</label>
            <TagsPicker catalog={tagsCatalog} activeTags={tags} onToggle={toggleTag} onClear={() => setTags([])} />
          </div>

          {uploading && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Subiendo… {progress}%</div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                <div className="h-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!file || uploading}
            className="px-4 py-2 text-sm bg-gray-900 hover:bg-gray-800 text-white rounded-lg disabled:opacity-50">
            {uploading ? 'Subiendo…' : 'Subir track'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Título editable inline. Click sobre el título → input; Enter o blur guarda; Esc cancela.
const EditableTitle = ({ jobId, value, onSaved, className = '', placeholder = 'Sin título' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef();

  useEffect(() => { setDraft(value || ''); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); inputRef.current?.select(); }, [editing]);

  const commit = async () => {
    const next = draft.trim();
    if (!next || next === value) { setEditing(false); setDraft(value || ''); return; }
    setSaving(true);
    try {
      await updateReelTitle(jobId, next);
      onSaved?.(next);
    } catch (e) {
      alert(e.message);
      setDraft(value || '');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        disabled={saving}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        placeholder={placeholder}
        className={`bg-white dark:bg-gray-900 border border-amber-500 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-amber-300 ${className}`}
      />
    );
  }
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      title="Click para renombrar"
      className={`text-left hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded px-1 -mx-1 transition flex items-center gap-2 group ${className}`}
    >
      <span className="truncate">{value || placeholder}</span>
      <span className="opacity-0 group-hover:opacity-100 text-xs text-gray-400 transition">✏️</span>
    </button>
  );
};

const DoneView = ({ job, onBack, onReopen, onError }) => {
  const totalDur = job.duration_seconds || 0;
  const finalDur = job.output_duration_seconds || 0;
  const removed = Math.max(0, totalDur - finalDur);
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <div className="bg-black aspect-[9/16] rounded-lg overflow-hidden flex items-center justify-center">
          <video
            src={job.has_music_mix && !job.music_skipped ? outputWithMusicUrl(job.id) : outputVideoUrl(job.id)}
            controls
            className="max-h-full max-w-full"
          />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-1">Reel listo</div>
          <EditableTitle
            jobId={job.id}
            value={job.title || 'Tu reel'}
            onSaved={onReopen /* refresca el job */}
            className="text-2xl font-semibold text-gray-900 dark:text-white mb-3 block w-full"
          />
          <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mb-4">
            <div><span className="text-gray-400">Original:</span> {fmtTime(totalDur)}</div>
            <div><span className="text-gray-400">Final:</span> {fmtTime(finalDur)}</div>
            {removed > 0.5 && (
              <div className="text-rose-700 dark:text-rose-400">
                −{Math.round(removed)}s de silencios eliminados
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={downloadUrl(job.id)}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white rounded-lg font-medium text-sm"
            >
              Descargar MP4
            </a>
            <button
              onClick={async () => {
                try {
                  await reopenSilences(job.id);
                  onReopen();
                } catch (e) { onError?.(e.message); }
              }}
              className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 rounded-lg text-sm"
            >
              ← Volver a editar
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg text-sm"
            >
              Subir otra toma
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const JobsList = ({ jobs, activeId, onSelect, onDelete, onTitleChanged }) => (
  <section>
    <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3">Tus reels</h3>
    <div className="space-y-2">
      {jobs.map(j => (
        <div key={j.id} className={`bg-white dark:bg-gray-800 border rounded-lg px-4 py-3 flex items-center gap-3 ${activeId === j.id ? 'border-amber-500' : 'border-gray-200 dark:border-gray-700'}`}>
          <div className="flex-1 min-w-0">
            <EditableTitle
              jobId={j.id}
              value={j.title || j.source_filename || 'Sin título'}
              onSaved={() => onTitleChanged?.()}
              className="font-medium text-sm text-gray-900 dark:text-white truncate max-w-full"
            />
            <button onClick={() => onSelect(j.id)} className="text-xs text-gray-500 mt-0.5 hover:text-amber-700 dark:hover:text-amber-400 text-left block">
              {statusLabel(j.status)} · {j.duration_seconds ? fmtTime(j.duration_seconds) : '—'}
              {j.output_duration_seconds ? ` → ${fmtTime(j.output_duration_seconds)}` : ''}
              · {new Date(j.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
            </button>
          </div>
          <button
            onClick={() => onDelete(j.id)}
            className="text-xs text-gray-400 hover:text-rose-600"
            title="Eliminar este reel"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  </section>
);

const statusLabel = s => ({
  pending: '⏳ Pendiente',
  running: '⚙️ Procesando',
  awaiting_review: '👀 Esperando revisión de silencios',
  awaiting_style_review: '🎨 Esperando revisión de estilo',
  awaiting_music_review: '🎵 Esperando música',
  rendering: '✂️ Cortando',
  rendering_base: '✂️ Aplicando cortes',
  rendering_preview: '🎨 Renderizando preview',
  rendering_music_mix: '🎵 Mezclando música',
  done: '✅ Listo',
  error: '❌ Error',
}[s] || s);

export default ReelsCleanerPage;
