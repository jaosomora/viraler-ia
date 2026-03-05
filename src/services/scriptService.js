// src/services/scriptService.js
import { API_BASE_URL } from './api';

/**
 * Obtiene los guiones de un cliente
 * @param {number} clientId - ID del cliente
 * @returns {Promise<Array>} - Lista de guiones
 */
export const getClientScripts = async (clientId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/client/${clientId}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener guiones');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getClientScripts:', error);
    throw error;
  }
};

/**
 * Obtiene un guión por ID
 * @param {number} id - ID del guión
 * @returns {Promise<Object>} - Datos del guión
 */
export const getScriptById = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener guión');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getScriptById:', error);
    throw error;
  }
};

/**
 * Crea un nuevo guión para un cliente
 * @param {number} clientId - ID del cliente
 * @param {Object} scriptData - Datos del guión
 * @returns {Promise<Object>} - Guión creado
 */
export const createScript = async (clientId, scriptData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/client/${clientId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scriptData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear guión');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en createScript:', error);
    throw error;
  }
};

/**
 * Actualiza un guión existente
 * @param {number} id - ID del guión
 * @param {Object} scriptData - Datos actualizados
 * @returns {Promise<Object>} - Guión actualizado
 */
export const updateScript = async (id, scriptData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scriptData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar guión');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en updateScript:', error);
    throw error;
  }
};

/**
 * Elimina un guión
 * @param {number} id - ID del guión
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteScript = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar guión');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en deleteScript:', error);
    throw error;
  }
};

/**
 * Envía un mensaje en la conversación de un guión
 * @param {number} scriptId - ID del guión
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<Object>} - Respuesta del asistente
 */
export const conversationWithScript = async (scriptId, message) => {
  try {
    const response = await fetch(`${API_BASE_URL}/scripts/${scriptId}/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error en la conversación');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en conversationWithScript:', error);
    throw error;
  }
};
