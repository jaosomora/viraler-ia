import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listReelJobs, deleteReelJob, downloadUrl } from '../services/reelsApi';
import { useToast, useConfirm } from './ui/feedback';

const fmtTime = s => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
};

const statusLabel = s => ({
  pending: '⏳ Pendiente', running: '⚙️ Procesando',
  awaiting_review: '👀 Esperando revisión de silencios',
  awaiting_style_review: '🎨 Esperando revisión de estilo',
  awaiting_music_review: '🎵 Esperando música',
  rendering_base: '✂️ Aplicando cortes',
  rendering_preview: '🎨 Renderizando preview',
  rendering_music_mix: '🎵 Mezclando música',
  done: '✅ Listo',
  error: '❌ Error',
}[s] || s);

const SavedReels = () => {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setReels(await listReelJobs()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleDelete = async id => {
    const ok = await confirmDialog({
      title: '¿Eliminar este reel?',
      message: 'Se borran los archivos del disco.',
      danger: true,
    });
    if (!ok) return;
    try { await deleteReelJob(id); load(); }
    catch (e) { toast(e.message, { type: 'danger' }); }
  };

  if (loading) return <div className="text-center text-ink-500 dark:text-ink-400 py-8">Cargando…</div>;

  if (reels.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <span className="eyebrow">Reels</span>
        <p className="text-ink-500 dark:text-ink-400">Aún no has limpiado ningún reel.</p>
        <Link to="/reels-cleaner" className="btn btn-ghost btn-sm">
          Ir a Reels Cleaner →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reels.map(r => (
        <div key={r.id} className="card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <Link to="/reels-cleaner" className="font-semibold hover:text-accent dark:hover:text-accent-bright truncate block transition-colors">
                {r.title || r.source_filename || 'Sin título'}
              </Link>
              <div className="text-xs text-ink-500 dark:text-ink-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>{statusLabel(r.status)}</span>
                {r.duration_seconds && (
                  <span className="font-mono tabular-nums">
                    {fmtTime(r.duration_seconds)}
                    {r.output_duration_seconds && r.output_duration_seconds !== r.duration_seconds
                      ? ` → ${fmtTime(r.output_duration_seconds)}`
                      : ''}
                  </span>
                )}
                <span>
                  {new Date(r.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              {r.error_message && (
                <p className="text-xs text-danger dark:text-danger-bright mt-1">{r.error_message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.status === 'done' && !r.files_purged && (
                <a href={downloadUrl(r.id)} className="btn btn-accent btn-sm">
                  Descargar
                </a>
              )}
              {r.files_purged ? (
                <span className="chip chip-neutral uppercase tracking-wide text-[10px]">Archivado</span>
              ) : null}
              <button onClick={() => handleDelete(r.id)}
                className="text-xs text-ink-400 hover:text-danger dark:hover:text-danger-bright px-2 transition-colors"
                title="Eliminar">
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SavedReels;
