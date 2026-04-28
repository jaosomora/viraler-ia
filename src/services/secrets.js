// src/services/secrets.js
import { API_BASE_URL } from './api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const createSecret = async ({ title, content }) => {
  const res = await fetch(`${API_BASE_URL}/secrets`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear secreto');
  return data;
};

export const listSecrets = async () => {
  const res = await fetch(`${API_BASE_URL}/secrets`, { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al listar');
  }
  return await res.json();
};

export const revealSecret = async (token) => {
  const res = await fetch(`${API_BASE_URL}/secrets/${token}`, { headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al leer');
  return data;
};

export const deleteSecret = async (id) => {
  const res = await fetch(`${API_BASE_URL}/secrets/${id}`, {
    method: 'DELETE',
    headers: authHeaders()
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error al eliminar');
  }
  return await res.json();
};
