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
      <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Link no válido</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="xl" />
    </div>
  );
};

export default MagicLinkPage;
