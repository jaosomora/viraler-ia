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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Resto del código del return... */}
    </div>
  );
};

export default SavedTranscriptions;