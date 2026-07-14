import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Wordmark from '../components/Wordmark';

const MODES = [
  { id: 'login', label: 'Iniciar sesión' },
  { id: 'magic', label: 'Magic link' },
  { id: 'register', label: 'Registrarse' },
];

const LoginPage = () => {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('darkMode') !== 'false'
  );
  const { login, register, requestMagicLink } = useAuth();

  const toggleDarkMode = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('darkMode', next);
  };

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
    <div className="min-h-screen flex items-center justify-center px-4 py-10 relative">
      <button
        onClick={toggleDarkMode}
        className="absolute top-5 right-5 p-2 rounded-full text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
        aria-label="Cambiar tema"
      >
        {isDarkMode ? (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ) : (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        )}
      </button>

      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <Wordmark size="lg" />
          <p className="text-ink-500 dark:text-ink-400 text-sm max-w-sm">
            Las herramientas del estudio para crear tu contenido: transcripción, clips,
            reels limpios e ideas con tu voz. Tu trabajo queda en tu cuenta, disponible
            desde cualquier dispositivo.
          </p>
        </div>

        {/* Card */}
        <div className="card p-6">
          {/* Selector de modo */}
          <div className="flex gap-1 mb-6 p-1 rounded-full bg-ink-100 dark:bg-ink-900">
            {MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchMode(id)}
                className={`flex-1 py-1.5 px-2 text-xs sm:text-sm font-semibold text-center rounded-full transition-colors ${
                  mode === id
                    ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {magicSent ? (
            <div className="space-y-3 text-center py-2">
              <span className="eyebrow">Revisa tu correo</span>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                Te enviamos el acceso
              </h2>
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Si tu email está registrado, recibirás un link para entrar. Caduca en 15 minutos.
              </p>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="link-accent text-sm font-medium"
              >
                Volver
              </button>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label htmlFor="name" className="form-label">
                  Nombre
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                  className="input"
                  disabled={isSubmitting}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="form-label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="input"
                disabled={isSubmitting}
                required
              />
            </div>

            {mode !== 'magic' && (
              <div>
                <label htmlFor="password" className="form-label">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="input"
                  disabled={isSubmitting}
                  required
                  minLength={6}
                />
              </div>
            )}

            {mode === 'magic' && (
              <p className="text-sm text-ink-500 dark:text-ink-400">
                Te enviamos un link para entrar sin contraseña. Útil si la olvidaste.
              </p>
            )}

            {error && (
              <div className="p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
                <p className="text-danger dark:text-danger-bright text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-accent w-full"
            >
              {isSubmitting
                ? 'Procesando…'
                : mode === 'login'
                  ? 'Entrar al estudio →'
                  : mode === 'magic'
                    ? 'Enviar link →'
                    : 'Crear cuenta →'}
            </button>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
