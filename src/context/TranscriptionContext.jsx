import React, { createContext, useContext, useState, useEffect } from 'react';
import { authFetch } from './AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const TranscriptionContext = createContext();

export const useTranscriptionContext = () => useContext(TranscriptionContext);

export const TranscriptionProvider = ({ children }) => {
  const [savedTranscriptions, setSavedTranscriptions] = useState([]);
  const [currentTranscription, setCurrentTranscription] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTranscriptions = async () => {
    try {
      const response = await authFetch(`${API_BASE}/transcriptions`);
      if (response.ok) {
        const data = await response.json();
        setSavedTranscriptions(data);
        return data;
      }
    } catch (e) {
      console.error('Error al cargar transcripciones:', e);
    }
    return null;
  };

  // Aplica los campos de análisis a la transcripción actual y a la lista guardada.
  // Se llama desde VideoAnalysisPanel tras recibir respuesta del endpoint /analyze.
  const applyAnalysisToTranscription = (id, { analysis, analysisModel, analysisAt }) => {
    setCurrentTranscription((cur) =>
      cur && (cur.id === id || cur.id == id)
        ? { ...cur, analysis, analysisModel, analysisAt }
        : cur
    );
    setSavedTranscriptions((prev) =>
      prev.map((t) => (t.id === id || t.id == id ? { ...t, analysis, analysisModel, analysisAt } : t))
    );
  };

  useEffect(() => {
    // Solo cargar si hay token
    if (localStorage.getItem('token')) {
      fetchTranscriptions();
    }
  }, []);

  const processTranscription = async (url) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await authFetch(`${API_BASE}/transcribeVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al transcribir el video');
      }

      const data = await response.json();

      // Tras fetchTranscriptions(), la versión guardada (con id real de DB) ya está disponible.
      // Para no introducir lag visual, construimos newTranscription con la metadata extendida
      // que el endpoint ya devuelve (engagement, uploader, description, hashtags).
      const newTranscription = {
        id: data.id || null,
        url,
        platform: detectPlatform(url),
        text: data.transcript,
        createdAt: new Date().toISOString(),
        title: data.title || 'Sin título',
        duration: data.duration ?? null,
        channel: data.channel ?? null,
        thumbnail: data.thumbnail ?? null,
        viewCount: data.viewCount ?? null,
        likeCount: data.likeCount ?? null,
        commentCount: data.commentCount ?? null,
        shareCount: data.shareCount ?? null,
        uploaderHandle: data.uploaderHandle ?? null,
        uploaderUrl: data.uploaderUrl ?? null,
        uploadDate: data.uploadDate ?? null,
        description: data.description ?? null,
        hashtags: data.hashtags ?? null,
        usageInfo: data.usageInfo ?? null,
      };

      setCurrentTranscription(newTranscription);
      const refreshed = await fetchTranscriptions();
      // Reemplazar currentTranscription con la versión de DB (que ya tiene id real)
      // matcheando por url + created_at más reciente.
      if (Array.isArray(refreshed) && refreshed.length > 0) {
        const dbRow = refreshed.find((t) => t.url === url);
        if (dbRow) setCurrentTranscription({ ...dbRow, text: dbRow.text });
      }
      return newTranscription;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const processFileTranscription = async (file) => {
    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('video', file);

      const response = await authFetch(`${API_BASE}/transcribeUpload`, {
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

  const deleteTranscription = async (id) => {
    try {
      const response = await authFetch(`${API_BASE}/transcriptions/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSavedTranscriptions(prev => prev.filter(t => t.id !== id));
      }
    } catch (e) {
      console.error('Error al eliminar transcripción:', e);
    }
  };

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
    setCurrentTranscription,
    fetchTranscriptions,
    applyAnalysisToTranscription
  };

  return (
    <TranscriptionContext.Provider value={value}>
      {children}
    </TranscriptionContext.Provider>
  );
};
