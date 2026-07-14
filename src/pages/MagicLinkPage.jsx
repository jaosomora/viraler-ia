import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

// Guard global por token para que StrictMode (doble mount en dev) no consuma
// el link dos veces y haga ver "ya utilizado" tras un consumo válido.
const consumedTokens = new Set();

const MagicLinkPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { loginWithMagicLink } = useAuth();
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    if (consumedTokens.has(token)) return;
    startedRef.current = true;
    consumedTokens.add(token);

    loginWithMagicLink(token)
      .then(() => navigate('/', { replace: true }))
      .catch(err => setError(err.message));
  }, [token, loginWithMagicLink, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card p-8 max-w-md w-full text-center flex flex-col items-center gap-3">
          <span className="chip chip-danger">Link no válido</span>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Este acceso ya no funciona
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="btn btn-accent mt-3"
          >
            Volver al inicio →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Spinner size="xl" />
      <p className="text-sm text-ink-500 dark:text-ink-400">Validando tu acceso…</p>
    </div>
  );
};

export default MagicLinkPage;
