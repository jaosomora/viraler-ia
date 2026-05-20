import React, { useEffect, useState } from 'react';
import { useClips } from '../context/ClipsContext';
import ClipsForm from '../components/ClipsForm';
import ClipCard from '../components/ClipCard';
import ClipEditor from '../components/ClipEditor';
import JobProgress from '../components/JobProgress';
import ManualClipSelection from '../components/ManualClipSelection';

// Importar Google Fonts una sola vez para preview en cards y editor
// Las fuentes ahora se cargan via @font-face desde nuestro propio server
// (/assets/fonts/*.ttf — declarados en src/index.css). Esto garantiza que
// browser y libass usen el MISMO archivo TTF, asegurando WYSIWYG real.
const ensureFonts = () => {};

const ClipsPage = () => {
  const { jobs, activeJob, activeJobId, setActiveJobId, loadJobs, loadJob, downloadClip, reopenForSelection } = useClips();
  const [editingClip, setEditingClip] = useState(null);
  const [hookBannerDismissed, setHookBannerDismissed] = useState(false);

  useEffect(() => { ensureFonts(); loadJobs(); }, [loadJobs]);
  // Reset banner state al cambiar de job
  useEffect(() => { setHookBannerDismissed(false); }, [activeJobId]);

  const toggleAllHooks = async (enabled) => {
    if (!activeJob) return;
    const ok = enabled || confirm('¿Desactivar el gancho en todos los clips de este job? Los textos se conservan, solo dejan de quemarse en el video.');
    if (!ok) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/clips/jobs/${activeJob.id}/disable-hooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: enabled ? 1 : 0 }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      await loadJob(activeJob.id);
      setHookBannerDismissed(true);
    } catch (e) { alert(e.message); }
  };

  const downloadAll = async (clips) => {
    for (const c of clips) {
      try { await downloadClip(c, c.output_resolution || '1080'); }
      catch (e) { console.error('download failed', c.id, e); }
    }
  };

  const handleReopenForSelection = async (jobId) => {
    try {
      await reopenForSelection(jobId);
    } catch (e) {
      alert(e.message);
    }
  };

  // Mantenemos los jobs en error en la lista "en progreso" para que JobProgress muestre
  // el mensaje de error en rojo. El usuario los descarta con el botón de eliminar.
  const inProgress = jobs.filter(j => j.status !== 'done');
  const finished = jobs.filter(j => j.status === 'done');

  const displayedJob = activeJob && activeJob.id === activeJobId ? activeJob : null;

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          AS Clips
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Convierte videos largos en clips verticales con subtítulos estilo Instagram, hooks elegidos por IA y texto sugerido para publicar.
        </p>
      </div>

      <div className="max-w-7xl mx-auto w-full space-y-6">
        <ClipsForm />

        {inProgress.map(j => {
          // En modo manual, cuando el job está esperando que el usuario marque rangos,
          // mostramos la pantalla de selección en vez de la barra de progreso.
          const liveJob = displayedJob && displayedJob.id === j.id ? displayedJob : j;
          if (liveJob.status === 'awaiting_selection') {
            return (
              <div key={j.id} onClick={() => setActiveJobId(j.id)}>
                <ManualClipSelection job={liveJob} />
              </div>
            );
          }
          return (
            <div key={j.id} onClick={() => setActiveJobId(j.id)} className="cursor-pointer">
              <JobProgress job={liveJob} />
            </div>
          );
        })}

        {displayedJob && displayedJob.status === 'done' && displayedJob.clips?.length > 0 && (() => {
          const totalClips = displayedJob.clips.length;
          const enabledHooks = displayedJob.clips.filter(c => c.hook_enabled !== 0).length;
          const allEnabled = enabledHooks === totalClips;
          const allDisabled = enabledHooks === 0;
          const showBanner = !hookBannerDismissed && allEnabled;
          return (
        <section>
            {showBanner && (
              <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/50 rounded-lg flex items-start gap-3">
                <div className="text-xl shrink-0">✨</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    Gancho automático añadido a los {totalClips} clip{totalClips === 1 ? '' : 's'}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    Cada clip lleva un texto de hook quemado en los primeros 4 segundos. Si no lo necesitas, desactívalo masivamente. Para refinar uno a uno, ve a "Editar clip".
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => toggleAllHooks(false)}
                    className="text-xs px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                    Desactivar
                  </button>
                  <button onClick={() => setHookBannerDismissed(true)}
                    className="text-xs px-2 py-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                    ✕
                  </button>
                </div>
              </div>
            )}
            {allDisabled && (
              <div className="mb-4 p-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 rounded-lg flex items-center justify-between gap-3">
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  Gancho desactivado en todos los clips de este job.
                </span>
                <button onClick={() => toggleAllHooks(true)}
                  className="text-xs px-2.5 py-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
                  Reactivar
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  {displayedJob.total_clips} clip{displayedJob.total_clips === 1 ? '' : 's'} de "{displayedJob.title}"
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Costo: ${displayedJob.total_cost_usd.toFixed(4)} · {Math.round(displayedJob.duration_seconds / 60)}min de fuente
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReopenForSelection(displayedJob.id)}
                  title="Vuelve a la pantalla de selección manual con la misma transcripción para agregar más fragmentos sin re-transcribir."
                  className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-sm font-medium">
                  ✂️ Agregar más clips
                </button>
                <button onClick={() => downloadAll(displayedJob.clips)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium">
                  Descargar todos
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedJob.clips.map(c => (
                <ClipCard key={c.id} clip={c} onEdit={setEditingClip} />
              ))}
            </div>
          </section>
          );
        })()}

        {finished.length > 0 && (
          <section>
            <h3 className="font-bold text-sm uppercase tracking-wide text-gray-500 mb-3">Jobs anteriores</h3>
            <div className="space-y-2">
              {finished.map(j => (
                <button key={j.id} onClick={() => setActiveJobId(j.id)}
                  className={`w-full text-left bg-white dark:bg-gray-800 border rounded-lg px-4 py-3 hover:border-purple-300 dark:hover:border-purple-700 transition ${activeJobId === j.id ? 'border-purple-500' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{j.title || j.source_url || 'Sin título'}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {j.clip_count} clips · ${(j.total_cost_usd || 0).toFixed(4)} · {new Date(j.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <span className="text-xs text-purple-600 dark:text-purple-400">Ver →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Aún no has generado clips. Pega una URL arriba para empezar.</p>
          </div>
        )}
      </div>

      {editingClip && <ClipEditor clip={editingClip} onClose={() => setEditingClip(null)} />}
    </div>
  );
};

export default ClipsPage;
