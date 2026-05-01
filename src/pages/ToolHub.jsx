import React from 'react';
import { Link } from 'react-router-dom';

const tools = [
  {
    name: 'Transcribir Video o Audio',
    description: 'Transcribe videos de YouTube, Instagram, TikTok y Facebook (con opción de descargar el video original), o sube audios (MP3, audios de WhatsApp) y archivos de video locales.',
    path: '/transcribir',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    color: 'from-purple-500 to-indigo-500',
    bgHover: 'hover:border-purple-300 dark:hover:border-purple-700',
  },
  {
    name: 'Convertir Documento',
    description: 'Convierte documentos PDF, DOCX, PPTX, XLSX y EPUB a Markdown o HTML listo para usar.',
    path: '/convertir',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: 'from-emerald-500 to-teal-500',
    bgHover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  {
    name: 'Secretos',
    description: 'Comparte credenciales o información sensible mediante un link cifrado. Caduca en 30 días.',
    path: '/secretos',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    color: 'from-rose-500 to-pink-500',
    bgHover: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
];

const ToolHub = () => {
  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent pb-2">
          Algo Sentido Tools
        </h1>
        <p className="mt-3 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Transcribe videos y audios, convierte documentos y comparte secretos cifrados
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className={`group block bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 border-transparent ${tool.bgHover} transition-all duration-300 hover:shadow-lg p-6`}
          >
            <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${tool.color} text-white mb-4`}>
              {tool.icon}
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
              {tool.name}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {tool.description}
            </p>
            <div className="mt-4 flex items-center text-sm font-medium text-purple-600 dark:text-purple-400">
              <span>Usar herramienta</span>
              <svg className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ToolHub;
