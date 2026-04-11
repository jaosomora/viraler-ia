import React, { createContext, useContext, useState, useEffect } from 'react';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const TranscriptionContext = createContext();

export const useTranscriptionContext = () => useContext(TranscriptionContext);

export const TranscriptionProvider = ({ children }) => {
  const [savedTranscriptions, setSavedTranscriptions] = useState([]);
  const [currentTranscription, setCurrentTranscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Cargar transcripciones desde el servidor al inicio
  const fetchTranscriptions = async () => {
    try {
      const response = await fetch(`${API_BASE}/transcriptions`);
      if (response.ok) {
        const data = await response.json();
        setSavedTranscriptions(data);
      }
    } catch (e) {
      console.error('Error al cargar transcripciones:', e);
    }
  };

  useEffect(() => {
    fetchTranscriptions();
  }, []);

  // Procesar una nueva URL para transcripción
  const processTranscription = async (url) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/transcribeVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al transcribir el video');
      }

      const data = await response.json();

      const newTranscription = {
        id: data.id || Date.now().toString(),
        url,
        platform: detectPlatform(url),
        text: data.transcript,
        createdAt: new Date().toISOString(),
        title: data.title || 'Sin título'
      };

      setCurrentTranscription(newTranscription);
      // Recargar lista del servidor (la transcripción ya se guardó en SQLite)
      await fetchTranscriptions();
      return newTranscription;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Procesar un archivo de video subido
  const processFileTranscription = async (file) => {
    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('video', file);

      const response = await fetch(`${API_BASE}/transcribeUpload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al transcribir el archivo');
      }

      const data = await response.json();

      const newTranscription = {
        id: data.id || Date.now().toString(),
        url: `upload://${file.name}`,
        platform: 'upload',
        text: data.transcript,
        createdAt: new Date().toISOString(),
        title: data.title || file.name,
      };

      setCurrentTranscription(newTranscription);
      await fetchTranscriptions();
      return newTranscription;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Eliminar una transcripción del servidor
  const deleteTranscription = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/transcriptions/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSavedTranscriptions(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error('Error al eliminar transcripción:', e);
    }
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

  const value = {
    savedTranscriptions,
    currentTranscription,
    isLoading,
    error,
    processTranscription,
    processFileTranscription,
    deleteTranscription,
    setCurrentTranscription
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
};
