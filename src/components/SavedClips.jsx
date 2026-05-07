import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useClips } from '../context/ClipsContext';

const SavedClips = () => {
  const { jobs, loadJobs, deleteJob, setActiveJobId } = useClips();

  useEffect(() => { loadJobs(); }, [loadJobs]);

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-sm">Aún no tienes jobs de clips.</p>
        <Link to="/clips" className="inline-block mt-3 text-purple-600 dark:text-purple-400 text-sm font-medium">Generar mi primer job →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto w-full space-y-3">
      {jobs.map(j => (
        <div key={j.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{j.title || j.source_url || 'Sin título'}</div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded ${j.status === 'done' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : j.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                {j.status}
              </span>
              <span>{j.clip_count || 0} clips</span>
              <span>·</span>
              <span>${(j.total_cost_usd || 0).toFixed(4)}</span>
              <span>·</span>
              <span>{new Date(j.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
          <Link to="/clips" onClick={() => setActiveJobId(j.id)}
            className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium">
            Ver
          </Link>
          <button onClick={() => { if (confirm('¿Eliminar job y todos sus clips?')) deleteJob(j.id); }}
            className="text-xs px-2 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default SavedClips;
