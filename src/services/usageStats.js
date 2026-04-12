// src/services/usageStats.js
import { API_BASE_URL } from './api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const getUsageStats = async () => {
  const response = await fetch(`${API_BASE_URL}/usage-stats`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error('Error al obtener estadísticas de uso');
  }

  return await response.json();
};

export const resetUsageStats = async (keepHistory = false) => {
  const response = await fetch(`${API_BASE_URL}/usage-stats/reset`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ keepHistory }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al reiniciar estadísticas');
  }

  return await response.json();
};

export const getAdminTranscriptions = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/transcriptions`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error('Error al obtener transcripciones');
  }

  return await response.json();
};

export const getAdminConversions = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/conversions`, {
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    throw new Error('Error al obtener conversiones');
  }

  return await response.json();
};

export const deleteHistoryEntry = async (date) => {
  const response = await fetch(`${API_BASE_URL}/usage-stats/history/${date}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al eliminar registro');
  }

  return await response.json();
};
