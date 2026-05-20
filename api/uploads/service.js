// Servicio de uploads chunked.
//
// Para qué: Render mata las requests HTTP a ~100s. Un POST single-shot de 590MB
// sobre una conexión residencial se cae. La solución es partir el archivo en
// chunks chicos (~5MB) que cada uno cabe sobradamente en el timeout, y
// reensamblar en el server al finalizar.
//
// Layout en disco: /opt/data/uploads-tmp/<uploadId>/
//   meta.json          {userId, filename, size, totalChunks, ext, createdAt}
//   chunk_0.bin, chunk_1.bin, ...
//   final.<ext>        (solo después de finalize)

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const isProd = process.env.NODE_ENV === 'production';
const UPLOADS_ROOT = isProd ? '/opt/data/uploads-tmp' : path.resolve(process.cwd(), 'data/uploads-tmp');

fs.mkdirSync(UPLOADS_ROOT, { recursive: true });

function uploadDir(uploadId) {
  return path.join(UPLOADS_ROOT, uploadId);
}

function metaPath(uploadId) {
  return path.join(uploadDir(uploadId), 'meta.json');
}

export function readMeta(uploadId) {
  try {
    return JSON.parse(fs.readFileSync(metaPath(uploadId), 'utf8'));
  } catch {
    return null;
  }
}

// Crea un upload vacío y devuelve uploadId. El user_id queda fijado al creador
// para que nadie más pueda enviar chunks o finalizar este upload.
export function initUpload({ userId, filename, size, totalChunks }) {
  if (!filename || typeof filename !== 'string') throw new Error('filename requerido');
  if (!Number.isInteger(size) || size <= 0) throw new Error('size inválido');
  if (!Number.isInteger(totalChunks) || totalChunks <= 0) throw new Error('totalChunks inválido');
  // Rechazamos extensiones que no son video conocido (defensa contra subir cualquier cosa)
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  if (!/^(mp4|mov|mkv|webm|m4v|avi)$/.test(ext)) {
    throw new Error('Extensión no soportada. Usa MP4, MOV, MKV, WEBM, M4V, AVI.');
  }
  const uploadId = crypto.randomBytes(12).toString('hex');
  fs.mkdirSync(uploadDir(uploadId), { recursive: true });
  const meta = {
    userId,
    filename,
    size,
    totalChunks,
    ext,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(metaPath(uploadId), JSON.stringify(meta));
  return uploadId;
}

// Guarda un chunk recibido. Multer ya escribió el chunk a un tmp; nosotros lo
// movemos a la posición canónica dentro del uploadDir.
export function saveChunk({ uploadId, chunkIndex, tmpPath, userId }) {
  const meta = readMeta(uploadId);
  if (!meta) throw new Error('upload no encontrado');
  if (meta.userId !== userId) throw new Error('upload pertenece a otro usuario');
  if (chunkIndex < 0 || chunkIndex >= meta.totalChunks) {
    throw new Error(`chunkIndex fuera de rango (0..${meta.totalChunks - 1})`);
  }
  const dest = path.join(uploadDir(uploadId), `chunk_${chunkIndex}.bin`);
  fs.renameSync(tmpPath, dest);
  return { received: chunkIndex };
}

// Verifica que estén todos los chunks y los concatena a final.<ext>.
// Devuelve el path absoluto del archivo final + tamaño + nombre original.
// Es idempotente: si ya existe final.<ext> con el tamaño esperado, lo devuelve.
export async function finalizeUpload({ uploadId, userId }) {
  const meta = readMeta(uploadId);
  if (!meta) throw new Error('upload no encontrado');
  if (meta.userId !== userId) throw new Error('upload pertenece a otro usuario');

  const finalPath = path.join(uploadDir(uploadId), `final.${meta.ext}`);
  if (fs.existsSync(finalPath) && fs.statSync(finalPath).size === meta.size) {
    return { path: finalPath, size: meta.size, originalName: meta.filename };
  }

  // Verificar que estén todos los chunks
  for (let i = 0; i < meta.totalChunks; i++) {
    const p = path.join(uploadDir(uploadId), `chunk_${i}.bin`);
    if (!fs.existsSync(p)) throw new Error(`falta chunk ${i}`);
  }

  // Concatenar en orden con streaming y unlink-as-we-go. Esto mantiene el peak
  // de disco en ~1x el tamaño del archivo (no 2x): cada chunk se borra apenas se
  // copió al final.<ext>. Crítico en discos chicos (1GB en Render starter).
  const out = fs.createWriteStream(finalPath);
  for (let i = 0; i < meta.totalChunks; i++) {
    const p = path.join(uploadDir(uploadId), `chunk_${i}.bin`);
    await new Promise((resolve, reject) => {
      const inp = fs.createReadStream(p);
      inp.on('error', reject);
      inp.on('end', () => {
        try { fs.unlinkSync(p); } catch {}
        resolve();
      });
      inp.pipe(out, { end: false });
    });
  }
  out.end();
  await new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });
  const actualSize = fs.statSync(finalPath).size;
  if (actualSize !== meta.size) {
    throw new Error(`tamaño final ${actualSize} != esperado ${meta.size}`);
  }
  return { path: finalPath, size: meta.size, originalName: meta.filename };
}

// Borra todo el directorio del upload. Llamarlo después de que el job consumió
// el archivo final (clips/reels lo copian a su jobDir y este queda libre).
export function cleanupUpload(uploadId) {
  const dir = uploadDir(uploadId);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// Cleanup de uploads viejos abandonados (chunks subidos pero nunca finalizados).
// Llamado desde el cron de cleanup general. TTL por defecto: 24h.
export function purgeStaleUploads(maxAgeMs = 24 * 60 * 60 * 1000) {
  let removed = 0;
  let entries = [];
  try { entries = fs.readdirSync(UPLOADS_ROOT); } catch { return 0; }
  const now = Date.now();
  for (const id of entries) {
    const meta = readMeta(id);
    if (!meta) {
      // Sin meta = corrupto, lo limpiamos también si el dir es viejo
      try {
        const stat = fs.statSync(uploadDir(id));
        if (now - stat.mtimeMs > maxAgeMs) {
          fs.rmSync(uploadDir(id), { recursive: true, force: true });
          removed++;
        }
      } catch {}
      continue;
    }
    if (now - new Date(meta.createdAt).getTime() > maxAgeMs) {
      cleanupUpload(id);
      removed++;
    }
  }
  return removed;
}
