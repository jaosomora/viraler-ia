import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import { formatDate, truncateText } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  'youtube-shorts': 'YouTube Shorts',
  facebook: 'Facebook',
  upload: 'Archivo',
};

const SavedTranscriptions = () => {
  const { savedTranscriptions, deleteTranscription, setCurrentTranscription } = useTranscriptionContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  if (savedTranscriptions.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto card p-8 text-center flex flex-col items-center gap-3">
        <span className="eyebrow">Tus transcripciones</span>
        <h3 className="font-display text-xl font-semibold tracking-tight">
          No tienes transcripciones guardadas
        </h3>
        <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md">
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
    navigate('/transcribir');
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

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Filtros y búsqueda */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search" className="form-label">
              Buscar
            </label>
            <input
              id="search"
              type="text"
              className="input"
              placeholder="Buscar por texto o URL…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="platform" className="form-label">
              Plataforma
            </label>
            <select
              id="platform"
              className="input"
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
            >
              <option value="all">Todas</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
              <option value="youtube-shorts">YouTube Shorts</option>
              <option value="facebook">Facebook</option>
              <option value="upload">Archivo subido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de transcripciones */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-200 dark:border-ink-700">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Transcripciones guardadas{' '}
            <span className="font-mono tabular-nums text-sm font-normal text-ink-400 dark:text-ink-500">
              ({filteredTranscriptions.length})
            </span>
          </h3>
        </div>

        {filteredTranscriptions.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-500 dark:text-ink-400">
            No se encontraron transcripciones con los filtros aplicados
          </div>
        ) : (
          <ul className="divide-y divide-ink-200 dark:divide-ink-700">
            {filteredTranscriptions.map((item) => (
              <li key={item.id} className="p-4 hover:bg-ink-100/60 dark:hover:bg-ink-800/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">
                        {item.title || 'Sin título'}
                      </p>
                      {PLATFORM_LABELS[item.platform] && (
                        <span className="chip chip-neutral">{PLATFORM_LABELS[item.platform]}</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-400 dark:text-ink-500 mb-2 break-all">
                      {item.url}
                    </p>
                    <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2">
                      {truncateText(item.text, 120)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleSelect(item)}
                      className="p-1.5 rounded-full text-ink-400 dark:text-ink-500 hover:text-accent dark:hover:text-accent-bright hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                      title="Ver transcripción"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id)}
                      className="p-1.5 rounded-full text-ink-400 dark:text-ink-500 hover:text-danger dark:hover:text-danger-bright hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors"
                      title="Eliminar transcripción"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs font-mono tabular-nums text-ink-400 dark:text-ink-500">
                  {item.createdAt ? formatDate(item.createdAt) : 'Fecha desconocida'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmación de eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold tracking-tight">¿Eliminar transcripción?</h3>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleCancelDelete}
                className="btn btn-ghost btn-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="btn btn-danger btn-sm"
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
