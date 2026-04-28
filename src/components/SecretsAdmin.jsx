import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';
import { listSecrets, revealSecret, deleteSecret } from '../services/secrets';

const SecretsAdmin = () => {
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [copied, setCopied] = useState(false);

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
    if (!confirm('¿Eliminar este secreto?')) return;
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
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Secretos recibidos</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Todos los secretos creados por usuarios. Caducan automáticamente a los 30 días.
        </p>
      </div>

      {error && (
        <div className="m-6 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 flex justify-center"><Spinner /></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Título</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Creador</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Creado</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Caduca</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {secrets.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-6 text-sm font-medium text-gray-900 dark:text-white max-w-xs truncate">{s.title || '(sin título)'}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{s.creator?.email || '—'}</td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {s.readAt ? (
                      <span className="inline-block whitespace-nowrap px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Leído</span>
                    ) : (
                      <span className="inline-block whitespace-nowrap px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Sin leer</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-6 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(s.expiresAt).toLocaleDateString()}</td>
                  <td className="py-3 px-6 text-sm whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleView(s.token)} className="text-purple-600 dark:text-purple-400 hover:underline">Ver</button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-600 dark:text-red-400 hover:underline">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {secrets.length === 0 && (
                <tr><td colSpan="6" className="py-6 px-6 text-sm text-center text-gray-500 dark:text-gray-400">Aún no hay secretos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{viewing.title || 'Secreto'}</h3>
                {viewing.creator && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">De: {viewing.creator.name} ({viewing.creator.email})</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">Creado: {new Date(viewing.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={close} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl">×</button>
            </div>
            <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700 whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200 font-mono">{viewing.content}</pre>
            <div className="flex gap-2 mt-4">
              <button onClick={copy} className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg">
                {copied ? '✓ Copiado' : 'Copiar contenido'}
              </button>
              <button onClick={close} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsAdmin;
