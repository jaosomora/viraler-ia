// src/services/usageStats.js
import { API_BASE_URL } from './api';

/**
 * Obtiene las estadísticas de uso de la API
 * 
 * @returns {Promise<Object>} - Datos de uso
 */
export const getUsageStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/usage-stats`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas de uso');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
};

/**
 * Reinicia los datos de uso
 * 
 * @param {boolean} keepHistory - Si se debe mantener el historial
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const resetUsageStats = async (keepHistory = false) => {
  try {
    const response = await fetch(`${API_BASE_URL}/usage-stats/reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ keepHistory }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al reiniciar estadísticas');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al reiniciar estadísticas:', error);
    throw error;
  }
};

/**
 * Elimina un registro histórico por fecha
 * 
 * @param {string} date - Fecha en formato 'YYYY-MM-DD'
 * @returns {Promise<Object>} - Resultado de la operación
 */
export const deleteHistoryEntry = async (date) => {
  try {
    const response = await fetch(`${API_BASE_URL}/usage-stats/history/${date}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Error al eliminar registro');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error al eliminar registro:', error);
    throw error;
  }
};
