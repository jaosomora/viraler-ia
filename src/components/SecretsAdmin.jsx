import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';
import { useConfirm } from './ui/feedback';
import { listSecrets, revealSecret, deleteSecret } from '../services/secrets';

const SecretsAdmin = () => {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [copied, setCopied] = useState(false);
  const confirmDialog = useConfirm();

  const fetchAll = async () => {
    try {
      setLoading(true);
      setSecrets(await listSecrets());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleView = async (token) => {
    try {
      const data = await revealSecret(token);
      setViewing(data);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog({ title: '¿Eliminar este secreto?', danger: true }))) return;
    try {
      await deleteSecret(id);
      await fetchAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const close = () => {
    setViewing(null);
    setCopied(false);
    fetchAll();
  };

  const copy = () => {
    navigator.clipboard.writeText(viewing.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="card overflow-hidden">
      <div className="p-6 border-b border-ink-200 dark:border-ink-700">
        <h2 className="font-display text-xl font-semibold tracking-tight">Secretos recibidos</h2>
        <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
          Todos los secretos creados por usuarios. Caducan automáticamente a los 30 días.
        </p>
      </div>

      {error && (
        <div className="m-6 bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright p-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-700">
              <tr>
                <th className="py-3 px-6 text-left font-semibold">Título</th>
                <th className="py-3 px-6 text-left font-semibold">Creador</th>
                <th className="py-3 px-6 text-left font-semibold">Estado</th>
                <th className="py-3 px-6 text-left font-semibold">Creado</th>
                <th className="py-3 px-6 text-left font-semibold">Caduca</th>
                <th className="py-3 px-6 text-left font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {secrets.map(s => (
                <tr key={s.id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                  <td className="py-3 px-6 text-sm font-medium text-ink-950 dark:text-paper max-w-xs truncate">{s.title || '(sin título)'}</td>
                  <td className="py-3 px-6 text-sm text-ink-500 dark:text-ink-400">{s.creator?.email || '—'}</td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {s.readAt ? (
                      <span className="chip chip-neutral">Leído</span>
                    ) : (
                      <span className="chip chip-warn">Sin leer</span>
                    )}
                  </td>
                  <td className="py-3 px-6 font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-6 font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{new Date(s.expiresAt).toLocaleDateString()}</td>
                  <td className="py-3 px-6 text-sm whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleView(s.token)} className="link-accent font-medium">Ver</button>
                      <button onClick={() => handleDelete(s.id)} className="text-danger dark:text-danger-bright hover:underline underline-offset-2">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {secrets.length === 0 && (
                <tr><td colSpan="6" className="py-6 px-6 text-sm text-center text-ink-500 dark:text-ink-400">Aún no hay secretos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-display text-lg font-semibold tracking-tight">{viewing.title || 'Secreto'}</h3>
                {viewing.creator && (
                  <p className="text-xs text-ink-500 dark:text-ink-400">De: {viewing.creator.name} ({viewing.creator.email})</p>
                )}
                <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">Creado: {new Date(viewing.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={close} className="text-ink-400 hover:text-ink-950 dark:hover:text-paper transition-colors text-xl">×</button>
            </div>
            <pre className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700 whitespace-pre-wrap break-words text-sm text-ink-950 dark:text-paper font-mono">{viewing.content}</pre>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={close} className="btn btn-ghost">Cerrar</button>
              <button onClick={copy} className="btn btn-accent">
                {copied ? '✓ Copiado' : 'Copiar contenido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsAdmin;
