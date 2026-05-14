// src/services/reelsApi.js
import { API_BASE_URL } from './api';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function uploadReel(file, title, onProgress) {
  const token = localStorage.getItem('token');
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('video', file);
    if (title) fd.append('title', title);
    xhr.open('POST', `${API_BASE_URL}/reels/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || 'Error subiendo el video'));
      } catch { reject(new Error('Respuesta inválida del servidor')); }
    };
    xhr.onerror = () => reject(new Error('Error de red'));
    xhr.send(fd);
  });
}

export async function listReelJobs() {
  const r = await fetch(`${API_BASE_URL}/reels/jobs`, { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function getReelJob(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function applyCuts(id, cuts) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/apply-cuts`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ cuts }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error aplicando cortes');
  return r.json();
}

export async function updateReelTitle(id, title) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/title`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title }),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function updateReelStyle(id, patch) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/style`, {
    method: 'PATCH',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function renderReelPreview(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/render-preview`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function finalizeReel(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/finalize`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function continueToMusic(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/continue-to-music`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function reopenStyle(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/reopen-style`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function updateMusic(id, patch) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/music`, {
    method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function mixMusic(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/mix-music`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

/**
 * Pide 10s de audio mp3 con el procesamiento de voz aplicado.
 * Devuelve un Blob URL listo para usar como src de <audio>.
 * El caller debe URL.revokeObjectURL() cuando el audio se reemplace/desmonte.
 */
export async function fetchVoiceSample(id, { startSec = 0, autolevel, gainDb } = {}) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/voice-sample`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ startSec, autolevel, gainDb }),
  });
  if (!r.ok) {
    let msg = 'Error generando muestra';
    try { msg = (await r.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  const blob = await r.blob();
  return URL.createObjectURL(blob);
}

export async function suggestMusic(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/suggest-music`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export function outputWithMusicUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/reels/jobs/${id}/output-with-music?token=${encodeURIComponent(token || '')}`;
}

export async function reopenSilences(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}/reopen-silences`, {
    method: 'POST', headers: authHeaders(),
  });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export async function deleteReelJob(id) {
  const r = await fetch(`${API_BASE_URL}/reels/jobs/${id}`, { method: 'DELETE', headers: authHeaders() });
  if (!r.ok) throw new Error((await r.json()).error || 'Error');
  return r.json();
}

export function sourceVideoUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/reels/jobs/${id}/source-video?token=${encodeURIComponent(token || '')}`;
}

export function baseVideoUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/reels/jobs/${id}/base-video?token=${encodeURIComponent(token || '')}`;
}

export function outputVideoUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/reels/jobs/${id}/output?token=${encodeURIComponent(token || '')}`;
}

export function downloadUrl(id) {
  const token = localStorage.getItem('token');
  return `${API_BASE_URL}/reels/jobs/${id}/download?token=${encodeURIComponent(token || '')}`;
}
