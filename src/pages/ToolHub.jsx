import React from 'react';
import { Link } from 'react-router-dom';

const tools = [
  {
    name: 'Transcribir',
    tagline: 'De video a texto',
    description: 'YouTube, Instagram, TikTok, Facebook o un archivo tuyo. Con ficha del video y análisis de ideas.',
    path: '/transcribir',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'AS Clips',
    tagline: 'De charla a clips',
    description: 'Videos largos convertidos en clips verticales con subtítulos estilo IG y copy sugerido.',
    path: '/clips',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    name: 'Reels Cleaner',
    tagline: 'De toma cruda a reel',
    description: 'Detectamos los silencios, tú decides qué cortar, y entregamos el reel limpio con subtítulos quemados.',
    path: '/reels-cleaner',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" />
      </svg>
    ),
  },
  {
    name: 'Ideas',
    tagline: 'De tema a frases',
    description: 'Ideas que suenan a ti, no a cualquier creador. Frases crudas con torsión para tu vida o tu negocio.',
    path: '/mapa-de-ideas',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    name: 'Convertir',
    tagline: 'De documento a Markdown',
    description: 'PDF, DOCX, PPTX, XLSX y EPUB convertidos a Markdown o HTML listo para usar.',
    path: '/convertir',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Secretos',
    tagline: 'De credencial a link seguro',
    description: 'Comparte información sensible con un link cifrado de un solo dueño. Caduca en 30 días.',
    path: '/secretos',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

const ToolHub = () => {
  return (
    <div className="flex flex-col gap-10 py-4">
      <div className="text-center flex flex-col items-center gap-3">
        <span className="eyebrow">Tu estudio de contenido</span>
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight">
          ¿Qué vas a crear hoy?
        </h1>
        <p className="text-lg text-ink-500 dark:text-ink-400">
          Seis herramientas. Cero ruido.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto w-full">
        {tools.map((tool, i) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="group card p-6 flex flex-col transition-colors hover:border-accent/50 dark:hover:border-accent-bright/50"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="inline-flex p-2.5 rounded-xl bg-ink-100 dark:bg-ink-800 text-accent dark:text-accent-bright">
                {tool.icon}
              </div>
              <span className="font-mono text-xs text-ink-300 dark:text-ink-600 tracking-widest">
                {String(i + 1).padStart(2, '0')}
              </span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-400 dark:text-ink-500">
              {tool.name}
            </p>
            <h2 className="font-display text-lg font-semibold tracking-tight mt-1">
              {tool.tagline}
            </h2>
            <p className="text-sm text-ink-500 dark:text-ink-400 mt-2 flex-grow">
              {tool.description}
            </p>
            <div className="mt-5 flex items-center gap-1 text-sm font-semibold text-accent dark:text-accent-bright">
              <span>Abrir</span>
              <span className="transition-transform group-hover:translate-x-1">→</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ToolHub;
