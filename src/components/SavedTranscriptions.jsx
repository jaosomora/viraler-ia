import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import { formatDate, truncateText } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const SavedTranscriptions = () => {
  const { savedTranscriptions, deleteTranscription, setCurrentTranscription } = useTranscriptionContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

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
    const matchesTerm = item.text?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      item.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      item.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = selectedPlatform === 'all' || item.platform === selectedPlatform;
    
    return matchesTerm && matchesPlatform;
  });

  const handleSelect = (transcription) => {
    setCurrentTranscription(transcription);
    navigate('/');
  };

  const handleDeleteClick = (id) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteTranscription(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
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
      {/* Filtros y búsqueda */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar
            </label>
            <input
              id="search"
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Buscar por texto o URL..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="platform" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Plataforma
            </label>
            <select
              id="platform"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="youtube-shorts">YouTube Shorts</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de transcripciones */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium">
            Transcripciones guardadas ({filteredTranscriptions.length})
          </h3>
        </div>

        {filteredTranscriptions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No se encontraron transcripciones con los filtros aplicados
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTranscriptions.map((item) => (
              <li key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {renderPlatformIcon(item.platform)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        {item.title || 'Sin título'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 break-all">
                        {item.url}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {truncateText(item.text, 120)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center ml-4 space-x-2">
                    <button
                      onClick={() => handleSelect(item)}
                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                      title="Ver transcripción"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                      title="Eliminar transcripción"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {item.createdAt ? formatDate(item.createdAt) : 'Fecha desconocida'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar esta transcripción? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedTranscriptions;
