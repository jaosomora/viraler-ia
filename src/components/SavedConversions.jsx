import React, { useState } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import { formatDate, truncateText } from '../utils/formatters';
import { useNavigate } from 'react-router-dom';

const FORMAT_COLORS = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pptx: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  xlsx: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  epub: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

const SavedConversions = () => {
  const { savedConversions, deleteConversion, setCurrentConversion } = useConversionContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const navigate = useNavigate();

  if (savedConversions.length === 0) {
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">No tienes conversiones guardadas</h3>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Los documentos que conviertas aparecerán aquí para que puedas acceder a ellos en cualquier momento.
        </p>
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
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label htmlFor="search-conv" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Buscar
            </label>
            <input
              id="search-conv"
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Buscar por nombre o contenido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formato
            </label>
            <select
              id="format"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Conversiones guardadas ({filteredConversions.length})
          </h3>
        </div>

        {filteredConversions.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            No se encontraron conversiones con los filtros aplicados
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredConversions.map((item) => (
              <li key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.filename}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${FORMAT_COLORS[item.originalFormat] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                          {item.originalFormat?.toUpperCase()}
                        </span>
                      </div>
                      {item.fileSize > 0 && (
                        <p className="text-xs text-gray-400 mb-1">{formatFileSize(item.fileSize)}</p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {truncateText(item.markdown, 120)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center ml-4 space-x-2">
                    <button
                      onClick={() => handleSelect(item)}
                      className="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300 p-1"
                      title="Ver conversion"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteClick(item.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                      title="Eliminar conversion"
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

      {/* Modal de confirmacion */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Confirmar eliminacion</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Estas seguro de que deseas eliminar esta conversion? Esta accion no se puede deshacer.
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

export default SavedConversions;
