import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  initUpload, saveChunk, finalizeUpload, readMeta, cleanupUpload, purgeStaleUploads
} from './service.js';

// El service usa /opt/data/uploads-tmp en prod y data/uploads-tmp en dev.
// Acá NODE_ENV no es 'production', así que escribe en data/uploads-tmp del cwd.
const ROOT = path.resolve(process.cwd(), 'data/uploads-tmp');

function writeTmpChunk(content) {
  const p = path.join(os.tmpdir(), `chunk-${Date.now()}-${Math.random()}.bin`);
  fs.writeFileSync(p, content);
  return p;
}

describe('uploads/service', () => {
  describe('initUpload', () => {
    it('valida filename, size, totalChunks', () => {
      expect(() => initUpload({ userId: 1, filename: '', size: 100, totalChunks: 1 }))
        .toThrow(/filename/);
      expect(() => initUpload({ userId: 1, filename: 'x.mp4', size: 0, totalChunks: 1 }))
        .toThrow(/size/);
      expect(() => initUpload({ userId: 1, filename: 'x.mp4', size: 100, totalChunks: 0 }))
        .toThrow(/totalChunks/);
    });

    it('rechaza extensiones no-video', () => {
      expect(() => initUpload({ userId: 1, filename: 'x.exe', size: 100, totalChunks: 1 }))
        .toThrow(/Extensión/);
      expect(() => initUpload({ userId: 1, filename: 'x.pdf', size: 100, totalChunks: 1 }))
        .toThrow(/Extensión/);
    });

    it('crea meta.json con uploadId aleatorio', () => {
      const id1 = initUpload({ userId: 5, filename: 'a.mp4', size: 1000, totalChunks: 2 });
      const id2 = initUpload({ userId: 5, filename: 'a.mp4', size: 1000, totalChunks: 2 });
      expect(id1).not.toBe(id2);
      const meta = readMeta(id1);
      expect(meta.userId).toBe(5);
      expect(meta.filename).toBe('a.mp4');
      expect(meta.ext).toBe('mp4');
      expect(meta.totalChunks).toBe(2);
      cleanupUpload(id1);
      cleanupUpload(id2);
    });
  });

  describe('saveChunk + finalizeUpload', () => {
    it('rechaza chunk de otro usuario', () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 10, totalChunks: 1 });
      const tmp = writeTmpChunk(Buffer.from('hello\n'));
      expect(() => saveChunk({ uploadId: id, chunkIndex: 0, tmpPath: tmp, userId: 999 }))
        .toThrow(/otro usuario/);
      cleanupUpload(id);
    });

    it('rechaza chunkIndex fuera de rango', () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 10, totalChunks: 2 });
      const tmp = writeTmpChunk(Buffer.from('hi'));
      expect(() => saveChunk({ uploadId: id, chunkIndex: 5, tmpPath: tmp, userId: 1 }))
        .toThrow(/fuera de rango/);
      cleanupUpload(id);
    });

    it('concatena chunks en orden y valida tamaño final', async () => {
      const parts = [Buffer.from('AAA'), Buffer.from('BBB'), Buffer.from('CC')];
      const total = parts.reduce((s, p) => s + p.length, 0);
      const id = initUpload({ userId: 1, filename: 'demo.mp4', size: total, totalChunks: parts.length });
      // Subir en orden inverso para verificar que finalize ordena por índice
      for (const i of [2, 0, 1]) {
        const tmp = writeTmpChunk(parts[i]);
        saveChunk({ uploadId: id, chunkIndex: i, tmpPath: tmp, userId: 1 });
      }
      const result = await finalizeUpload({ uploadId: id, userId: 1 });
      expect(fs.readFileSync(result.path, 'utf8')).toBe('AAABBBCC');
      expect(result.size).toBe(total);
      expect(result.originalName).toBe('demo.mp4');
      cleanupUpload(id);
    });

    it('finalize falla si falta un chunk', async () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 6, totalChunks: 2 });
      const tmp = writeTmpChunk(Buffer.from('ABC'));
      saveChunk({ uploadId: id, chunkIndex: 0, tmpPath: tmp, userId: 1 });
      // Falta chunk 1
      await expect(finalizeUpload({ uploadId: id, userId: 1 }))
        .rejects.toThrow(/falta chunk 1/);
      cleanupUpload(id);
    });

    it('finalize es idempotente si ya existe final', async () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 3, totalChunks: 1 });
      const tmp = writeTmpChunk(Buffer.from('XYZ'));
      saveChunk({ uploadId: id, chunkIndex: 0, tmpPath: tmp, userId: 1 });
      const r1 = await finalizeUpload({ uploadId: id, userId: 1 });
      const r2 = await finalizeUpload({ uploadId: id, userId: 1 });
      expect(r1.path).toBe(r2.path);
      cleanupUpload(id);
    });
  });

  describe('purgeStaleUploads', () => {
    it('borra uploads cuyo createdAt es más viejo que el TTL', () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 5, totalChunks: 1 });
      // Reescribir meta con timestamp viejo (2 días atrás)
      const meta = readMeta(id);
      meta.createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(path.join(ROOT, id, 'meta.json'), JSON.stringify(meta));
      const removed = purgeStaleUploads(24 * 60 * 60 * 1000); // 24h TTL
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(fs.existsSync(path.join(ROOT, id))).toBe(false);
    });

    it('preserva uploads recientes', () => {
      const id = initUpload({ userId: 1, filename: 'x.mp4', size: 5, totalChunks: 1 });
      purgeStaleUploads(24 * 60 * 60 * 1000);
      expect(fs.existsSync(path.join(ROOT, id))).toBe(true);
      cleanupUpload(id);
    });
  });
});
