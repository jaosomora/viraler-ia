import React, { useEffect, useState } from 'react';
import { useClips } from '../context/ClipsContext';
import { useConfirm } from './ui/feedback';

// Banner del job en proceso. Lee stage_index del backend pero también rota copy creativo
// localmente para no quedarse estático entre transiciones reales del worker.
const JobProgress = ({ job }) => {
  const { stages, loadStages, deleteJob, reopenForSelection } = useClips();
  const confirmDialog = useConfirm();
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
    <div className={`card p-4 flex items-center gap-4 ${isError
      ? 'border-danger/40 dark:border-danger-bright/40 bg-danger-soft/40 dark:bg-danger-deep/40'
      : ''}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xl ${isError ? 'bg-danger-soft dark:bg-danger-deep' : 'bg-ink-100 dark:bg-ink-800'}`}>
        {isError ? '⚠️' : stage.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">
          {job.title || 'Procesando video…'}
        </div>
        {isError ? (
          <div className="text-xs text-danger dark:text-danger-bright mt-0.5">
            {job.error_message || 'Error al procesar'}
          </div>
        ) : (
          <div className="mt-0.5 flex items-center justify-between gap-3">
            <span className="font-mono text-xs tabular-nums text-ink-500 dark:text-ink-400 truncate">{stage.msg}</span>
            <span className="font-mono text-xs tabular-nums text-ink-500 dark:text-ink-400 shrink-0">{stage.percent || 0}%</span>
          </div>
        )}
        {!isError && (
          <div className="mt-2 h-1.5 bg-ink-200 dark:bg-ink-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent dark:bg-accent-bright transition-all duration-500"
              style={{ width: `${stage.percent || 0}%` }}
            />
          </div>
        )}
        {recoverError && (
          <div className="mt-2 text-xs text-danger dark:text-danger-bright">{recoverError}</div>
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
          className="btn btn-ghost btn-sm shrink-0"
        >
          {recovering ? 'Recuperando…' : '↺ Recuperar'}
        </button>
      )}
      <button
        onClick={async () => { if (await confirmDialog({ title: '¿Eliminar este job?', danger: true })) deleteJob(job.id); }}
        className="text-xs text-ink-400 dark:text-ink-500 hover:text-danger dark:hover:text-danger-bright transition-colors shrink-0 px-2 py-1"
      >
        {isError ? 'Eliminar' : 'Cancelar'}
      </button>
    </div>
  );
};

export default JobProgress;
