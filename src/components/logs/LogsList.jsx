// src/components/logs/LogsList.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const LogsList = ({ logs, onViewDetails }) => {
  const [expandedLog, setExpandedLog] = useState(null);

  if (!logs || logs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">No hay logs disponibles</p>
      </div>
    );
  }

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Formatear costo en dólares
  const formatCost = (cost) => {
    return `$${(cost || 0).toFixed(4)}`;
  };

  // Obtener clase de color según el estado
  const getStatusClass = (status) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Obtener etiqueta según el tipo de solicitud
  const getRequestTypeLabel = (type) => {
    switch (type) {
      case 'generate_script':
        return 'Generación de guión';
      case 'conversation':
        return 'Conversación';
      default:
        return type;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Historial de solicitudes</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
              <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30"
              >
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{log.id}</td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatDate(log.timestamp)}</td>
                <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">{log.client_name || 'Desconocido'}</td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{getRequestTypeLabel(log.request_type)}</td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{log.model_used}</td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">
                  {log.tokens_input + log.tokens_output}
                </td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatCost(log.cost_estimate)}</td>
                <td className="py-3 px-4 text-sm">
                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(log.status)}`}>
                    {log.status === 'success' ? 'Éxito' : 'Error'}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">
                  <button
                    onClick={() => onViewDetails(log.id)}
                    className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Ver detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LogsList;
