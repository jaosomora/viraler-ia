// src/services/api.js

/**
 * URL base para las solicitudes API
 * En desarrollo: http://localhost:3000
 * En producción: relativa a la URL actual
 */
export const API_BASE_URL = import.meta.env.MODE === 'development' 
  ? 'http://localhost:3000/api' 
  : '/api';

/**
 * Transcribe un video a partir de su URL
 * 
 * @param {string} url - URL del video (Instagram, TikTok, YouTube)
 * @returns {Promise<Object>} - Resultado de la transcripción
 */
export const transcribeVideo = async (url) => {
  try {
    const response = await fetch(`${API_BASE_URL}/transcribeVideo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al transcribir el video');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en la API:', error);
    throw error;
  }
};

/**
 * Verifica la salud del servidor
 * 
 * @returns {Promise<Object>} - Estado de salud del servidor
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Error al verificar la salud del servidor:', error);
    throw error;
  }
};
