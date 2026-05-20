// HTTP handlers para uploads chunked. Multer recibe cada chunk a un tmp file
// chico (<10MB) y nosotros lo movemos a la posición canónica.

import { initUpload, saveChunk, finalizeUpload, readMeta, purgeStaleUploads, purgeUserUploads } from './service.js';

export async function initHandler(req, res) {
  try {
    // Si este usuario tenía uploads previos sin finalizar, son intent muerto:
    // los borramos antes de aceptar el nuevo. Crítico con disco chico (1GB):
    // un intento abortado deja ~562MB de chunks que comen el espacio para el retry.
    try {
      const removed = purgeUserUploads(req.user.id);
      if (removed > 0) console.log(`[uploads] purged ${removed} upload(s) previo(s) de user=${req.user.id}`);
    } catch {}
    // Y también limpieza global por TTL (otros usuarios olvidados)
    try {
      const removed = purgeStaleUploads(30 * 60 * 1000); // 30min TTL global
      if (removed > 0) console.log(`[uploads] purged ${removed} upload(s) huérfano(s) global`);
    } catch {}

    const { filename, size, totalChunks } = req.body || {};
    const uploadId = initUpload({
      userId: req.user.id,
      filename,
      size: Number(size),
      totalChunks: Number(totalChunks),
    });
    console.log(`[uploads] init · user=${req.user.id} · ${filename} · ${(size / 1024 / 1024).toFixed(1)}MB · ${totalChunks} chunks · id=${uploadId}`);
    res.json({ uploadId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function chunkHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió el chunk' });
    const uploadId = req.body?.uploadId;
    const chunkIndex = Number(req.body?.chunkIndex);
    if (!uploadId || !Number.isInteger(chunkIndex)) {
      return res.status(400).json({ error: 'uploadId y chunkIndex requeridos' });
    }
    const result = saveChunk({
      uploadId,
      chunkIndex,
      tmpPath: req.file.path,
      userId: req.user.id,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

export async function finalizeHandler(req, res) {
  try {
    const { uploadId } = req.body || {};
    if (!uploadId) return res.status(400).json({ error: 'uploadId requerido' });
    const meta = readMeta(uploadId);
    if (!meta) return res.status(404).json({ error: 'upload no encontrado' });
    if (meta.userId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    const result = await finalizeUpload({ uploadId, userId: req.user.id });
    console.log(`[uploads] finalized · user=${req.user.id} · id=${uploadId} · ${(result.size / 1024 / 1024).toFixed(1)}MB`);
    res.json({ uploadId, size: result.size, originalName: result.originalName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
