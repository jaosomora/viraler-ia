// src/pages/ClientDetailPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getClientById, getClientDocuments, createDocument, deleteClient } from '../services/clientService';
import { getClientScripts } from '../services/scriptService';
import Spinner from '../components/Spinner';

const ClientDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('documents');
  const [error, setError] = useState(null);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [newDocument, setNewDocument] = useState({ title: '', content: '', type: 'general' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Cargar datos del cliente
  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setIsLoading(true);
        const clientData = await getClientById(id);
        setClient(clientData);
        
        // Cargar documentos y guiones
        const [documentsData, scriptsData] = await Promise.all([
          getClientDocuments(id),
          getClientScripts(id)
        ]);
        
        setDocuments(documentsData);
        setScripts(scriptsData);
        setError(null);
      } catch (error) {
        setError('Error al cargar los datos del cliente');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClientData();
  }, [id]);

  // Manejar creación de documento
  const handleCreateDocument = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const createdDocument = await createDocument(id, newDocument);
      setDocuments(prev => [createdDocument, ...prev]);
      setNewDocument({ title: '', content: '', type: 'general' });
      setShowDocumentForm(false);
      setError(null);
    } catch (error) {
      setError('Error al crear el documento');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar eliminación de cliente
  const handleDeleteClient = async () => {
    try {
      setIsLoading(true);
      await deleteClient(id);
      navigate('/clientes');
    } catch (error) {
      setError('Error al eliminar el cliente');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewDocument(prev => ({ ...prev, [name]: value }));
  };

  if (isLoading && !client) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !client) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
        <p>{error}</p>
        <button
          onClick={() => navigate('/clientes')}
          className="mt-2 text-red-700 dark:text-red-400 underline"
        >
          Volver a la lista de clientes
        </button>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center p-12">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">Cliente no encontrado</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">El cliente que buscas no existe o ha sido eliminado.</p>
        <Link
          to="/clientes"
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
        >
          Volver a la lista de clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-8">
      {/* Encabezado */}
      <div className="flex justify-between items-start">
        <div>
          <Link 
            to="/clientes" 
            className="inline-flex items-center text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 mb-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a clientes
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
          {client.description && (
            <p className="mt-2 text-gray-600 dark:text-gray-300">{client.description}</p>
          )}
        </div>
        <div className="flex space-x-2">
          <Link
            to={`/clientes/${id}/nuevo-guion`}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuevo guión
          </Link>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Eliminar cliente
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'documents'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('documents')}
          >
            Documentos ({documents.length})
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'scripts'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
            onClick={() => setActiveTab('scripts')}
          >
            Guiones ({scripts.length})
          </button>
        </nav>
      </div>

      {/* Contenido de la pestaña activa */}
      {activeTab === 'documents' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Documentos</h2>
            <button
              onClick={() => setShowDocumentForm(!showDocumentForm)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {showDocumentForm ? 'Cancelar' : 'Nuevo documento'}
            </button>
          </div>

          {/* Formulario de documento */}
          {showDocumentForm && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
              <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Nuevo documento</h3>
              <form onSubmit={handleCreateDocument} className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Título
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    value={newDocument.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tipo de documento
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={newDocument.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="general">General</option>
                    <option value="técnica">Técnica</option>
                    <option value="caso_exito">Caso de éxito</option>
                    <option value="marca">Identidad de marca</option>
                    <option value="audiencia">Análisis de audiencia</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Contenido (Markdown)
                  </label>
                  <textarea
                    id="content"
                    name="content"
                    rows="10"
                    required
                    value={newDocument.content}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
                  ></textarea>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowDocumentForm(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-70"
                    disabled={isLoading}
                  >
                    {isLoading ? <Spinner size="sm" className="mr-2" /> : null}
                    Guardar documento
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Lista de documentos */}
          {documents.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No hay documentos</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Añade documentos para entrenar el sistema sobre este cliente
              </p>
              <button
                onClick={() => setShowDocumentForm(true)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Crear documento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {documents.map(doc => (
                <div key={doc.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{doc.title}</h3>
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full mb-2">
                        {doc.type}
                      </span>
                    </div>
                    <div className="flex space-x-1">
                      <button className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-3 rounded-lg border dark:border-gray-700 max-h-40 overflow-y-auto">
                    <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">
                      {doc.content.substring(0, 200)}
                      {doc.content.length > 200 ? '...' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Guiones</h2>
            <Link
              to={`/clientes/${id}/nuevo-guion`}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nuevo guión
            </Link>
          </div>

          {/* Lista de guiones */}
          {scripts.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No hay guiones</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea tu primer guión viral para este cliente
              </p>
              <Link
                to={`/clientes/${id}/nuevo-guion`}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Crear guión
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {scripts.map(script => (
                <Link
                  key={script.id}
                  to={`/scripts/${script.id}`}
                  className="block bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 hover:shadow-lg transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">{script.title}</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span>
                          Duración: {Math.round(script.duration_seconds / 60)} min {script.duration_seconds % 60} seg
                        </span>
                        <span>
                          CTA: {script.cta || 'Ninguno'}
                        </span>
                        <span>
                          Nivel: {script.awareness_level}
                        </span>
                      </div>
                    </div>
                    <div className="text-gray-400 dark:text-gray-500">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                      {script.content.substring(0, 150)}...
                    </p>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Creado: {new Date(script.created_at).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmación para eliminar cliente */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar este cliente? Esta acción eliminará también todos sus documentos y guiones y no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteClient}
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

export default ClientDetailPage;
