// src/pages/LogsManagementPage.jsx
import React, { useState, useEffect } from 'react';
import { getApiUsageStats, getApiLogs, getLogDetails } from '../services/logService';
import ApiUsageSummary from '../components/logs/ApiUsageSummary';
import LogsList from '../components/logs/LogsList';
import LogDetail from '../components/logs/LogDetail';
import Spinner from '../components/Spinner';

const LogsManagementPage = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [usageStats, setUsageStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    clientId: '',
    requestType: '',
    startDate: '',
    endDate: '',
    status: ''
  });

  // Cargar estadísticas iniciales
  useEffect(() => {
    const fetchUsageStats = async () => {
      try {
        const stats = await getApiUsageStats();
        setUsageStats(stats);
        setError(null);
      } catch (err) {
        setError('Error al cargar estadísticas: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeSection === 'overview') {
      fetchUsageStats();
    }
  }, [activeSection]);

  // Cargar logs cuando cambia la sección a "logs"
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setIsLoading(true);
        const logsData = await getApiLogs(filters);
        setLogs(logsData);
        setError(null);
      } catch (err) {
        setError('Error al cargar logs: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeSection === 'logs') {
      fetchLogs();
    }
  }, [activeSection, filters]);

  // Manejar cambios en los filtros
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
  };

  // Aplicar filtros
  const applyFilters = () => {
    // La solicitud se dispara automáticamente por el efecto cuando cambian los filtros
  };

  // Restablecer filtros
  const resetFilters = () => {
    setFilters({
      clientId: '',
      requestType: '',
      startDate: '',
      endDate: '',
      status: ''
    });
  };

  // Ver detalles de un log
  const handleViewLogDetails = async (logId) => {
    try {
      setIsLoading(true);
      const details = await getLogDetails(logId);
      setSelectedLog(details);
      setError(null);
    } catch (err) {
      setError('Error al cargar detalles del log: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cerrar detalles del log
  const handleCloseLogDetails = () => {
    setSelectedLog(null);
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Administración de Logs
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Monitorea y analiza el uso de la API de Claude y el sistema RAG
        </p>
      </div>

      {/* Pestañas de navegación */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'overview'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveSection('overview')}
          >
            Resumen de uso
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeSection === 'logs'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveSection('logs')}
          >
            Registros detallados
          </button>
        </nav>
      </div>

      {/* Contenido según la pestaña activa */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Resumen de uso */}
          {activeSection === 'overview' && (
            <ApiUsageSummary stats={usageStats} />
          )}

          {/* Logs detallados */}
          {activeSection === 'logs' && (
            <div className="space-y-6">
              {/* Filtros */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filtros</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="clientId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Cliente
                    </label>
                    <input
                      id="clientId"
                      name="clientId"
                      type="text"
                      value={filters.clientId}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="requestType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Tipo de solicitud
                    </label>
                    <select
                      id="requestType"
                      name="requestType"
                      value={filters.requestType}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Todas</option>
                      <option value="generate_script">Generación de guión</option>
                      <option value="conversation">Conversación</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Estado
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={filters.status}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      <option value="">Todos</option>
                      <option value="success">Éxito</option>
                      <option value="error">Error</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fecha inicio
                    </label>
                    <input
                      id="startDate"
                      name="startDate"
                      type="date"
                      value={filters.startDate}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Fecha fin
                    </label>
                    <input
                      id="endDate"
                      name="endDate"
                      type="date"
                      value={filters.endDate}
                      onChange={handleFilterChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                </div>
                
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                  >
                    Aplicar filtros
                  </button>
                </div>
              </div>
              
              {/* Lista de logs o detalles */}
              {selectedLog ? (
                <LogDetail log={selectedLog} onClose={handleCloseLogDetails} />
              ) : (
                <LogsList logs={logs} onViewDetails={handleViewLogDetails} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LogsManagementPage;
