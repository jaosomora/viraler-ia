// src/components/logs/LogDetail.jsx
import React, { useState } from 'react';

const LogDetail = ({ log, onClose }) => {
  const [activeTab, setActiveTab] = useState('request');

  if (!log) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">Selecciona un log para ver sus detalles</p>
      </div>
    );
  }

  // Formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Formatear JSON para mostrar
  const formatJson = (json) => {
    try {
      return JSON.stringify(json, null, 2);
    } catch (e) {
      return String(json);
    }
  };

  // Renderizar contenido según la pestaña activa
  const renderTabContent = () => {
    if (!log.content) {
      return (
        <div className="p-4 text-center">
          <p className="text-gray-500 dark:text-gray-400">No hay contenido detallado disponible</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'request':
        return (
          <div className="p-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Modelo</h4>
            <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 rounded-lg">
              <code className="text-sm">{log.content.request.model}</code>
            </div>

            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Prompt</h4>
            <div className="mb-4 p-2 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 rounded-lg overflow-x-auto max-h-96">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{
                typeof log.content.request.prompt === 'string' 
                  ? log.content.request.prompt 
                  : formatJson(log.content.request.prompt)
              }</pre>
            </div>

            {log.content.request.ragContext && (
              <>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Contexto RAG</h4>
                <div className="p-2 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 rounded-lg overflow-x-auto max-h-96">
                  <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{formatJson(log.content.request.ragContext)}</pre>
                </div>
              </>
            )}
          </div>
        );
      
      case 'response':
        return (
          <div className="p-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Respuesta</h4>
            <div className="p-2 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 rounded-lg overflow-x-auto max-h-96">
              <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{
                typeof log.content.response === 'string' 
                  ? log.content.response 
                  : formatJson(log.content.response)
              }</pre>
            </div>
          </div>
        );
      
      case 'metrics':
        return (
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Duración</h4>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{log.content.duration || '-'} ms</p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Costo estimado</h4>
                <p className="text-lg font-medium text-gray-900 dark:text-white">${(log.content.costEstimate || 0).toFixed(6)}</p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tokens de entrada</h4>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{log.content.tokenEstimates?.input || '-'}</p>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Tokens de salida</h4>
                <p className="text-lg font-medium text-gray-900 dark:text-white">{log.content.tokenEstimates?.output || '-'}</p>
              </div>
            </div>
          </div>
        );
      
      case 'rag':
        return (
          <div className="p-4">
            {log.rag ? (
              <>
                <div className="mb-4">
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Estadísticas RAG</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Consulta</h5>
                      <p className="text-sm text-gray-800 dark:text-gray-200">{log.rag.stats.query}</p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                      <h5 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Fragmentos recuperados</h5>
                      <p className="text-lg font-medium text-gray-900 dark:text-white">{log.rag.stats.num_chunks_retrieved}</p>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Documentos utilizados</h4>
                  <div className="space-y-4">
                    {log.rag.documents && log.rag.documents.map((doc, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                          <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">{doc.document_title || 'Sin título'}</h5>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Relevancia: {(doc.similarity_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300">
                          ID: {doc.document_id}, Fragmento: {doc.chunk_index}
                        </p>
                      </div>
                    ))}
                    {(!log.rag.documents || log.rag.documents.length === 0) && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No hay documentos utilizados</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center">
                <p className="text-gray-500 dark:text-gray-400">No hay información RAG disponible para este log</p>
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Detalles del Log #{log.meta.id}
        </h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <div className="p-4 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Cliente</p>
            <p className="font-medium text-gray-900 dark:text-white">{log.meta.client_name || 'Desconocido'}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tipo de solicitud</p>
            <p className="font-medium text-gray-900 dark:text-white">{log.meta.request_type}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Fecha</p>
            <p className="font-medium text-gray-900 dark:text-white">{formatDate(log.meta.timestamp)}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Modelo</p>
            <p className="font-medium text-gray-900 dark:text-white">{log.meta.model_used}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Estado</p>
            <p className="font-medium text-gray-900 dark:text-white">{log.meta.status === 'success' ? 'Éxito' : 'Error'}</p>
          </div>
          
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Costo</p>
            <p className="font-medium text-gray-900 dark:text-white">${log.meta.cost_estimate.toFixed(6)}</p>
          </div>
        </div>
      </div>
      
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('request')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'request'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Solicitud
          </button>
          
          <button
            onClick={() => setActiveTab('response')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'response'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Respuesta
          </button>
          
          <button
            onClick={() => setActiveTab('metrics')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'metrics'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Métricas
          </button>
          
          <button
            onClick={() => setActiveTab('rag')}
            className={`py-4 px-6 text-sm font-medium ${
              activeTab === 'rag'
                ? 'text-purple-600 border-b-2 border-purple-600'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            RAG
          </button>
        </nav>
      </div>
      
      {renderTabContent()}
    </div>
  );
};

export default LogDetail;
