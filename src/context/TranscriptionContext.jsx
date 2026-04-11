import React, { createContext, useContext, useState, useEffect } from 'react';

const TranscriptionContext = createContext();

export const useTranscriptionContext = () => useContext(TranscriptionContext);

export const TranscriptionProvider = ({ children }) => {
  const [savedTranscriptions, setSavedTranscriptions] = useState([]);
  const [currentTranscription, setCurrentTranscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar transcripciones guardadas desde localStorage al inicio
  useEffect(() => {
    const stored = localStorage.getItem('savedTranscriptions');
    if (stored) {
      try {
        setSavedTranscriptions(JSON.parse(stored));
      } catch (e) {
        console.error('Error parsing saved transcriptions', e);
      }
    }
  }, []);

  // Actualizar localStorage cuando cambien las transcripciones guardadas
  useEffect(() => {
    if (savedTranscriptions.length > 0) {
      localStorage.setItem('savedTranscriptions', JSON.stringify(savedTranscriptions));
    }
  }, [savedTranscriptions]);

  // Procesar una nueva URL para transcripción
  const processTranscription = async (url) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Hacer la petición a nuestro backend
      const response = await fetch('/api/transcribeVideo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al transcribir el video');
      }
      
      const data = await response.json();
      
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

  // Guardar la transcripción actual
  const saveTranscription = () => {
    if (currentTranscription) {
      setSavedTranscriptions(prev => [currentTranscription, ...prev]);
      return true;
    }
    return false;
  };

  // Eliminar una transcripción guardada
  const deleteTranscription = (id) => {
    setSavedTranscriptions(prev => prev.filter(t => t.id !== id));
  };

  // Detectar la plataforma basada en la URL
  const detectPlatform = (url) => {
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    if (url.includes('youtube.com/shorts')) return 'youtube-shorts';
    if (url.includes('youtube.com')) return 'youtube';
    if (url.startsWith('upload://')) return 'upload';
    return 'unknown';
  };

  // Procesar un archivo de video subido
  const processFileTranscription = async (file) => {
    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch('/api/transcribeUpload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al transcribir el archivo');
      }

      const data = await response.json();

      const newTranscription = {
        id: Date.now().toString(),
        url: `upload://${file.name}`,
        platform: 'upload',
        text: data.transcript,
        createdAt: new Date().toISOString(),
        title: data.title || file.name,
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

  const value = {
    savedTranscriptions,
    currentTranscription,
    isLoading,
    error,
    processTranscription,
    processFileTranscription,
    saveTranscription,
    deleteTranscription,
    setCurrentTranscription
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
};