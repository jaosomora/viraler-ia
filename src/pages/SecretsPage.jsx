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
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Secretos</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          De credencial a link seguro
        </h1>
        <p className="text-ink-500 dark:text-ink-400">
          Comparte credenciales o información sensible de forma segura. El contenido se cifra y solo el destinatario puede verlo. Caduca a los 30 días.
        </p>
      </div>

      {!result ? (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="form-label">Título (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Accesos WordPress mi-sitio.com"
              maxLength={200}
              className="input"
            />
          </div>

          <div>
            <label className="form-label">Contenido *</label>
            <textarea
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={14}
              maxLength={50000}
              placeholder={'Escribe aquí lo que quieras compartir:\n\n- URL: https://...\n- Usuario: ...\n- Contraseña: ...\n- Notas: 2FA, etc.'}
              className="input font-mono text-sm"
            />
            <p className="text-xs text-ink-400 dark:text-ink-500 mt-1.5 font-mono tabular-nums">{content.length} / 50000 caracteres</p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
              <p className="text-danger dark:text-danger-bright text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !content.trim()}
            className="btn btn-accent w-full"
          >
            {loading ? <Spinner /> : 'Crear secreto →'}
          </button>
        </form>
      ) : (
        <div className="card p-6 space-y-4">
          <div className="text-center flex flex-col items-center gap-2 pt-2">
            <span className="eyebrow">Cifrado y listo</span>
            <h2 className="font-display text-xl font-semibold tracking-tight">Secreto creado</h2>
            <p className="text-sm text-ink-500 dark:text-ink-400">
              Comparte este link con el destinatario. Caduca el {new Date(result.expiresAt).toLocaleDateString()}.
            </p>
          </div>

          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl font-mono text-sm break-all select-all border border-ink-200 dark:border-ink-700">
            {link}
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={copy} className="btn btn-ghost btn-sm">
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            <button onClick={handleReset} className="btn btn-ghost btn-sm">
              Crear otro →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsPage;
