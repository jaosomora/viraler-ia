// src/services/musicApi.js
import { API_BASE_URL } from './api';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export async function listMusicTracks({ query = '', tags = [] } = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (tags.length) params.set('tags', tags.join(','));
  const r = await fetch(`${API_BASE_URL}/music/tracks?${params}`, { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function getMusicTags() {
  const r = await fetch(`${API_BASE_URL}/music/tags`, { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function uploadMusicTrack(file, meta, onProgress) {
  const token = localStorage.getItem('token');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('audio', file);
    if (meta.name) fd.append('name', meta.name);
    if (meta.artist) fd.append('artist', meta.artist);
    if (meta.source) fd.append('source', meta.source);
    if (meta.license) fd.append('license', meta.license);
    if (meta.bpm) fd.append('bpm', String(meta.bpm));
    if (meta.tags) fd.append('tags', JSON.stringify(meta.tags));
    xhr.open('POST', `${API_BASE_URL}/music/tracks`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Error subiendo el track'));
      } catch { reject(new Error('Respuesta inválida')); }
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.send(fd);
  });
}

export async function deleteMusicTrack(id) {
  const r = await fetch(`${API_BASE_URL}/music/tracks/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export function streamUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/music/tracks/${id}/stream?token=${encodeURIComponent(token || '')}`;
}

export async function curateMusic({ activeTags = [] } = {}) {
  const r = await fetch(`${API_BASE_URL}/music/curate`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ activeTags }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function getMusicProviders() {
  const r = await fetch(`${API_BASE_URL}/music/providers`, { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}
