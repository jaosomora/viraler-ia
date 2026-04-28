import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Spinner from '../components/Spinner';
import { getPublicDelivery, submitPublicDelivery } from '../services/secrets';

const emptyItem = () => ({ serviceName: '', url: '', username: '', password: '', notes: '' });

const DeliverSecretsPage = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([emptyItem()]);
  const [globalNotes, setGlobalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getPublicDelivery(token)
      .then(setInfo)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitPublicDelivery(token, { items, globalNotes });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">Link no disponible</h1>
          <p className="text-gray-600 dark:text-gray-300">{error}</p>
        </div>
      </div>
    );
  }

  if (info?.submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Este link ya fue utilizado</h1>
          <p className="text-gray-600 dark:text-gray-300">Las credenciales ya fueron enviadas. Si necesitas enviar más, pide un nuevo link.</p>
        </div>
      </div>
    );
  }

  if (info?.expired) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Link expirado</h1>
          <p className="text-gray-600 dark:text-gray-300">Este link ha caducado. Pide uno nuevo.</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md text-center">
          <div className="text-5xl mb-3">✓</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">¡Recibido!</h1>
          <p className="text-gray-600 dark:text-gray-300">Las credenciales fueron enviadas de forma segura. Puedes cerrar esta ventana.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Entrega segura de credenciales
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Hola <strong>{info.clientName}</strong>. Por favor escribe abajo los accesos que necesitas compartir. La información se cifra al guardarse y solo el destinatario puede verla.
          </p>
          {info.description && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">{info.description}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {items.map((it, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900 dark:text-white">Credencial #{idx + 1}</h3>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    Eliminar
                  </button>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servicio o nombre</label>
                <input
                  type="text"
                  value={it.serviceName}
                  onChange={e => updateItem(idx, 'serviceName', e.target.value)}
                  placeholder="Ej: WordPress admin, Google Analytics, Hosting cPanel..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                <input
                  type="text"
                  value={it.url}
                  onChange={e => updateItem(idx, 'url', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Usuario / email</label>
                  <input
                    type="text"
                    value={it.username}
                    onChange={e => updateItem(idx, 'username', e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contraseña</label>
                  <input
                    type="text"
                    value={it.password}
                    onChange={e => updateItem(idx, 'password', e.target.value)}
                    autoComplete="off"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas (opcional)</label>
                <textarea
                  value={it.notes}
                  onChange={e => updateItem(idx, 'notes', e.target.value)}
                  rows={2}
                  placeholder="2FA, instrucciones especiales, etc."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400"
          >
            + Añadir otra credencial
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notas generales (opcional)</label>
            <textarea
              value={globalNotes}
              onChange={e => setGlobalNotes(e.target.value)}
              rows={3}
              placeholder="Cualquier otra información que quieras enviar"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
          >
            {submitting ? <Spinner /> : 'Enviar de forma segura'}
          </button>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Una vez enviado, este link queda invalidado.
          </p>
        </form>
      </div>
    </div>
  );
};

export default DeliverSecretsPage;
