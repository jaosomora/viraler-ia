import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { revealSecret } from '../services/secrets';

const ViewSecretPage = () => {
  const { token } = useParams();
  const { isOwner, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isOwner) {
      setError('Solo el administrador puede ver este contenido.');
      setLoading(false);
      return;
    }
    revealSecret(token)
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token, authLoading, isOwner]);

  const copy = () => {
    navigator.clipboard.writeText(data.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (loading || authLoading) {
    return <div className="flex justify-center p-8"><Spinner size="xl" /></div>;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 rounded-2xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="card p-6 space-y-4">
        <div className="border-b border-ink-200 dark:border-ink-700 pb-4 flex flex-col gap-2">
          <span className="eyebrow">Secreto compartido</span>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {data.title || 'Secreto'}
          </h1>
          <div className="text-xs text-ink-500 dark:text-ink-400 space-x-3">
            {data.creator && <span>De: {data.creator.name} ({data.creator.email})</span>}
            <span>Creado: {new Date(data.createdAt).toLocaleString()}</span>
            <span>Caduca: {new Date(data.expiresAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
          <pre className="whitespace-pre-wrap break-words text-sm font-mono">{data.content}</pre>
        </div>

        <div className="flex justify-end">
          <button onClick={copy} className="btn btn-ghost btn-sm">
            {copied ? '✓ Copiado' : 'Copiar contenido'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewSecretPage;
