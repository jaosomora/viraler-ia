import React, { useState } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import { formatDate, truncateText } from '../utils/formatters';
import { Link, useNavigate } from 'react-router-dom';

const SavedConversions = () => {
  const { savedConversions, deleteConversion, setCurrentConversion } = useConversionContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  if (savedConversions.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto card p-10 text-center flex flex-col items-center gap-3">
        <span className="eyebrow">Conversiones</span>
        <h3 className="font-display text-lg font-semibold tracking-tight">No tienes conversiones guardadas</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md">
          Los documentos que conviertas aparecerán aquí.
        </p>
        <Link to="/convertir" className="btn btn-ghost btn-sm mt-2">
          Convertir un documento →
        </Link>
      </div>
    );
  }

  const filteredConversions = savedConversions.filter(item => {
    const matchesTerm = item.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.markdown?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFormat = selectedFormat === 'all' || item.originalFormat === selectedFormat;
    return matchesTerm && matchesFormat;
  });

  const handleSelect = (conversion) => {
    setCurrentConversion(conversion);
    navigate('/convertir');
  };

  const handleDeleteClick = (id) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteConversion(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Filtros y busqueda */}
      <div className="card p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search-conv" className="form-label">
              Buscar
            </label>
            <input
              id="search-conv"
              type="text"
              className="input"
              placeholder="Buscar por nombre o contenido…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="format" className="form-label">
              Formato
            </label>
            <select
              id="format"
              className="input"
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
            >
              <option value="all">Todos</option>
              <option value="pdf">PDF</option>
              <option value="docx">DOCX</option>
              <option value="pptx">PPTX</option>
              <option value="xlsx">XLSX</option>
              <option value="epub">EPUB</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de conversiones */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-ink-200 dark:border-ink-700">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Conversiones guardadas <span className="font-mono text-sm text-ink-400 dark:text-ink-500 tabular-nums">({filteredConversions.length})</span>
          </h3>
        </div>

        {filteredConversions.length === 0 ? (
          <div className="p-8 text-center text-ink-500 dark:text-ink-400">
            No se encontraron conversiones con los filtros aplicados
          </div>
        ) : (
          <ul className="divide-y divide-ink-200 dark:divide-ink-700">
            {filteredConversions.map((item) => (
              <li key={item.id} className="p-4 hover:bg-ink-100/60 dark:hover:bg-ink-800/40 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-ink-400 dark:text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {item.filename}
                        </p>
                        <span className="chip chip-neutral">
                          {item.originalFormat?.toUpperCase()}
                        </span>
                      </div>
                      {item.fileSize > 0 && (
                        <p className="text-xs text-ink-400 dark:text-ink-500 font-mono tabular-nums mb-1">{formatFileSize(item.fileSize)}</p>
                      )}
                      <p className="text-sm text-ink-500 dark:text-ink-400 line-clamp-2">
                        {truncateText(item.markdown, 120)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center ml-4 space-x-2">
                    <button
                      onClick={() => handleSelect(item)}
                      className="p-1 text-ink-400 hover:text-accent dark:hover:text-accent-bright transition-colors"
                      title="Ver conversión"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id)}
                      className="p-1 text-ink-400 hover:text-danger dark:hover:text-danger-bright transition-colors"
                      title="Eliminar conversión"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-ink-400 dark:text-ink-500 font-mono tabular-nums">
                  {item.createdAt ? formatDate(item.createdAt) : 'Fecha desconocida'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal de confirmacion */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold tracking-tight">¿Eliminar esta conversión?</h3>
            <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
              Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={handleCancelDelete} className="btn btn-ghost btn-sm">
                Cancelar
              </button>
              <button onClick={handleConfirmDelete} className="btn btn-danger btn-sm">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedConversions;
