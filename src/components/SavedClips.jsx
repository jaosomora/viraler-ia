import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClips } from '../context/ClipsContext';
import { useConfirm } from './ui/feedback';

const statusChip = (status) => {
  if (status === 'done') return 'chip chip-ok';
  if (status === 'error') return 'chip chip-danger';
  return 'chip chip-warn';
};

const SavedClips = () => {
  const { jobs, loadJobs, deleteJob, setActiveJobId } = useClips();
  const confirmDialog = useConfirm();

  useEffect(() => { loadJobs(); }, [loadJobs]);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <span className="eyebrow">Tus clips</span>
        <p className="text-sm text-ink-500 dark:text-ink-400">Aún no has generado clips.</p>
        <Link to="/clips" className="btn btn-ghost btn-sm">Generar mis primeros clips →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-3">
      {jobs.map(j => (
        <div key={j.id} className="card p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">{j.title || j.source_url || 'Sin título'}</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1 flex items-center gap-2 flex-wrap">
              <span className={statusChip(j.status)}>
                {j.status}
              </span>
              <span>{j.clip_count || 0} clips</span>
              <span>·</span>
              <span className="font-mono tabular-nums">${(j.total_cost_usd || 0).toFixed(4)}</span>
              <span>·</span>
              <span>{new Date(j.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            {j.status === 'error' && j.error_message && (
              <p className="text-xs text-danger dark:text-danger-bright mt-1.5">{j.error_message}</p>
            )}
          </div>
          <Link to="/clips" onClick={() => setActiveJobId(j.id)}
            className="btn btn-ghost btn-sm shrink-0">
            Ver →
          </Link>
          <button onClick={async () => { if (await confirmDialog({ title: '¿Eliminar job y todos sus clips?', danger: true })) deleteJob(j.id); }}
            className="text-xs px-2 py-1.5 text-ink-400 dark:text-ink-500 hover:text-danger dark:hover:text-danger-bright transition-colors shrink-0">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default SavedClips;
