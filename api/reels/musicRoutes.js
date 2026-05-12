// api/reels/musicRoutes.js
// Handlers HTTP del catálogo de música.
import fs from 'fs';
import {
  uploadTrack, listTracks, getTrack, deleteTrack, updateTrack, MUSIC_TAGS,
} from './musicService.js';
import { curateFromJamendo } from './curateService.js';

export async function uploadHandler(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
    const { name, artist, source, license, bpm } = req.body || {};
    let tags = [];
    if (req.body?.tags) {
      try { tags = JSON.parse(req.body.tags); } catch { tags = []; }
    }
    const track = await uploadTrack({
      userId: req.user.id,
      tempPath: req.file.path,
      originalName: req.file.originalname,
      name, artist, tags, source, license, bpm,
    });
    res.json(track);
  } catch (err) {
    console.error('[music] upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function listHandler(req, res) {
  try {
    const query = req.query.q || '';
    const tags = req.query.tags ? req.query.tags.split(',').filter(Boolean) : [];
    const tracks = await listTracks({ query, tags });
    res.json(tracks);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getHandler(req, res) {
  try {
    const t = await getTrack(req.params.id);
    if (!t) return res.status(404).json({ error: 'Track no encontrado' });
    res.json(t);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function deleteHandler(req, res) {
  try {
    const r = await deleteTrack(req.params.id);
    if (!r.success) return res.status(404).json({ error: 'Track no encontrado' });
    res.json(r);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function updateHandler(req, res) {
  try {
    const t = await updateTrack(req.params.id, req.body || {});
    res.json(t);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

export async function tagsHandler(req, res) {
  res.json(MUSIC_TAGS);
}

// POST /api/music/curate — pobla el catálogo con tracks de Jamendo. Async (puede tardar ~30s).
// Body opcional: { activeTags: [...] } para curar solo recetas que cubren esos tags.
export async function curateHandler(req, res) {
  try {
    const activeTags = Array.isArray(req.body?.activeTags) ? req.body.activeTags : [];
    const result = await curateFromJamendo({ userId: req.user.id, activeTags });
    res.json(result);
  } catch (err) {
    console.error('[music] curate error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/music/providers — estado de los providers (qué keys están configuradas)
export async function providersHandler(req, res) {
  res.json({
    jamendo: { configured: !!process.env.JAMENDO_CLIENT_ID, name: 'Jamendo', tracks: '~600K Creative Commons' },
  });
}

// Stream del audio. Para tracks locales sirve con Range. Para remotos (Jamendo, etc.)
// redirige al preview_url — el browser streamea directo del provider sin pasar por nosotros.
export async function streamHandler(req, res) {
  try {
    const t = await getTrack(req.params.id);
    if (!t) return res.status(404).json({ error: 'Track no encontrado' });
    // Remoto: redirige al preview URL
    if (t.external_preview_url && !fs.existsSync(t.file_path || '')) {
      return res.redirect(302, t.external_preview_url);
    }
    if (!t.file_path || !fs.existsSync(t.file_path)) {
      return res.status(404).json({ error: 'Archivo no disponible' });
    }
    const stat = fs.statSync(t.file_path);
    const total = stat.size;
    const range = req.headers.range;
    const ext = (t.file_path.split('.').pop() || 'mp3').toLowerCase();
    const mime = ext === 'wav' ? 'audio/wav' : ext === 'ogg' ? 'audio/ogg' : 'audio/mpeg';
    if (range) {
      const m = /bytes=(\d+)-(\d*)/.exec(range);
      const start = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : total - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mime,
      });
      fs.createReadStream(t.file_path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { 'Content-Length': total, 'Content-Type': mime, 'Accept-Ranges': 'bytes' });
      fs.createReadStream(t.file_path).pipe(res);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
}
