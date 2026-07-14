import React, { useEffect, useState } from 'react';
import { useClips } from '../context/ClipsContext';
import ClipsForm from '../components/ClipsForm';
import ClipCard from '../components/ClipCard';
import ClipEditor from '../components/ClipEditor';
import JobProgress from '../components/JobProgress';
import ManualClipSelection from '../components/ManualClipSelection';
import { useToast, useConfirm } from '../components/ui/feedback';

// Importar Google Fonts una sola vez para preview en cards y editor
// Las fuentes ahora se cargan via @font-face desde nuestro propio server
// (/assets/fonts/*.ttf — declarados en src/index.css). Esto garantiza que
// browser y libass usen el MISMO archivo TTF, asegurando WYSIWYG real.
const ensureFonts = () => {};

const ClipsPage = () => {
  const { jobs, activeJob, activeJobId, setActiveJobId, loadJobs, loadJob, downloadClip, reopenForSelection } = useClips();
  const [editingClip, setEditingClip] = useState(null);
  const [hookBannerDismissed, setHookBannerDismissed] = useState(false);
  const toast = useToast();
  const confirmDialog = useConfirm();

  useEffect(() => { ensureFonts(); loadJobs(); }, [loadJobs]);
  // Reset banner state al cambiar de job
  useEffect(() => { setHookBannerDismissed(false); }, [activeJobId]);

  const toggleAllHooks = async (enabled) => {
    if (!activeJob) return;
    const ok = enabled || await confirmDialog({
      title: '¿Desactivar el gancho en todos los clips?',
      message: 'Los textos se conservan, solo dejan de quemarse en el video.',
      confirmLabel: 'Desactivar',
    });
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
    } catch (e) { toast(e.message, { type: 'danger' }); }
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
      toast(e.message, { type: 'danger' });
    }
  };

  // Mantenemos los jobs en error en la lista "en progreso" para que JobProgress muestre
  // el mensaje de error en rojo. El usuario los descarta con el botón de eliminar.
  const inProgress = jobs.filter(j => j.status !== 'done');
  const finished = jobs.filter(j => j.status === 'done');

  const displayedJob = activeJob && activeJob.id === activeJobId ? activeJob : null;

  return (
    <div className="flex flex-col space-y-8">
      <div className="max-w-7xl mx-auto w-full">
        <span className="eyebrow">De charla a clips</span>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight">
          AS Clips
        </h1>
        <p className="mt-2 text-ink-500 dark:text-ink-400 max-w-2xl">
          Convierte videos largos en clips verticales con subtítulos estilo Instagram, ganchos elegidos por IA y texto sugerido para publicar.
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
              <div className="mb-4 p-4 rounded-2xl bg-accent-soft dark:bg-accent-deep border border-accent/20 dark:border-accent-bright/20 flex items-start gap-3">
                <div className="text-xl shrink-0">✨</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink-950 dark:text-paper">
                    Gancho automático añadido a los {totalClips} clip{totalClips === 1 ? '' : 's'}
                  </div>
                  <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
                    Cada clip lleva un gancho quemado en los primeros 4 segundos. Si no lo necesitas, desactívalo en todos a la vez. Para refinar uno por uno, abre "Editar" en cada clip.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleAllHooks(false)} className="btn btn-ghost btn-sm">
                    Desactivar
                  </button>
                  <button onClick={() => setHookBannerDismissed(true)}
                    className="px-2 py-1 text-ink-400 hover:text-ink-950 dark:hover:text-paper transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            )}
            {allDisabled && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-ink-100 dark:bg-ink-900 border hairline flex items-center justify-between gap-3">
                <span className="text-xs text-ink-500 dark:text-ink-400">
                  Gancho desactivado en todos los clips de este video.
                </span>
                <button onClick={() => toggleAllHooks(true)} className="btn btn-ghost btn-sm">
                  Reactivar
                </button>
              </div>
            )}
            <div className="flex items-end justify-between mb-4 gap-3 flex-wrap">
              <div>
                <span className="eyebrow">Tus clips</span>
                <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
                  {displayedJob.total_clips} clip{displayedJob.total_clips === 1 ? '' : 's'} de "{displayedJob.title}"
                </h3>
                <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 font-mono tabular-nums">
                  {Math.round(displayedJob.duration_seconds / 60)} min de video original
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleReopenForSelection(displayedJob.id)}
                  title="Vuelve a la pantalla de selección manual con la misma transcripción para agregar más fragmentos sin volver a transcribir."
                  className="btn btn-ghost btn-sm">
                  ✂️ Agregar más clips
                </button>
                <button onClick={() => downloadAll(displayedJob.clips)}
                  className="btn btn-primary btn-sm">
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
            <div className="mb-3">
              <span className="eyebrow">Historial</span>
            </div>
            <div className="space-y-2">
              {finished.map(j => (
                <button key={j.id} onClick={() => setActiveJobId(j.id)}
                  className={`w-full text-left card px-4 py-3 transition-colors hover:border-accent/50 dark:hover:border-accent-bright/50 ${activeJobId === j.id ? 'border-accent dark:border-accent-bright' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{j.title || j.source_url || 'Sin título'}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 font-mono tabular-nums">
                        {j.clip_count} clips · {new Date(j.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-accent dark:text-accent-bright">Ver →</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-ink-500 dark:text-ink-400">
            <p className="text-sm">Todavía no has generado clips. Pega un enlace de video arriba para empezar.</p>
          </div>
        )}
      </div>

      {editingClip && <ClipEditor clip={editingClip} onClose={() => setEditingClip(null)} />}
    </div>
  );
};

export default ClipsPage;
