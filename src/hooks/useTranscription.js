// src/hooks/useTranscription.js
import { useState } from 'react';
import { transcribeVideo } from '../services/api';
import useLocalStorage from './useLocalStorage';

/**
 * Hook personalizado para manejar la lógica de transcripción
 * 
 * @returns {Object} - Métodos y estados para manejar transcripciones
 */
function useTranscription() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentTranscription, setCurrentTranscription] = useState(null);
  const [savedTranscriptions, setSavedTranscriptions] = useLocalStorage('savedTranscriptions', []);

  /**
   * Detecta la plataforma basada en la URL
   * 
   * @param {string} url - URL del video
   * @returns {string} - Nombre de la plataforma
   */
  const detectPlatform = (url) => {
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('youtube.com/shorts')) return 'youtube-shorts';
    if (url.includes('youtube.com')) return 'youtube';
    return 'unknown';
  };

  /**
   * Procesa una URL para transcripción
   * 
   * @param {string} url - URL del video
   * @returns {Promise<Object>} - Datos de la transcripción
   */
  const processTranscription = async (url) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Llamar a nuestro servicio API
      const data = await transcribeVideo(url);
      
      // Crear objeto de transcripción
      const newTranscription = {
        id: Date.now().toString(),
        url,
        platform: detectPlatform(url),
        text: data.transcript,
        createdAt: new Date().toISOString(),
        title: data.title || 'Transcripción sin título'
      };
      
      setCurrentTranscription(newTranscription);
      return newTranscription;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Guarda la transcripción actual en localStorage
   * 
   * @returns {boolean} - true si se guardó correctamente
   */
  const saveTranscription = () => {
    if (currentTranscription) {
      // Verificar si ya existe esta transcripción
      const exists = savedTranscriptions.some(t => t.id === currentTranscription.id);
      
      if (!exists) {
        setSavedTranscriptions([currentTranscription, ...savedTranscriptions]);
        return true;
      }
    }
    return false;
  };

  /**
   * Elimina una transcripción guardada
   * 
   * @param {string} id - ID de la transcripción a eliminar
   */
  const deleteTranscription = (id) => {
    setSavedTranscriptions(savedTranscriptions.filter(t => t.id !== id));
  };

  return {
    currentTranscription,
    savedTranscriptions,
    isLoading,
    error,
    processTranscription,
    saveTranscription,
    deleteTranscription,
    setCurrentTranscription
  };
}

export default useTranscription;
