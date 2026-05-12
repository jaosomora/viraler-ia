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

export const getAdminUsers = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/users`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al obtener usuarios');
  return await response.json();
};

export const getAdminClips = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/clips`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al obtener clips');
  return await response.json();
};

export const getAdminReels = async () => {
  const response = await fetch(`${API_BASE_URL}/admin/reels`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Error al obtener reels');
  return await response.json();
};

export const setUserAccess = async (userId, expiresAt) => {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/access`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ expiresAt: expiresAt ?? null })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Error al actualizar acceso');
  }
  return await response.json();
};

export const resetUserPassword = async (userId, password) => {
  const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(password ? { password } : {})
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Error al resetear contraseña');
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
