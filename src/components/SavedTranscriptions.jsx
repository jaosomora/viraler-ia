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
        <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">No tienes transcripciones guardadas</h3>
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

  // Renderizar icono de plataforma mejorado
  const renderPlatformIcon = (platform) => {
    switch (platform) {
      case 'instagram':
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <linearGradient id="instagramGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#FFDC80" />
                <stop offset="12.5%" stopColor="#FCAF45" />
                <stop offset="25%" stopColor="#F77737" />
                <stop offset="37.5%" stopColor="#F56040" />
                <stop offset="50%" stopColor="#FD1D1D" />
                <stop offset="62.5%" stopColor="#E1306C" />
                <stop offset="75%" stopColor="#C13584" />
                <stop offset="87.5%" stopColor="#833AB4" />
                <stop offset="100%" stopColor="#5851DB" />
              </linearGradient>
              <path 
                fill="url(#instagramGradient)" 
                d="M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153.509.5.902 1.105 1.153 1.772.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122 0 2.717-.01 3.056-.06 4.122-.05 1.065-.218 1.79-.465 2.428a4.883 4.883 0 01-1.153 1.772c-.5.508-1.105.902-1.772 1.153-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06-2.717 0-3.056-.01-4.122-.06-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 01-1.772-1.153 4.904 4.904 0 01-1.153-1.772c-.247-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12c0-2.717.01-3.056.06-4.122.05-1.066.218-1.79.465-2.428a4.88 4.88 0 011.153-1.772A4.897 4.897 0 015.45 2.525c.638-.247 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2zm0 1.802c-2.67 0-2.987.01-4.04.059-.976.045-1.505.207-1.858.344-.466.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.048 1.053-.059 1.37-.059 4.04 0 2.672.01 2.988.059 4.042.044.976.207 1.504.344 1.856.182.466.399.8.748 1.15.35.35.684.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.059 4.04.059 2.672 0 2.988-.01 4.042-.059.976-.044 1.504-.207 1.856-.344.466-.182.8-.398 1.15-.748.35-.35.566-.684.748-1.15.137-.352.3-.88.344-1.856.048-1.054.059-1.37.059-4.041 0-2.67-.01-2.987-.059-4.04-.044-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.352-.137-.88-.3-1.856-.344-1.054-.048-1.37-.059-4.041-.059zm0 3.063A5.135 5.135 0 1 1 12 17.135 5.135 5.135 0 0 1 12 6.865zm0 8.468A3.333 3.333 0 1 0 12 8.667a3.333 3.333 0 0 0 0 6.666zm6.538-8.669a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z"
              />
            </svg>
          </div>
        );
      case 'tiktok':
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path 
                d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .6.04.88.12V9.4c-.3-.03-.6-.07-.88-.07a6.25 6.25 0 1 0 0 12.5 6.18 6.18 0 0 0 6.24-6.07V9.8a8.16 8.16 0 0 0 5.06 1.73v-3.62c-.47.02-.91.02-1.19-.02z" 
                fill="#000000"
                className="dark:fill-white"
              />
            </svg>
          </div>
        );
      case 'youtube':
      case 'youtube-shorts':
        return (
          <div className="w-8 h-8 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-full h-full">
              <path 
                fill="#FF0000" 
                d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.13C19.54 3.47 12 3.47 12 3.47s-7.54 0-9.38.59a3.02 3.02 0 0 0-2.12 2.13C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.13c1.84.59 9.38.59 9.38.59s7.54 0 9.38-.59a3.02 3.02 0 0 0 2.12-2.13C24 15.97 24 12 24 12s0-3.97-.5-5.81z"
              />
              <path 
                fill="#FFFFFF" 
                d="M9.6 15.6V8.4l6.4 3.6-6.4 3.6z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-full">
            <svg className="h-4 w-4 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="currentColor">
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
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
              <li key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30 transition">
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Confirmar eliminación</h3>
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