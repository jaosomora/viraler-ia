// src/services/videoExtractor.js

/**
 * Este archivo contiene utilidades para interactuar con el servicio de extracción de videos.
 * En el frontend, estas funciones llaman a nuestra API backend.
 */

import { API_BASE_URL } from './api';

/**
 * Detecta la plataforma de un video basado en su URL
 * 
 * @param {string} url - URL del video
 * @returns {string} - Plataforma detectada (instagram, tiktok, youtube, youtube-shorts)
 */
export const detectPlatform = (url) => {
  if (url.includes('instagram.com')) {
    if (url.includes('/reel/')) return 'instagram';
    if (url.includes('/p/')) return 'instagram';
    return 'instagram';
  }
  
  if (url.includes('tiktok.com')) return 'tiktok';
  
  if (url.includes('youtube.com')) {
    if (url.includes('/shorts/')) return 'youtube-shorts';
    return 'youtube';
  }
  
  return 'unknown';
};

/**
 * Obtiene una miniatura del video (función simulada)
 * En una implementación real, esto vendría de la API
 * 
 * @param {string} url - URL del video
 * @param {string} platform - Plataforma detectada
 * @returns {string|null} - URL de la miniatura
 */
export const getThumbnail = (url, platform) => {
  // En una implementación real, la miniatura vendría del backend
  return null;
};

/**
 * Utilidad para formatear datos de transcripción
 * 
 * @param {Object} apiResponse - Respuesta de la API
 * @returns {Object} - Datos formateados
 */
export const formatTranscriptionData = (apiResponse) => {
  return {
    id: Date.now().toString(),
    url: apiResponse.url,
    text: apiResponse.transcript,
    platform: detectPlatform(apiResponse.url),
    title: apiResponse.title || 'Sin título',
    duration: apiResponse.duration || 0,
    thumbnail: apiResponse.thumbnail || null,
    language: apiResponse.language || 'es',
    createdAt: new Date().toISOString()
  };
};
