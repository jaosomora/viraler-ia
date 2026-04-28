import React, { useState } from 'react';
import Spinner from '../components/Spinner';
import { createSecret } from '../services/secrets';

const SecretsPage = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await createSecret({ title, content });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setContent('');
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const link = result ? `${window.location.origin}/secreto/${result.token}` : '';

  const copy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Secretos
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Comparte credenciales o información sensible de forma segura. El contenido se cifra y solo el destinatario puede verlo. Caduca a los 30 días.
        </p>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Accesos WordPress mi-sitio.com"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Contenido *</label>
            <textarea
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
              maxLength={50000}
              placeholder={'Escribe aquí lo que quieras compartir:\n\n- URL: https://...\n- Usuario: ...\n- Contraseña: ...\n- Notas: 2FA, etc.'}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{content.length} / 50000 caracteres</p>
          </div>

          {error && (
            <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center"
          >
            {loading ? <Spinner /> : 'Crear secreto'}
          </button>
        </form>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🔒</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Secreto creado</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Comparte este link con el destinatario. Caduca el {new Date(result.expiresAt).toLocaleDateString()}.
            </p>
          </div>

          <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded font-mono text-sm break-all select-all border border-gray-200 dark:border-gray-700">
            {link}
          </div>

          <div className="flex gap-2">
            <button
              onClick={copy}
              className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            <button
              onClick={handleReset}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Crear otro
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsPage;
