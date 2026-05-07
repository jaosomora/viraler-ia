import React, { useEffect, useState } from 'react';
import { useClips } from '../context/ClipsContext';
import ClipsForm from '../components/ClipsForm';
import ClipCard from '../components/ClipCard';
import ClipEditor from '../components/ClipEditor';
import JobProgress from '../components/JobProgress';

// Importar Google Fonts una sola vez para preview en cards y editor
const FONTS_LINK_ID = 'as-clips-fonts';
const ensureFonts = () => {
  if (document.getElementById(FONTS_LINK_ID)) return;
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=League+Spartan:wght@600;800&family=Montserrat:wght@400;600;700;900&family=Oswald:wght@500;700&family=Poppins:wght@600;700&display=swap';
  document.head.appendChild(link);
};

const ClipsPage = () => {
  const { jobs, activeJob, activeJobId, setActiveJobId, loadJobs, downloadClip } = useClips();
  const [editingClip, setEditingClip] = useState(null);

  useEffect(() => { ensureFonts(); loadJobs(); }, [loadJobs]);

  const downloadAll = async (clips) => {
    for (const c of clips) {
      try { await downloadClip(c, c.output_resolution || '1080'); }
      catch (e) { console.error('download failed', c.id, e); }
    }
  };

  const inProgress = jobs.filter(j => j.status !== 'done' && j.status !== 'error');
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

        {inProgress.map(j => (
          <div key={j.id} onClick={() => setActiveJobId(j.id)} className="cursor-pointer">
            <JobProgress job={displayedJob && displayedJob.id === j.id ? displayedJob : j} />
          </div>
        ))}

        {displayedJob && displayedJob.status === 'done' && displayedJob.clips?.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  {displayedJob.total_clips} clip{displayedJob.total_clips === 1 ? '' : 's'} de "{displayedJob.title}"
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Costo: ${displayedJob.total_cost_usd.toFixed(4)} · {Math.round(displayedJob.duration_seconds / 60)}min de fuente
                </p>
              </div>
              <button onClick={() => downloadAll(displayedJob.clips)}
                className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium">
                Descargar todos
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedJob.clips.map(c => (
                <ClipCard key={c.id} clip={c} onEdit={setEditingClip} />
              ))}
            </div>
          </section>
        )}

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
