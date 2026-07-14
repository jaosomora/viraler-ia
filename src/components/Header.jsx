import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Wordmark from './Wordmark';

const NAV_LINKS = [
  { to: '/transcribir', label: 'Transcribir' },
  { to: '/clips', label: 'Clips' },
  { to: '/reels-cleaner', label: 'Reels Cleaner' },
  { to: '/mapa-de-ideas', label: 'Ideas' },
  { to: '/convertir', label: 'Convertir' },
  { to: '/mis-resultados', label: 'Mis Resultados' },
];

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  // Dark-first: oscuro salvo que el usuario haya elegido claro explícitamente
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('darkMode') !== 'false'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, isOwner, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('darkMode', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const isActive = (path) => location.pathname === path;

  const desktopLinkClass = (path) =>
    `text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-accent dark:text-accent-bright'
        : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
    }`;

  const mobileLinkClass = (path) =>
    `block py-2 px-4 rounded-xl text-sm font-medium transition-colors ${
      isActive(path)
        ? 'bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright'
        : 'text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'
    }`;

  const themeIcon = isDarkMode ? (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ) : (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-ink-50/85 dark:bg-ink-950/85 backdrop-blur-lg border-b border-ink-200 dark:border-ink-700'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Wordmark */}
          <Link to="/" aria-label="Ir al inicio" className="shrink-0">
            <Wordmark size="md" />
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ to, label }) => (
              <Link key={to} to={to} className={desktopLinkClass(to)}>
                {label}
              </Link>
            ))}
            {isOwner && (
              <Link to="/admin" className={desktopLinkClass('/admin')}>
                Admin
              </Link>
            )}
            <span className="text-sm text-ink-400 dark:text-ink-500">{user?.name}</span>
            <button
              onClick={logout}
              className="text-sm font-medium text-ink-500 dark:text-ink-400 hover:text-danger dark:hover:text-danger-bright transition-colors"
            >
              Salir
            </button>
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Cambiar tema"
            >
              {themeIcon}
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-full text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-label="Cambiar tema"
            >
              {themeIcon}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-full text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
              aria-expanded={isMobileMenuOpen}
              aria-label="Abrir menú"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <nav className="md:hidden pt-4 pb-2 space-y-1">
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileLinkClass(to)}
              >
                {label}
              </Link>
            ))}
            {isOwner && (
              <Link
                to="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={mobileLinkClass('/admin')}
              >
                Admin
              </Link>
            )}
            <div className="border-t border-ink-200 dark:border-ink-700 mt-2 pt-3 px-4 flex items-center justify-between">
              <p className="text-sm text-ink-400 dark:text-ink-500">{user?.name}</p>
              <button
                onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                className="text-sm font-medium text-ink-500 dark:text-ink-400 hover:text-danger dark:hover:text-danger-bright transition-colors"
              >
                Cerrar sesión
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
