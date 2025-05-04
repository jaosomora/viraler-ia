// src/services/logService.js
import { API_BASE_URL } from './api';

/**
 * Obtiene estadísticas de uso de Claude
 * @returns {Promise<Object>} - Estadísticas de uso
 */
export const getApiUsageStats = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/logs/usage-stats`);
    
    if (!response.ok) {
      throw new Error('Error al obtener estadísticas de uso');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getApiUsageStats:', error);
    throw error;
  }
};

/**
 * Obtiene lista de logs con filtros opcionales
 * @param {Object} filters - Filtros a aplicar
 * @returns {Promise<Array>} - Lista de logs
 */
export const getApiLogs = async (filters = {}) => {
  try {
    // Construir query string desde los filtros
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        queryParams.append(key, value);
      }
    });
    
    const response = await fetch(`${API_BASE_URL}/logs/logs?${queryParams.toString()}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener logs');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getApiLogs:', error);
    throw error;
  }
};

/**
 * Obtiene detalles de un log específico
 * @param {number} id - ID del log
 * @returns {Promise<Object>} - Detalles del log
 */
export const getLogDetails = async (id) => {
  try {
    const response = await fetch(`${API_BASE_URL}/logs/logs/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al obtener detalles del log');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error en getLogDetails:', error);
    throw error;
  }
};
