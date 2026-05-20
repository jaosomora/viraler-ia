// Cliente de upload chunked. Parte el archivo en trozos de 5MB y los sube
// secuencialmente al backend. Cada chunk es un POST chico (~5s sobre conexión
// hogareña típica) que cabe sobradamente en cualquier timeout de proxy.
//
// Uso:
//   const { uploadId } = await chunkedUpload(file, ({ pct, loaded, total }) => {
//     console.log(`${Math.round(pct * 100)}% (${loaded}/${total} bytes)`);
//   });
//
// Devuelve { uploadId } cuando finaliza. Llamar al endpoint que consume el
// upload (ej. POST /api/clips/generate con {uploadId, options}) después.

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const API_BASE = '/api';

function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function postChunk(uploadId, chunkIndex, blob) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append('uploadId', uploadId);
    fd.append('chunkIndex', String(chunkIndex));
    fd.append('chunk', blob);
    xhr.open('POST', `${API_BASE}/uploads/chunk`);
    const token = localStorage.getItem('token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else {
        let msg = `chunk ${chunkIndex} falló (HTTP ${xhr.status})`;
        try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error(`Red caída al subir chunk ${chunkIndex}`));
    xhr.onabort = () => reject(new Error(`Subida cancelada en chunk ${chunkIndex}`));
    xhr.send(fd);
  });
}

export async function chunkedUpload(file, onProgress) {
  if (!file) throw new Error('file requerido');
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  const { uploadId } = await postJson(`${API_BASE}/uploads/init`, {
    filename: file.name,
    size: file.size,
    totalChunks,
  });

  let loaded = 0;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const blob = file.slice(start, end);
    await postChunk(uploadId, i, blob);
    loaded = end;
    if (onProgress) onProgress({ loaded, total: file.size, pct: loaded / file.size });
  }

  await postJson(`${API_BASE}/uploads/finalize`, { uploadId });
  return { uploadId };
}
