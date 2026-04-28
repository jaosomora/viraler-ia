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
      <div className="max-w-2xl mx-auto bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-6 rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 space-y-4">
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {data.title || 'Secreto'}
          </h1>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-x-3">
            {data.creator && <span>De: {data.creator.name} ({data.creator.email})</span>}
            <span>Creado: {new Date(data.createdAt).toLocaleString()}</span>
            <span>Caduca: {new Date(data.expiresAt).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 dark:text-gray-200 font-mono">{data.content}</pre>
        </div>

        <button
          onClick={copy}
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          {copied ? '✓ Copiado' : 'Copiar contenido'}
        </button>
      </div>
    </div>
  );
};

export default ViewSecretPage;
