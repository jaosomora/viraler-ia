import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listReelJobs, deleteReelJob, downloadUrl } from '../services/reelsApi';

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
    if (!confirm('¿Eliminar este reel? Se borran los archivos del disco.')) return;
    try { await deleteReelJob(id); load(); }
    catch (e) { alert(e.message); }
  };

  if (loading) return <div className="text-center text-gray-500 py-8">Cargando…</div>;

  if (reels.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="mb-3">Aún no has limpiado ningún reel.</p>
        <Link to="/reels-cleaner" className="text-amber-700 hover:text-amber-800 underline">
          Ir a Reels Cleaner →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reels.map(r => (
        <div key={r.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <Link to="/reels-cleaner" className="font-semibold text-gray-900 dark:text-white hover:text-amber-700 truncate block">
                {r.title || r.source_filename || 'Sin título'}
              </Link>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                <span>{statusLabel(r.status)}</span>
                {r.duration_seconds && (
                  <span>
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
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{r.error_message}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {r.status === 'done' && !r.files_purged && (
                <a href={downloadUrl(r.id)} className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium">
                  Descargar
                </a>
              )}
              {r.files_purged ? (
                <span className="px-2 py-1 text-[10px] uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-gray-700 rounded">Archivado</span>
              ) : null}
              <button onClick={() => handleDelete(r.id)}
                className="text-xs text-gray-400 hover:text-rose-600 px-2"
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
