import React, { useState, useEffect } from 'react';
import Spinner from './Spinner';
import {
  createDelivery,
  listDeliveries,
  revealDelivery,
  deleteDelivery
} from '../services/secrets';

const StatusBadge = ({ delivery }) => {
  if (delivery.readAt) {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Leído</span>;
  }
  if (delivery.submittedAt) {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">Recibido</span>;
  }
  if (new Date(delivery.expiresAt) < new Date()) {
    return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">Expirado</span>;
  }
  return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">Pendiente</span>;
};

const CopyField = ({ label, value, mono = false }) => {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <div className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded text-sm break-all ${mono ? 'font-mono' : ''}`}>
          {value}
        </div>
        <button
          onClick={copy}
          className="px-3 py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded"
        >
          {copied ? '✓' : 'Copiar'}
        </button>
      </div>
    </div>
  );
};

const SecretsAdmin = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);

  const [revealing, setRevealing] = useState(null);
  const [revealData, setRevealData] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setDeliveries(await listDeliveries());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!clientName.trim()) return;
    setCreating(true);
    try {
      const result = await createDelivery({ clientName, description });
      const link = `${window.location.origin}/entrega/${result.token}`;
      setCreatedLink(link);
      setClientName('');
      setDescription('');
      await fetchAll();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleReveal = async (id) => {
    setRevealing(id);
    try {
      const data = await revealDelivery(id);
      setRevealData(data);
    } catch (e) {
      setError(e.message);
      setRevealing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este sobre? Los datos se borrarán.')) return;
    try {
      await deleteDelivery(id);
      await fetchAll();
    } catch (e) {
      setError(e.message);
    }
  };

  const closeReveal = () => {
    setRevealing(null);
    setRevealData(null);
    fetchAll();
  };

  const closeCreated = () => {
    setCreatedLink(null);
    setShowCreate(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Sobres de credenciales</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Genera un link único para que un cliente te entregue accesos cifrados.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          + Crear sobre
        </button>
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
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cliente</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Descripción</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estado</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Creado</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {deliveries.map(d => (
                <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-6 text-sm font-medium text-gray-900 dark:text-white">{d.clientName}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300 max-w-xs truncate">{d.description || '—'}</td>
                  <td className="py-3 px-6"><StatusBadge delivery={d} /></td>
                  <td className="py-3 px-6 text-xs text-gray-500 dark:text-gray-400">{new Date(d.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-6 text-sm space-x-3">
                    {!d.submittedAt && (
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/entrega/${d.token}`;
                          navigator.clipboard.writeText(link);
                        }}
                        className="text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Copiar link
                      </button>
                    )}
                    {d.submittedAt && (
                      <button
                        onClick={() => handleReveal(d.id)}
                        className="text-green-600 dark:text-green-400 hover:underline"
                      >
                        Ver
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="text-red-600 dark:text-red-400 hover:underline"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr><td colSpan="5" className="py-6 px-6 text-sm text-center text-gray-500 dark:text-gray-400">No hay sobres todavía</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal crear */}
      {showCreate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl">
            {!createdLink ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Nuevo sobre</h3>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Cliente *</label>
                  <input
                    type="text"
                    required
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="Ej: Juan Pérez - Empresa X"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Descripción (opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ej: Accesos WordPress + Analytics"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">Cancelar</button>
                  <button type="submit" disabled={creating} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50">
                    {creating ? 'Creando...' : 'Crear'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Link generado</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Compártelo con el cliente. Caduca en 30 días y solo se puede usar una vez.</p>
                <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded font-mono text-xs break-all select-all">
                  {createdLink}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(createdLink)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300"
                  >
                    Copiar
                  </button>
                  <button onClick={closeCreated} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Cerrar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal revelar */}
      {revealing && revealData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">{revealData.clientName}</h3>
                {revealData.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{revealData.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Enviado: {new Date(revealData.submittedAt).toLocaleString()}</p>
              </div>
              <button onClick={closeReveal} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl">×</button>
            </div>

            <div className="space-y-6">
              {revealData.items.map((it, i) => (
                <div key={it.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {it.serviceName || `Credencial #${i + 1}`}
                  </h4>
                  <CopyField label="URL" value={it.url} />
                  <CopyField label="Usuario" value={it.username} />
                  <CopyField label="Contraseña" value={it.password} mono />
                  {it.notes && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas</div>
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded text-sm whitespace-pre-wrap">{it.notes}</div>
                    </div>
                  )}
                </div>
              ))}

              {revealData.globalNotes && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas generales</div>
                  <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{revealData.globalNotes}</div>
                </div>
              )}

              {revealData.items.length === 0 && !revealData.globalNotes && (
                <p className="text-sm text-gray-500 text-center py-4">Sin contenido</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { handleDelete(revealData.id); closeReveal(); }}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Eliminar sobre
              </button>
              <button onClick={closeReveal} className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsAdmin;
