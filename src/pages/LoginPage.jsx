import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const { login, register, requestMagicLink } = useAuth();

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setMagicSent(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else if (mode === 'magic') {
        await requestMagicLink(email);
        setMagicSent(true);
      } else {
        if (!name.trim()) {
          setError('El nombre es requerido');
          setIsSubmitting(false);
          return;
        }
        await register(name, email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
            AS
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Algo Sentido Tools
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Registrate para usar las herramientas de Algo Sentido. Tus transcripciones, conversiones y secretos quedan asociados a tu cuenta y disponibles desde cualquier dispositivo.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          {/* Tabs */}
          <div className="flex mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition ${
                mode === 'login'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Iniciar Sesion
            </button>
            <button
              type="button"
              onClick={() => switchMode('magic')}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition ${
                mode === 'magic'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-sm font-medium text-center border-b-2 transition ${
                mode === 'register'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Registrarse
            </button>
          </div>

          {magicSent ? (
            <div className="space-y-3 text-center">
              <div className="text-4xl">📧</div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Revisa tu correo</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Si tu email está registrado, te enviamos un link para entrar. Caduca en 15 minutos.
              </p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
              >
                Volver
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isSubmitting}
                required
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contrasena
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimo 6 caracteres"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  disabled={isSubmitting}
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === 'magic' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Te enviaremos un link para entrar sin contraseña. Útil si la olvidaste.
              </p>
            )}

            {error && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition duration-300 disabled:opacity-70"
            >
              {isSubmitting
                ? 'Procesando...'
                : mode === 'login'
                  ? 'Iniciar Sesion'
                  : mode === 'magic'
                    ? 'Enviar link'
                    : 'Crear Cuenta'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
