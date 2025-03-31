// src/utils/formatters.js

/**
 * Formatea una fecha ISO a un formato legible en español
 * 
 * @param {string} dateString - Fecha en formato ISO
 * @returns {string} - Fecha formateada
 */
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

/**
 * Trunca un texto a una longitud determinada
 * 
 * @param {string} text - Texto a truncar
 * @param {number} maxLength - Longitud máxima
 * @returns {string} - Texto truncado
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Formatea segundos a formato de duración (mm:ss)
 * 
 * @param {number} seconds - Duración en segundos
 * @returns {string} - Duración formateada
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};
