// api/reels/routes.js
// Handlers HTTP para AS Reels Cleaner. Auth ya aplicada por el middleware del server.
import fs from 'fs';
import {
  createJob, processJobUntilReview, applyCutsAndRenderBase,
  updateStyle, renderPreview, finalize, reopenSilenceReview,
  continueToMusicReview, reopenStyleReview, updateMusic, renderMusicMix, suggestMusic,
  generateVoiceSample,
  getJobForUser, listJobsForUser, deleteJob,
} from './reelsService.js';
import path from 'path';
import db from '../database/schema.js';

const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});

export async function uploadHandler(req, res) {
  try {
    let sourceFilename = null;
    let originalName = null;

    if (req.body?.uploadId) {
      // Modo chunked (default desde 2026-05-19): el frontend ya subió el archivo
      // en trozos vía /api/uploads/*. Acá solo finalizamos.
      const { finalizeUpload, readMeta } = await import('../uploads/service.js');
      const meta = readMeta(req.body.uploadId);
      if (!meta) return res.status(404).json({ error: 'upload no encontrado' });
      if (meta.userId !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
      const result = await finalizeUpload({ uploadId: req.body.uploadId, userId: req.user.id });
      sourceFilename = result.path;
      originalName = result.originalName;
      console.log(`[reels] using chunked upload · user=${req.user.id} · ${meta.filename} · ${(result.size / 1024 / 1024).toFixed(1)}MB`);
    } else if (req.file) {
      // Compat: upload single-shot multipart (legacy, frágil para >100MB en Render)
      sourceFilename = req.file.path;
      originalName = req.file.originalname;
      const mb = (req.file.size / 1024 / 1024).toFixed(1);
      console.log(`[reels] upload received (legacy single-shot) · user=${req.user.id} · ${req.file.originalname} · ${mb}MB`);
    } else {
      return res.status(400).json({ error: 'Falta uploadId o archivo' });
    }

    const title = req.body?.title || originalName;
    const jobId = await createJob({
      userId: req.user.id,
      sourceFilename,
      title,
    });
    processJobUntilReview(jobId);
    res.json({ jobId });
  } catch (err) {
    console.error('[reels] upload error:', err);
    res.status(500).json({ error: err.message });
  }
}

export async function listJobsHandler(req, res) {
  try { res.json(await listJobsForUser(req.user.id)); }
  catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/admin/reels — todos los reels (solo owner)
export async function adminListJobsHandler(req, res) {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT r.*, u.name AS user_name, u.email AS user_email
         FROM reel_jobs r LEFT JOIN users u ON u.id=r.user_id
         ORDER BY r.created_at DESC LIMIT 200`,
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function getJobHandler(req, res) {
  try {
    const job = await getJobForUser(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: 'Reel no encontrado' });
    res.json(job);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/apply-cuts → Body: { cuts: [{start, end}, ...] }
export async function applyCutsHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });

    const { cuts } = req.body || {};
    if (!Array.isArray(cuts)) return res.status(400).json({ error: 'cuts debe ser un array' });
    const sanitized = cuts
      .filter(c => typeof c?.start === 'number' && typeof c?.end === 'number' && c.end > c.start)
      .map(c => ({ start: c.start, end: c.end }));

    await applyCutsAndRenderBase(req.params.id, sanitized);
    res.json({ ok: true });
  } catch (err) {
    console.error('[reels] apply-cuts error:', err);
    res.status(400).json({ error: err.message });
  }
}

// PATCH /api/reels/jobs/:id/style — actualiza fuente/color/overrides (no re-renderiza)
export async function updateStyleHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await updateStyle(req.params.id, req.body || {});
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/render-preview — re-burnea con estilo/texto actuales
export async function renderPreviewHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await renderPreview(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/finalize — marca como done (re-burnea si dirty)
export async function finalizeHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await finalize(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// PATCH /api/reels/jobs/:id/title — renombrar el reel
export async function updateTitleHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    const title = (req.body?.title || '').toString().trim().slice(0, 200);
    if (!title) return res.status(400).json({ error: 'Título vacío' });
    await new Promise((resolve, reject) =>
      db.run('UPDATE reel_jobs SET title=? WHERE id=?', [title, req.params.id],
        err => err ? reject(err) : resolve())
    );
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/reopen-silences — vuelve a awaiting_review
export async function reopenSilencesHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await reopenSilenceReview(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/continue-to-music — avanza al paso 3
export async function continueToMusicHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await continueToMusicReview(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/reopen-style — vuelve a paso 2
export async function reopenStyleHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await reopenStyleReview(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// PATCH /api/reels/jobs/:id/music — guarda selección/parámetros de música
export async function updateMusicHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await updateMusic(req.params.id, req.body || {});
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/mix-music
export async function mixMusicHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    await renderMusicMix(req.params.id);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/suggest-music
export async function suggestMusicHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    const out = await suggestMusic(req.params.id);
    res.json(out);
  } catch (err) {
    console.error('[reels] suggest-music error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reels/jobs/:id/output-with-music — sirve la mezcla con música si existe
export async function outputWithMusicHandler(req, res) {
  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!job) return res.status(404).json({ error: 'Reel no encontrado' });
    const REELS_ROOT = process.env.NODE_ENV === 'production' ? '/opt/data/reels' : path.resolve(process.cwd(), 'data/reels');
    const mixed = path.join(REELS_ROOT, req.params.id, 'reel_with_music.mp4');
    if (!fs.existsSync(mixed)) return res.status(404).json({ error: 'Mezcla con música no existe' });
    streamVideoWithRange(req, res, mixed);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// POST /api/reels/jobs/:id/voice-sample → Body: { startSec, autolevel, gainDb }
// Genera 10s de mp3 con el procesamiento actual y devuelve el archivo en la misma respuesta.
export async function voiceSampleHandler(req, res) {
  try {
    const job = await get('SELECT user_id FROM reel_jobs WHERE id=?', [req.params.id]);
    if (!job || job.user_id !== req.user.id) return res.status(404).json({ error: 'Reel no encontrado' });
    const { startSec, autolevel, gainDb } = req.body || {};
    const samplePath = await generateVoiceSample(req.params.id, {
      startSec: Number(startSec) || 0,
      autolevel: autolevel === undefined ? undefined : !!autolevel,
      gainDb: gainDb === undefined ? undefined : parseInt(gainDb, 10),
    });
    res.sendFile(samplePath, { dotfiles: 'allow' }, err => {
      if (err && !res.headersSent) res.status(500).json({ error: err.message });
    });
  } catch (err) {
    console.error('[reels] voice-sample error:', err);
    res.status(400).json({ error: err.message });
  }
}

export async function sourceVideoHandler(req, res) {
  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!job || !job.source_video_path || !fs.existsSync(job.source_video_path)) {
      return res.status(404).json({ error: 'Video no encontrado' });
    }
    streamVideoWithRange(req, res, job.source_video_path);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// GET /api/reels/jobs/:id/base-video — video con cortes aplicados pero SIN subs quemados.
// Lo usa el StyleReviewView como capa de fondo para el overlay WYSIWYG.
export async function baseVideoHandler(req, res) {
  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!job || !job.base_video_path || !fs.existsSync(job.base_video_path)) {
      return res.status(404).json({ error: 'Base video no encontrado' });
    }
    streamVideoWithRange(req, res, job.base_video_path);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function outputVideoHandler(req, res) {
  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!job || !job.output_path || !fs.existsSync(job.output_path)) {
      return res.status(404).json({ error: 'Video final no encontrado' });
    }
    streamVideoWithRange(req, res, job.output_path);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function downloadHandler(req, res) {
  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?',
      [req.params.id, req.user.id]);
    if (!job) return res.status(404).json({ error: 'Reel no encontrado' });
    const REELS_ROOT = process.env.NODE_ENV === 'production' ? '/opt/data/reels' : path.resolve(process.cwd(), 'data/reels');
    const mixed = path.join(REELS_ROOT, req.params.id, 'reel_with_music.mp4');
    // Si hay mezcla con música y el usuario no la saltó, esa es la versión final.
    // Si no existe, caemos al output_path (versión solo con subs, sin música).
    // Si tampoco existe, intentamos reconstruir el path canónico desde REELS_ROOT.
    const candidates = [
      (!job.music_skipped && job.music_track_id) ? mixed : null,
      job.output_path,
      path.join(REELS_ROOT, req.params.id, 'reel.mp4'),
      path.join(REELS_ROOT, req.params.id, 'reel_with_music.mp4'),
    ].filter(Boolean);
    const finalPath = candidates.find(p => fs.existsSync(p));
    if (!finalPath) {
      console.warn('[reels] download: ningún archivo existe. Candidates:', candidates,
        'job.output_path:', job.output_path, 'REELS_ROOT:', REELS_ROOT);
      return res.status(404).json({
        error: 'Video final no encontrado',
        debug: { candidates, output_path: job.output_path, root: REELS_ROOT },
      });
    }
    const safeTitle = (job.title || 'reel').replace(/[^a-z0-9\-_]/gi, '_').slice(0, 60);
    // dotfiles:'allow' es CRÍTICO en dev: nuestro path pasa por .claude/worktrees/... y la
    // librería 'send' por defecto rechaza cualquier path con segmentos que empiezan con '.'
    // (protección anti-dotfile). Sin esto, da Not Found aunque el archivo exista.
    res.download(finalPath, `${safeTitle}_reel.mp4`, { dotfiles: 'allow' }, err => {
      if (err) {
        console.error('[reels] download send error:', err.message, 'path:', finalPath);
        if (!res.headersSent) res.status(500).json({ error: 'Error enviando archivo', path: finalPath, detail: err.message });
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function deleteJobHandler(req, res) {
  try {
    const result = await deleteJob(req.params.id, req.user.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

function streamVideoWithRange(req, res, videoPath) {
  const stat = fs.statSync(videoPath);
  const total = stat.size;
  const range = req.headers.range;
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = parseInt(m[1], 10);
    const end = m[2] ? parseInt(m[2], 10) : total - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(videoPath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': total, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' });
    fs.createReadStream(videoPath).pipe(res);
  }
}
