import React from 'react';
import { Link } from 'react-router-dom';
import Wordmark from './Wordmark';

const FOOTER_LINKS = [
  { to: '/transcribir', label: 'Transcribir' },
  { to: '/clips', label: 'Clips' },
  { to: '/reels-cleaner', label: 'Reels Cleaner' },
  { to: '/mapa-de-ideas', label: 'Ideas' },
  { to: '/convertir', label: 'Convertir' },
  { to: '/mis-resultados', label: 'Mis Resultados' },
];

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-16 pt-8 pb-6 border-t border-ink-200 dark:border-ink-700">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <Wordmark size="sm" />

          <nav className="flex flex-wrap justify-center gap-x-7 gap-y-2">
            {FOOTER_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-sm text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-bright transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-6 pt-6 border-t border-ink-200 dark:border-ink-700 text-center text-sm text-ink-400 dark:text-ink-500">
          <p>&copy; {currentYear} Algo Sentido. Herramientas del estudio, hechas a nuestra manera.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
