// src/pages/ScriptDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getScriptById, conversationWithScript, deleteScript } from '../services/scriptService';
import { getClientById } from '../services/clientService';
import Spinner from '../components/Spinner';

const ScriptDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [script, setScript] = useState(null);
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isChatting, setIsChatting] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedScript, setEditedScript] = useState(null);

  // Cargar datos del guión
  useEffect(() => {
    const fetchScriptAndClient = async () => {
      try {
        setIsLoading(true);
        const scriptData = await getScriptById(id);
        setScript(scriptData);
        
        // Obtener datos del cliente
        const clientData = await getClientById(scriptData.client_id);
        setClient(clientData);
        
        // Preparar para edición
        setEditedScript({
          title: scriptData.title,
          content: scriptData.content,
          cta: scriptData.cta,
          durationSeconds: scriptData.duration_seconds,
          awarenessLevel: scriptData.awareness_level,
          additionalNotes: scriptData.additional_notes
        });
        
        setError(null);
      } catch (error) {
        setError('Error al cargar el guión');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScriptAndClient();
  }, [id]);

  // Manejar envío de mensaje
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    
    try {
      setIsChatting(true);
      
      // Agregar mensaje del usuario al chat
      setChatMessages(prev => [...prev, { role: 'user', content: newMessage }]);
      
      // Enviar mensaje a Claude
      const response = await conversationWithScript(id, newMessage);
      
      // Actualizar chat con la respuesta
      setChatMessages(response.conversation.filter(msg => msg.role !== 'system'));
      
      // Limpiar campo de mensaje
      setNewMessage('');
    } catch (error) {
      setError('Error en la conversación: ' + error.message);
    } finally {
      setIsChatting(false);
    }
  };

  // Manejar eliminación de guión
  const handleDeleteScript = async () => {
    try {
      setIsLoading(true);
      await deleteScript(id);
      navigate(`/clientes/${client.id}`);
    } catch (error) {
      setError('Error al eliminar el guión');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en la edición
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedScript(prev => ({ ...prev, [name]: value }));
  };

  if (isLoading && !script) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!script && error) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p>{error}</p>
        <Link
          to="/clientes"
          className="mt-2 text-red-700 dark:text-red-400 underline"
        >
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  if (!script) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Guión no encontrado</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">El guión que buscas no existe o ha sido eliminado.</p>
        <Link
          to="/clientes"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          Volver a clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex justify-between items-start">
        <div>
          {client && (
            <Link
              to={`/clientes/${client.id}`}
              className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-2"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Volver al cliente
            </Link>
          )}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {isEditMode ? 'Editar guión' : script.title}
          </h1>
          {client && (
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Cliente: <span className="font-medium text-gray-900 dark:text-white">{client.name}</span>
            </p>
          )}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            {isEditMode ? 'Cancelar' : 'Editar'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar
          </button>
        </div>
      </div>

      {/* Información del guión */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Duración</h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {Math.floor(script.duration_seconds / 60)}:{(script.duration_seconds % 60).toString().padStart(2, '0')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Call to Action</h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{script.cta || 'Ninguno'}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Nivel de conciencia</h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">{script.awareness_level}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Fecha creación</h3>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {new Date(script.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Contenido del guión */}
      {isEditMode ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <form className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Título
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={editedScript.title}
                onChange={handleEditChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contenido del guión
              </label>
              <textarea
                id="content"
                name="content"
                rows="15"
                required
                value={editedScript.content}
                onChange={handleEditChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
              ></textarea>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="cta" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Call to Action
                </label>
                <select
                  id="cta"
                  name="cta"
                  value={editedScript.cta}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="Ninguno">Ninguno</option>
                  <option value="Seguir">Seguir</option>
                  <option value="Comentar">Comentar</option>
                  <option value="Mencionar">Mencionar</option>
                  <option value="Compartir">Compartir</option>
                  <option value="Guardar">Guardar</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="durationSeconds" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Duración (segundos)
                </label>
                <input
                  id="durationSeconds"
                  name="durationSeconds"
                  type="number"
                  min="15"
                  max="300"
                  value={editedScript.durationSeconds}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="awarenessLevel" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nivel de conciencia
                </label>
                <select
                  id="awarenessLevel"
                  name="awarenessLevel"
                  value={editedScript.awarenessLevel}
                  onChange={handleEditChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="0">Nivel 0 - No consciente</option>
                  <option value="1">Nivel 1 - Consciente del problema</option>
                  <option value="2">Nivel 2 - Buscando soluciones</option>
                  <option value="3">Nivel 3 - Conoce la solución</option>
                  <option value="4">Nivel 4 - Conoce el producto</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Guión</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(script.content);
                }}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                Copiar
              </button>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700 whitespace-pre-wrap">
            {script.content}
          </div>
        </div>
      )}

      {/* Chat para mejorar el guión */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Mejorar guión con IA</h2>
        <div className="space-y-4">
          {/* Mensajes del chat */}
          <div className="space-y-4 max-h-96 overflow-y-auto p-1">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">
                  Envía un mensaje para mejorar o ajustar el guión con ayuda de IA
                </p>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3/4 p-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100'
                        : 'bg-gray-100 dark:bg-gray-750 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* Formulario de chat */}
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje para mejorar el guión..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isChatting}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isChatting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-70 flex items-center gap-2"
            >
              {isChatting ? <Spinner size="sm" /> : null}
              Enviar
            </button>
          </form>
        </div>
      </div>

      {/* Modal de confirmación para eliminar */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar este guión? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteScript}
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

export default ScriptDetailPage;
