import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';

const SavedTranscriptions = () => {
  const { savedTranscriptions, deleteTranscription, setCurrentTranscription } = useTranscriptionContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);

  if (savedTranscriptions.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto text-center p-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <svg 
          className="w-20 h-20 mx-auto text-gray-300 dark:text-gray-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5} 
            d="M19 14v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5m7 7l-5-5m0 0H9m5 0v5" 
          />
        </svg>
        <h3 className="mt-4 text-xl font-semibold">No tienes transcripciones guardadas</h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Las transcripciones que guardes aparecerán aquí para que puedas acceder a ellas en cualquier momento.
        </p>
      </div>
    );
  }

  // Filtrar transcripciones basadas en el término de búsqueda y plataforma seleccionada
  const filteredTranscriptions = savedTranscriptions.filter(item => {
    const matchesTerm = item.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        item.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform;
    
    return matchesTerm && matchesPlatform;
  });

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const handleSelect = (transcription) => {
    setCurrentTranscription(transcription);
    // Navegar a la página principal
    window.location.href = '/';
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold">Mis Transcripciones</h2>
          
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar..."
                className="pl-9 pr-3 py-2 w-full sm:w-64 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            
            <select
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              <option value="all">Todas las plataformas</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="youtube-shorts">YouTube Shorts</option>
            </select>
          </div>
        </div>
        
        {filteredTranscriptions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No se encontraron transcripciones que coincidan con tu búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTranscriptions.map((item) => (
              <div key={item.id} className="py-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {renderPlatformIcon(item.platform)}
                    <div>
                      <h3 className="font-medium">{item.title || "Transcripción sin título"}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handleSelect(item)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Ver transcripción"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    {confirmDelete === item.id ? (
                      <div className="ml-2 flex items-center space-x-1">
                        <button
                          onClick={() => {
                            deleteTranscription(item.id);
                            setConfirmDelete(null);
                          }}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
                          title="Confirmar eliminación"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          title="Cancelar"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(item.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Eliminar transcripción"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="pl-8">
                  <a 
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block"
                  >
                    {item.url}
                  </a>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Renderizar icono de plataforma
  const renderPlatformIcon = (platform) => {
    switch (platform) {
      case 'instagram':
        return (
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069z" />
            </svg>
          </div>
        );
      case 'tiktok':
        return (
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-black dark:bg-white">
            <svg className="h-3.5 w-3.5 text-white dark:text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.298.006.596.045.885.115V9.4a6.13 6.13 0 00-1-.08A6.26 6.26 0 005 20.83a6.26 6.26 0 009.5-5.29V9.71a8.16 8.16 0 005.07 1.56V7.83a4.85 4.85 0 01-.98-.14z" />
            </svg>
          </div>
        );
      case 'youtube':
      case 'youtube-shorts':
        return (
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-red-600">
            <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
            <svg className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.11 0-2 .89-2 2v14c0 1.11.89 2 2 2h14c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          </div>
        );
    }
  };