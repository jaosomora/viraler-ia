// HTTP handlers para uploads chunked. Multer recibe cada chunk a un tmp file
// chico (<10MB) y nosotros lo movemos a la posición canónica.

import { initUpload, saveChunk, finalizeUpload, readMeta, purgeStaleUploads } from './service.js';

export async function initHandler(req, res) {
  try {
    // Defensive purge: cada init limpia uploads huérfanos >1h antes de aceptar
    // el nuevo. Mantiene el disco bajo control en Render starter (1GB).
    try {
      const removed = purgeStaleUploads(60 * 60 * 1000);
      if (removed > 0) console.log(`[uploads] purged ${removed} upload(s) huérfano(s) en init`);
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
