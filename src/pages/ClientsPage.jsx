// src/pages/ClientsPage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients, createClient, deleteClient } from '../services/clientService';
import Spinner from '../components/Spinner';

const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newClientData, setNewClientData] = useState({ name: '', description: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);

  // Cargar clientes al montar el componente
  useEffect(() => {
    fetchClients();
  }, []);

  // Función para cargar clientes
  const fetchClients = async () => {
    try {
      setIsLoading(true);
      const data = await getClients();
      setClients(data);
      setError(null);
    } catch (error) {
      setError('Error al cargar los clientes');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar cambios en el formulario
  const handleInputChange = (e) => {
    const { name, value } = e.target;
setNewClientData(prev => ({ ...prev, [name]: value }));
  };

  // Manejar creación de cliente
  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const createdClient = await createClient(newClientData);
      setClients(prev => [createdClient, ...prev]);
      setNewClientData({ name: '', description: '' });
      setShowCreateForm(false);
      setError(null);
    } catch (error) {
      setError('Error al crear el cliente');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manejar eliminación de cliente
  const handleDeleteClient = async (id) => {
    try {
      setIsLoading(true);
      await deleteClient(id);
      setClients(prev => prev.filter(client => client.id !== id));
      setDeleteConfirmation(null);
      setError(null);
    } catch (error) {
      setError('Error al eliminar el cliente');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-8">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Clientes
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Gestiona tus clientes y crea guiones personalizados para cada uno
        </p>
      </div>

      {/* Controles */}
      <div className="flex justify-between items-center">
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {showCreateForm ? 'Cancelar' : 'Nuevo Cliente'}
        </button>
      </div>

      {/* Formulario de creación */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Crear nuevo cliente</h2>
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={newClientData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Descripción
              </label>
              <textarea
                id="description"
                name="description"
                rows="3"
                value={newClientData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              ></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-70"
              >
                {isLoading ? <Spinner size="sm" /> : null}
                Crear Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          <p>{error}</p>
        </div>
      )}

      {/* Lista de clientes */}
      {isLoading && !showCreateForm ? (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No hay clientes</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Crea tu primer cliente para comenzar a generar guiones virales
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg inline-flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Crear Cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map(client => (
            <div key={client.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {client.name}
                </h3>
                {client.description && (
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {client.description}
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <div className="flex space-x-2">
                    <Link
                      to={`/clientes/${client.id}`}
                      className="px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-800/40"
                    >
                      Ver detalles
                    </Link>
                    <Link
                      to={`/clientes/${client.id}/nuevo-guion`}
                      className="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-200 dark:hover:bg-indigo-800/40"
                    >
                      Nuevo guión
                    </Link>
                  </div>
                  <button
                    onClick={() => setDeleteConfirmation(client.id)}
                    className="p-1.5 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar este cliente? Esta acción eliminará también todos sus documentos y guiones.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteClient(deleteConfirmation)}
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

export default ClientsPage;
