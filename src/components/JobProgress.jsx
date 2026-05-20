import React, { useEffect, useState } from 'react';
import { useClips } from '../context/ClipsContext';

// Banner del job en proceso. Lee stage_index del backend pero también rota copy creativo
// localmente para no quedarse estático entre transiciones reales del worker.
const JobProgress = ({ job }) => {
  const { stages, loadStages, deleteJob, reopenForSelection } = useClips();
  const [displayIdx, setDisplayIdx] = useState(0);
  const [recovering, setRecovering] = useState(false);
  const [recoverError, setRecoverError] = useState(null);

  useEffect(() => { if (stages.length === 0) loadStages(); }, [stages.length, loadStages]);

  // Rotar mensaje localmente entre etapas reales para que se sienta vivo
  useEffect(() => {
    if (!stages.length) return;
    const realIdx = Math.min(job.stage_index || 0, stages.length - 1);
    setDisplayIdx(realIdx);
  }, [job.stage_index, stages.length]);

  if (!stages.length) return null;
  const stage = stages[displayIdx] || stages[0];
  const isError = job.status === 'error';

  return (
    <div className={`rounded-xl p-4 flex items-center gap-4 border ${isError
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${isError ? 'bg-red-100 dark:bg-red-900/40' : 'bg-gradient-to-br from-purple-500 to-indigo-500 text-white'}`}>
        {isError ? '⚠️' : stage.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {job.title || 'Procesando video…'}
        </div>
        <div className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
          {isError ? (job.error_message || 'Error al procesar') : stage.msg}
        </div>
        {!isError && (
          <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${stage.percent || 0}%` }}
            />
          </div>
        )}
        {recoverError && (
          <div className="mt-2 text-xs text-rose-600 dark:text-rose-400">{recoverError}</div>
        )}
      </div>
      {isError && (
        <button
          disabled={recovering}
          onClick={async () => {
            setRecoverError(null);
            setRecovering(true);
            try {
              await reopenForSelection(job.id);
            } catch (err) {
              setRecoverError(err?.message || 'No se pudo recuperar este job');
            } finally {
              setRecovering(false);
            }
          }}
          title="Vuelve a la selección manual reutilizando el transcript y video (sin re-transcribir)"
          className="text-xs px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg font-medium shrink-0 disabled:opacity-50"
        >
          {recovering ? 'Recuperando…' : '↺ Recuperar'}
        </button>
      )}
      <button
        onClick={() => { if (confirm('¿Eliminar este job?')) deleteJob(job.id); }}
        className="text-xs text-gray-500 hover:text-red-500 shrink-0 px-2 py-1"
      >
        {isError ? 'Eliminar' : 'Cancelar'}
      </button>
    </div>
  );
};

export default JobProgress;
