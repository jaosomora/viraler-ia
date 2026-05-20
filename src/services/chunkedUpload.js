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

// Indica si vale la pena reintentar este error. 4xx con código específico (auth,
// validación) NO se reintentan. 5xx, network drops y aborts sí.
class ChunkError extends Error {
  constructor(message, { retryable = true, status = 0 } = {}) {
    super(message);
    this.retryable = retryable;
    this.status = status;
  }
}

function postChunkOnce(uploadId, chunkIndex, blob) {
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
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `HTTP ${xhr.status}`;
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch {}
      // 401/403/404 = no tiene sentido reintentar. 400 con validación tampoco.
      const retryable = xhr.status >= 500 || xhr.status === 408 || xhr.status === 429;
      reject(new ChunkError(`chunk ${chunkIndex}: ${msg}`, { retryable, status: xhr.status }));
    };
    xhr.onerror = () => reject(new ChunkError(`chunk ${chunkIndex}: red caída`));
    xhr.onabort = () => reject(new ChunkError(`chunk ${chunkIndex}: subida cancelada`));
    xhr.send(fd);
  });
}

// Retry con backoff exponencial. 562MB / 5MB = 113 chunks; sin retry, un solo
// parpadeo de red mata el upload entero. Con 3 reintentos por chunk y backoff
// (1s, 3s, 9s), absorbemos blips comunes y solo abortamos si el problema persiste.
async function postChunk(uploadId, chunkIndex, blob, maxAttempts = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await postChunkOnce(uploadId, chunkIndex, blob);
      return;
    } catch (err) {
      lastErr = err;
      if (!(err instanceof ChunkError) || !err.retryable || attempt === maxAttempts) {
        throw new Error(`${err.message} (después de ${attempt} intento${attempt > 1 ? 's' : ''})`);
      }
      const delayMs = Math.min(1000 * Math.pow(3, attempt - 1), 15000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
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
