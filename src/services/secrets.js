// src/services/secrets.js
import { API_BASE_URL } from './api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

// Públicas
export const getPublicDelivery = async (token) => {
  const res = await fetch(`${API_BASE_URL}/secrets/public/${token}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
};

export const submitPublicDelivery = async (token, payload) => {
  const res = await fetch(`${API_BASE_URL}/secrets/public/${token}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al enviar');
  return data;
};

// Admin
export const createDelivery = async ({ clientName, description }) => {
  const res = await fetch(`${API_BASE_URL}/secrets/deliveries`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ clientName, description })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear sobre');
  return data;
};

export const listDeliveries = async () => {
  const res = await fetch(`${API_BASE_URL}/secrets/deliveries`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Error al listar sobres');
  return await res.json();
};

export const revealDelivery = async (id) => {
  const res = await fetch(`${API_BASE_URL}/secrets/deliveries/${id}/reveal`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al revelar');
  return data;
};

export const deleteDelivery = async (id) => {
  const res = await fetch(`${API_BASE_URL}/secrets/deliveries/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Error al eliminar');
  }
  return await res.json();
};
