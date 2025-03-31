import React, { useState, useEffect } from 'react';
import { getUsageStats, resetUsageStats, deleteHistoryEntry } from '../services/usageStats';
import Spinner from '../components/Spinner';

const AdminPanel = () => {
  const [usageData, setUsageData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchUsageData = async () => {
    try {
      setIsLoading(true);
      const data = await getUsageStats();
      setUsageData(data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar datos de uso');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsageData();
  }, []);

  // Mostrar confirmación para reiniciar los datos
  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  // Confirmar reinicio de datos
  const handleResetConfirm = async (keepHistory) => {
    try {
      await resetUsageStats(keepHistory);
      setActionSuccess(`Datos de uso reiniciados correctamente${keepHistory ? ' (manteniendo historial)' : ''}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
    } catch (err) {
      setError(err.message || 'Error al reiniciar datos');
    } finally {
      setShowResetConfirm(false);
    }
  };

  // Mostrar confirmación para eliminar una entrada del historial
  const handleDeleteClick = (date) => {
    setDeleteTarget(date);
    setShowDeleteConfirm(true);
  };

  // Confirmar eliminación de entrada
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    
    try {
      await deleteHistoryEntry(deleteTarget);
      setActionSuccess(`Registro del ${deleteTarget} eliminado correctamente`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
    } catch (err) {
      setError(err.message || 'Error al eliminar registro');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // Cancelar cualquier confirmación
  const handleCancelAction = () => {
    setShowDeleteConfirm(false);
    setShowResetConfirm(false);
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Spinner size="xl" />
        <p className="text-gray-600 dark:text-gray-300">Cargando estadísticas de uso...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <div className="flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-600 dark:text-gray-300">No hay datos de uso disponibles.</p>
      </div>
    );
  }

  // Formatear números
  const formatNumber = (num, decimals = 2) => {
    return Number(num).toFixed(decimals);
  };

  // Formatear precio
  const formatPrice = (amount) => {
    return `$${Number(amount).toFixed(4)}`;
  };

  return (
    <div className="flex flex-col space-y-8 max-w-4xl mx-auto">
      {/* Mensaje de acción exitosa */}
      {actionSuccess && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 p-4 rounded-lg flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Panel de Administración
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Monitorea el uso y los costos de la API de OpenAI
        </p>
      </div>

      {/* Controles de administración */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Acciones</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleResetClick}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar Contadores
          </button>
          <button
            onClick={() => fetchUsageData()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Transcripciones</h3>
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{usageData.totalTranscriptions}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">transcripciones totales</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Minutos de audio</h3>
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(usageData.totalAudioMinutes)}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">minutos procesados</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Costo total</h3>
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatPrice(usageData.estimatedCost)}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">costo estimado (USD)</p>
        </div>
      </div>

      {/* Estadísticas adicionales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Estadísticas detalladas</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Promedio por transcripción</h3>
            <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-300">Costo</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatPrice(usageData.averageCostPerTranscription)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Duración</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatNumber(usageData.averageAudioMinutesPerTranscription)} min</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Información de Whisper API</h3>
            <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-300">Modelo</span>
                <span className="font-medium text-gray-900 dark:text-white">whisper-1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Costo por minuto</span>
                <span className="font-medium text-gray-900 dark:text-white">$0.006</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de uso */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Historial de uso reciente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transcripciones</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Minutos</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {usageData.recentHistory && usageData.recentHistory.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-6 text-sm font-medium text-gray-900 dark:text-white">{entry.date}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{entry.transcriptions}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{formatNumber(entry.audioMinutes)}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{formatPrice(entry.cost)}</td>
                  <td className="py-3 px-6 text-sm">
                    <button
                      onClick={() => handleDeleteClick(entry.date)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {(!usageData.recentHistory || usageData.recentHistory.length === 0) && (
                <tr>
                  <td colSpan="5" className="py-4 px-6 text-sm text-center text-gray-500 dark:text-gray-400">
                    No hay datos históricos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de confirmación para reiniciar datos */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar reinicio de datos</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas reiniciar los contadores de uso? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => handleResetConfirm(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
              >
                Reiniciar Todo (Incluido Historial)
              </button>
              <button
                onClick={() => handleResetConfirm(true)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center justify-center"
              >
                Reiniciar Solo Contadores (Mantener Historial)
              </button>
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar registro */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar el registro del {deleteTarget}? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
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

export default AdminPanel;