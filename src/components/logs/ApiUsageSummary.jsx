// src/components/logs/ApiUsageSummary.jsx
import React from 'react';

const ApiUsageSummary = ({ stats }) => {
  if (!stats || !stats.global) {
    return <div className="text-center p-4">Cargando estadísticas...</div>;
  }

  // Formatear número con separadores de miles
  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(Math.round(num || 0));
  };

  // Formatear costo en dólares
  const formatCost = (cost) => {
    return `$${(cost || 0).toFixed(4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Total de solicitudes</h3>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatNumber(stats.global.totalRequests)}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tokens procesados</h3>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatNumber(stats.global.totalTokensInput + stats.global.totalTokensOutput)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Entrada: {formatNumber(stats.global.totalTokensInput)} | 
            Salida: {formatNumber(stats.global.totalTokensOutput)}
          </p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Costo estimado</h3>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{formatCost(stats.global.totalCost)}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tiempo promedio</h3>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{Math.round(stats.global.avgDuration || 0)} ms</p>
        </div>
      </div>

      {/* Estadísticas por modelo */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Uso por modelo</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Modelo</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Solicitudes</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.byModel && stats.byModel.map((model, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{model.model_used}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatNumber(model.requests)}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">
                    {formatNumber(model.tokensInput + model.tokensOutput)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatCost(model.cost)}</td>
                </tr>
              ))}
              {(!stats.byModel || stats.byModel.length === 0) && (
                <tr>
                  <td colSpan="4" className="py-4 px-4 text-sm text-center text-gray-500 dark:text-gray-400">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estadísticas por cliente */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Uso por cliente</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Solicitudes</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.byClient && stats.byClient.map((client, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{client.clientName}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatNumber(client.requests)}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">
                    {formatNumber(client.tokensInput + client.tokensOutput)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatCost(client.cost)}</td>
                </tr>
              ))}
              {(!stats.byClient || stats.byClient.length === 0) && (
                <tr>
                  <td colSpan="4" className="py-4 px-4 text-sm text-center text-gray-500 dark:text-gray-400">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estadísticas diarias */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Actividad reciente</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Solicitudes</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tokens</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.daily && stats.daily.map((day, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{day.date}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatNumber(day.requests)}</td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">
                    {formatNumber(day.tokensInput + day.tokensOutput)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 dark:text-gray-300">{formatCost(day.cost)}</td>
                </tr>
              ))}
              {(!stats.daily || stats.daily.length === 0) && (
                <tr>
                  <td colSpan="4" className="py-4 px-4 text-sm text-center text-gray-500 dark:text-gray-400">
                    No hay datos disponibles
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ApiUsageSummary;
