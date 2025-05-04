// src/services/clientService.js
import { API_BASE_URL } from './api';

/**
 * Obtiene todos los clientes
 * @returns {Promise<Array>} - Lista de clientes
 */
export const getClients = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`);
    
    if (!response.ok) {
      throw new Error('Error al obtener clientes');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getClients:', error);
    throw error;
  }
};

/**
 * Obtiene un cliente por ID
 * @param {number} id - ID del cliente
 * @returns {Promise<Object>} - Datos del cliente
 */
export const getClientById = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener cliente');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getClientById:', error);
    throw error;
  }
};

/**
 * Crea un nuevo cliente
 * @param {Object} clientData - Datos del cliente
 * @returns {Promise<Object>} - Cliente creado
 */
export const createClient = async (clientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear cliente');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en createClient:', error);
    throw error;
  }
};

/**
 * Actualiza un cliente existente
 * @param {number} id - ID del cliente
 * @param {Object} clientData - Datos actualizados
 * @returns {Promise<Object>} - Cliente actualizado
 */
export const updateClient = async (id, clientData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar cliente');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en updateClient:', error);
    throw error;
  }
};

/**
 * Elimina un cliente
 * @param {number} id - ID del cliente
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteClient = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar cliente');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en deleteClient:', error);
    throw error;
  }
};

/**
 * Obtiene los documentos de un cliente
 * @param {number} clientId - ID del cliente
 * @returns {Promise<Array>} - Lista de documentos
 */
export const getClientDocuments = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`);
    
    if (!response.ok) {
      throw new Error('Error al obtener documentos');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getClientDocuments:', error);
    throw error;
  }
};

/**
 * Crea un nuevo documento para un cliente
 * @param {number} clientId - ID del cliente
 * @param {Object} documentData - Datos del documento
 * @returns {Promise<Object>} - Documento creado
 */
export const createDocument = async (clientId, documentData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear documento');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en createDocument:', error);
    throw error;
  }
};
