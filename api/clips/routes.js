// api/clips/routes.js
// Handlers HTTP para los endpoints de AS Clips. Wire en server.js.
import fs from 'fs';
import path from 'path';
import {
  createJob, processJob, resumeManualJob, reopenJobForSelection,
  validateAndSnapManualRanges, ManualRangesValidationError,
  getJobWithClips, listUserJobs, listAllJobs,
  updateClip, regenerateClipMp4, exportClipMp4, ensureClipBase,
  deleteJob, addCostToJob, STAGES,
} from './clipsService.js';
import { regeneratePostCaption } from './highlightService.js';
import { FONT_CATALOG } from './subtitleGenerator.js';
import { getCaptionChunks, loadWhisperJson } from './captionsService.js';
import db from '../database/schema.js';

const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});

// POST /api/clips/generate { url, options } o multipart con file + options JSON
export async function generateHandler(req, res) {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const { url, uploadId } = body;
    let sourceFilename = null;

    // Modo chunked: el frontend ya subió el archivo en trozos vía /api/uploads/*
    // y solo nos pasa el uploadId. Finalizamos (concatena chunks) y obtenemos
    // el path al archivo final reensamblado en /opt/data/uploads-tmp/<id>/final.<ext>
    if (uploadId) {
      const { finalizeUpload, readMeta } = await import('../uploads/service.js');
      const meta = readMeta(uploadId);
      if (!meta) return res.status(404).json({ error: 'upload no encontrado' });
      if (meta.userId !== userId) return res.status(403).json({ error: 'No autorizado' });
      const result = await finalizeUpload({ uploadId, userId });
      sourceFilename = result.path;
      console.log(`[clips] using chunked upload · user=${userId} · ${meta.filename} · ${(result.size / 1024 / 1024).toFixed(1)}MB`);
    }

    if (!url && !sourceFilename) {
      return res.status(400).json({ error: 'Falta url o uploadId' });
    }

    // Parse options (JSON string si vino multipart, objeto si vino JSON)
    let options = {};
    if (body.options) {
      try { options = typeof body.options === 'string' ? JSON.parse(body.options) : body.options; }
      catch { options = {}; }
    } else {
      // Fallback: campos sueltos top-level
      const { clipCount, defaultResolution, aspectRatio, fontPresetMode, fontHook, fontCaption, fontKeyword } = body;
      options = { clipCount, defaultResolution, aspectRatio, fontPresetMode, fontHook, fontCaption, fontKeyword };
    }

    const jobId = await createJob({ userId, sourceUrl: url || null, sourceFilename, options });
    res.json({ success: true, jobId });

    setImmediate(() => processJob(jobId));
  } catch (err) {
    console.error('[clips] generate error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/jobs/:id/submit-ranges
// Body: { ranges: [{start: number, end: number}] }
// El job debe estar en status='awaiting_selection' (modo manual). Dispara resumeManualJob async.
export async function submitRangesHandler(req, res) {
  try {
    const jobId = req.params.id;
    const { ranges } = req.body || {};

    const job = await get(
      'SELECT id, user_id, status, mode FROM clip_jobs WHERE id=?',
      [jobId]
    );
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (job.mode !== 'manual') {
      return res.status(400).json({ error: 'Este job no es de modo manual' });
    }
    if (job.status !== 'awaiting_selection') {
      return res.status(409).json({ error: `Job no está esperando selección (status=${job.status})` });
    }
    if (!Array.isArray(ranges) || ranges.length === 0) {
      return res.status(400).json({ error: 'ranges requerido (array no vacío de {start,end})' });
    }
    if (ranges.length > 20) {
      return res.status(400).json({ error: 'Máximo 20 rangos por job' });
    }

    // Validamos SINCRÓNICAMENTE (snap + duración) antes de responder.
    // Si todos los rangos son inválidos → 400 con mensaje específico y el job se queda en
    // awaiting_selection (el usuario corrige y reintenta sin perder transcript).
    let validated;
    try {
      validated = await validateAndSnapManualRanges(jobId, ranges);
    } catch (err) {
      if (err instanceof ManualRangesValidationError) {
        return res.status(400).json({ error: err.message, details: err.details });
      }
      throw err;
    }

    res.json({ success: true, jobId, received: validated.validRanges.length, dropped: validated.dropped.length });

    // Dispara el resume async con los rangos ya validados (no bloquea la respuesta, no re-valida)
    setImmediate(() => resumeManualJob(jobId, validated));
  } catch (err) {
    console.error('[clips] submitRanges error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/jobs/:id — status + clips
export async function getJobHandler(req, res) {
  try {
    const job = await getJobWithClips(req.params.id, req.user.id);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/jobs — lista del usuario
export async function listJobsHandler(req, res) {
  try {
    const jobs = await listUserJobs(req.user.id);
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/jobs/:id/source-video
// Sirve el source.mp4 completo del job con soporte de Range requests (HTTP 206).
// Crítico para que el <video> tag pueda hacer seek sin bajar el archivo entero.
// Lo usa la pantalla de selección manual para que el usuario reproduzca y escuche
// el video mientras marca fragmentos en el transcript.
export async function getSourceVideoHandler(req, res) {
  try {
    const jobId = req.params.id;
    const job = await get(
      'SELECT id, user_id, source_video_path FROM clip_jobs WHERE id=?',
      [jobId]
    );
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!job.source_video_path || !fs.existsSync(job.source_video_path)) {
      return res.status(404).json({ error: 'Video fuente no disponible' });
    }

    const stat = fs.statSync(job.source_video_path);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse: "bytes=0-1023" o "bytes=1024-"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'private, max-age=3600',
      });
      fs.createReadStream(job.source_video_path, { start, end }).pipe(res);
    } else {
      // Petición sin Range: stream completo (con Accept-Ranges para que el browser pida Range después)
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
      });
      fs.createReadStream(job.source_video_path).pipe(res);
    }
  } catch (err) {
    console.error('[clips] getSourceVideo error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/jobs/:id/reopen-for-selection
// Reabre un job done para que el usuario agregue más fragmentos manuales.
// Reutiliza whisper.json + source.mp4 — no re-transcribe ni re-descarga.
export async function reopenForSelectionHandler(req, res) {
  try {
    const jobId = req.params.id;
    const result = await reopenJobForSelection(jobId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[clips] reopenForSelection error:', err);
    res.status(400).json({ error: err.message });
  }
}

// GET /api/clips/jobs/:id/transcript — devuelve whisper.json completo (segments + words con timestamps).
// Solo aplicable cuando el job ya transcribió (status >= awaiting_selection o done).
// Lo usa el frontend en la pantalla de selección manual para que el usuario marque rangos.
export async function getTranscriptHandler(req, res) {
  try {
    const jobId = req.params.id;
    const job = await get(
      'SELECT id, user_id, status, whisper_json_path, title, duration_seconds, thumbnail FROM clip_jobs WHERE id=?',
      [jobId]
    );
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!job.whisper_json_path || !fs.existsSync(job.whisper_json_path)) {
      return res.status(404).json({ error: 'Transcript no disponible aún' });
    }
    const whisper = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
    res.json({
      title: job.title,
      duration: job.duration_seconds,
      thumbnail: job.thumbnail,
      segments: whisper.segments || [],
      words: whisper.words || [],
    });
  } catch (err) {
    console.error('[clips] getTranscript error:', err);
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/clips/:id — guardar edits del editor
export async function updateClipHandler(req, res) {
  try {
    await updateClip(req.params.id, req.user.id, req.body || {});
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/clips/:id/captions — chunks sincronizados (relativos al inicio del clip) con overrides aplicados.
// El frontend los renderiza encima del base.mp4 en el preview, sin tocar ffmpeg.
export async function captionsHandler(req, res) {
  try {
    const clipId = req.params.id;
    const clip = await get(
      `SELECT c.*, j.user_id, j.whisper_json_path FROM clips c
       JOIN clip_jobs j ON j.id = c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const transcript = loadWhisperJson(clip.whisper_json_path);
    const chunks = getCaptionChunks(clip, transcript);
    res.json({ chunks, render_mode: clip.render_mode || 'overlay' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/:id/source-thumbnail
// Devuelve un frame JPG del SOURCE video (sin crop) al midpoint del clip.
// Lo usa el editor para preview en vivo mientras arrastrás el slider de encuadre:
// es la única forma de mostrar "qué pasaría si el crop estuviera en X%" sin re-renderizar
// el base.mp4 cada vez. Cacheado en disco junto al base.
export async function sourceThumbnailHandler(req, res) {
  try {
    const clipId = req.params.id;
    const clip = await get(
      `SELECT c.id, c.job_id, c.start_seconds, c.end_seconds, j.user_id, j.source_video_path
       FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (!clip.source_video_path || !fs.existsSync(clip.source_video_path)) {
      return res.status(404).json({ error: 'Source no disponible' });
    }
    const jobDir = path.dirname(clip.source_video_path);
    const thumbPath = path.join(jobDir, `${clipId}_source_thumb.jpg`);
    if (!fs.existsSync(thumbPath)) {
      const midpoint = (clip.start_seconds + clip.end_seconds) / 2;
      const { spawn } = await import('child_process');
      const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg';
      await new Promise((resolve, reject) => {
        const p = spawn(ffmpeg, [
          '-y', '-ss', String(midpoint), '-i', clip.source_video_path,
          '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', thumbPath,
        ]);
        let err = '';
        p.stderr.on('data', d => { err += d.toString(); });
        p.on('close', code => code === 0 && fs.existsSync(thumbPath) ? resolve() : reject(new Error(err.slice(-500))));
      });
    }
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400'); // 1 día: el source no cambia
    fs.createReadStream(thumbPath).pipe(res);
  } catch (err) {
    console.error('[clips] source-thumbnail error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/:id/base-video?resolution=1080
// Sirve el MP4 sin subs (capa de fondo del editor). Genera el base si falta o si los params cambiaron.
export async function baseVideoHandler(req, res) {
  try {
    const clipId = req.params.id;
    const resolution = String(req.query.resolution || '1080');
    const clip = await get(
      `SELECT c.*, j.user_id FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    if (clip.render_mode === 'burned-legacy') {
      return res.status(409).json({ error: 'Clip legacy: usa /download para el MP4 con subs quemados' });
    }
    const basePath = await ensureClipBase(clipId, resolution);
    res.setHeader('Content-Type', 'video/mp4');
    // no-store: el base.mp4 cambia cada vez que el usuario edita params (crop_x_pct,
    // start/end, camera_motion, transition, aspect). Cachearlo provoca ver el render
    // viejo aunque el backend ya generó el nuevo. Sin caché es la opción correcta.
    res.setHeader('Cache-Control', 'no-store');
    fs.createReadStream(basePath).pipe(res);
  } catch (err) {
    console.error('[clips] base-video error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/:id/export?resolution=1080 — quema subs sobre el base.mp4 y devuelve el MP4 final.
export async function exportClipHandler(req, res) {
  try {
    const clipId = req.params.id;
    const resolution = String(req.query.resolution || req.body?.resolution || '1080');
    const clip = await get(
      `SELECT c.*, j.user_id FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    const outPath = await exportClipMp4(clipId, resolution);
    const filename = `${clip.title || 'clip'}_${clipId}.mp4`.replace(/[^\w\d.-]/g, '_');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(outPath).pipe(res);
  } catch (err) {
    console.error('[clips] export error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/:id/download?resolution=1080
// Compat: si es legacy, devuelve el output_path quemado; si es overlay, hace export on-demand.
export async function downloadClipHandler(req, res) {
  try {
    const clipId = req.params.id;
    const resolution = String(req.query.resolution || '1080');

    const clip = await get(
      `SELECT c.*, j.user_id, j.title as job_title FROM clips c
       JOIN clip_jobs j ON j.id = c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }

    let outPath = clip.output_path;
    const expectedRes = clip.output_resolution;
    const needsRegen = !outPath || !fs.existsSync(outPath) || expectedRes !== resolution;
    if (needsRegen) {
      outPath = await regenerateClipMp4(clipId, resolution);
    }

    const filename = `${clip.title || 'clip'}_${clipId}.mp4`.replace(/[^\w\d.-]/g, '_');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(outPath).pipe(res);
  } catch (err) {
    console.error('[clips] download error:', err);
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/:id/regenerate-caption { tone: 'pregunta' | 'storytelling' | 'insight' }
export async function regenerateCaptionHandler(req, res) {
  try {
    const clipId = req.params.id;
    const tone = (req.body && req.body.tone) || 'pregunta';
    const clip = await get(
      `SELECT c.*, j.user_id FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const { postCaption, costUsd } = await regeneratePostCaption(clip, tone);
    // Actualizar también el cache del tono específico
    let cache = {};
    try { cache = clip.post_captions_cache ? JSON.parse(clip.post_captions_cache) : {}; } catch {}
    cache[tone] = postCaption;
    await updateClip(clipId, req.user.id, {
      post_caption: postCaption,
      post_caption_tone: tone,
      post_captions_cache: cache,
    });
    await addCostToJob(clip.job_id, costUsd);
    res.json({ post_caption: postCaption, tone });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/clips/jobs/:id
export async function deleteJobHandler(req, res) {
  try {
    const isOwner = req.user.role === 'owner';
    await deleteJob(req.params.id, req.user.id, isOwner);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/admin/clips
export async function adminListJobsHandler(req, res) {
  try {
    const jobs = await listAllJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/fonts — catálogo de fuentes para el form/editor
export function fontsHandler(req, res) {
  res.json({
    catalog: FONT_CATALOG,
    auto: { hook: 'Anton', caption: 'InterSemiBold', keyword: 'MontserratBold' },
  });
}

// GET /api/clips/stages — copy creativo de etapas (frontend lo usa por stage_index)
export function stagesHandler(req, res) {
  res.json({ stages: STAGES });
}

// POST /api/clips/jobs/:id/disable-hooks — desactiva el gancho en todos los clips del job (bulk).
export async function disableAllHooksHandler(req, res) {
  try {
    const jobId = req.params.id;
    const job = await get('SELECT user_id FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });
    const enabled = req.body?.enabled ? 1 : 0;
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE clips SET hook_enabled=?, updated_at=CURRENT_TIMESTAMP WHERE job_id=?`,
        [enabled, jobId],
        function (err) { err ? reject(err) : resolve(this.changes); }
      );
    });
    res.json({ success: true, enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/clips/templates — lista las plantillas de estilo guardadas por el usuario.
export async function listTemplatesHandler(req, res) {
  try {
    const rows = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, name, params, created_at FROM clip_templates WHERE user_id=? ORDER BY created_at DESC',
        [req.user.id],
        (err, rows) => err ? reject(err) : resolve(rows || [])
      );
    });
    const templates = rows.map(r => ({
      id: r.id,
      name: r.name,
      params: (() => { try { return JSON.parse(r.params); } catch { return {}; } })(),
      created_at: r.created_at,
    }));
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/templates { name, params } — guarda una plantilla nueva.
export async function createTemplateHandler(req, res) {
  try {
    const { name, params } = req.body || {};
    if (!name || !params || typeof params !== 'object') {
      return res.status(400).json({ error: 'name + params requeridos' });
    }
    const id = (await import('crypto')).randomBytes(8).toString('hex');
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO clip_templates (id, user_id, name, params) VALUES (?, ?, ?, ?)',
        [id, req.user.id, name.slice(0, 60), JSON.stringify(params)],
        function (err) { err ? reject(err) : resolve(); }
      );
    });
    res.json({ id, name, params });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/clips/templates/:id
export async function deleteTemplateHandler(req, res) {
  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM clip_templates WHERE id=? AND user_id=?',
        [req.params.id, req.user.id],
        function (err) { err ? reject(err) : resolve(); }
      );
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/jobs/:id/apply-style — aplica un set de params de estilo a TODOS los clips del job.
// Útil para "aplicar plantilla a todos" sin tener que abrir cada clip.
// Acepta cualquier subset del whitelist de campos seguros (ver allowed[] abajo).
export async function applyStyleToAllHandler(req, res) {
  try {
    const jobId = req.params.id;
    const job = await get('SELECT user_id FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const allowed = [
      'font_hook', 'font_caption', 'font_keyword',
      'hook_color', 'caption_color', 'keyword_color',
      'keyword_bg_color', 'keyword_bg_opacity',
      'outline_enabled', 'outline_thickness', 'outline_color', 'shadow_opacity',
      'hook_font_size', 'caption_font_size',
      'hook_italic', 'hook_underline',
      'caption_italic', 'caption_underline',
      'keyword_italic', 'keyword_underline',
      'camera_motion', 'sub_position', 'aspect_ratio', 'transition',
      'hook_enabled',
      'crop_x_pct',
    ];
    const body = req.body || {};
    const sets = [];
    const params = [];
    for (const k of allowed) {
      if (body[k] !== undefined) {
        sets.push(`${k}=?`);
        params.push(body[k]);
      }
    }
    if (sets.length === 0) return res.json({ success: true, updated: 0 });

    sets.push('updated_at=CURRENT_TIMESTAMP');
    params.push(jobId);
    const changes = await new Promise((resolve, reject) => {
      db.run(`UPDATE clips SET ${sets.join(', ')} WHERE job_id=?`, params, function (err) {
        err ? reject(err) : resolve(this.changes);
      });
    });
    res.json({ success: true, updated: changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/jobs/:id/apply-fonts — propaga font_hook/caption/keyword a todos los clips del job
export async function applyFontsToAllHandler(req, res) {
  try {
    const jobId = req.params.id;
    const { font_hook, font_caption, font_keyword, keyword_color } = req.body || {};
    const job = await get('SELECT user_id FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job no encontrado' });
    if (job.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const sets = [];
    const params = [];
    if (font_hook !== undefined) { sets.push('font_hook=?'); params.push(font_hook); }
    if (font_caption !== undefined) { sets.push('font_caption=?'); params.push(font_caption); }
    if (font_keyword !== undefined) { sets.push('font_keyword=?'); params.push(font_keyword); }
    if (keyword_color !== undefined) { sets.push('keyword_color=?'); params.push(keyword_color); }
    if (sets.length === 0) return res.json({ success: true, updated: 0 });

    sets.push('updated_at=CURRENT_TIMESTAMP');
    params.push(jobId);
    await new Promise((resolve, reject) => {
      db.run(`UPDATE clips SET ${sets.join(', ')} WHERE job_id=?`, params, function (err) {
        err ? reject(err) : resolve(this.changes);
      });
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/clips/:id/redetect-keywords — pide al LLM que extraiga keywords del caption editado
export async function redetectKeywordsHandler(req, res) {
  try {
    const clipId = req.params.id;
    const clip = await get(
      `SELECT c.*, j.user_id FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?`,
      [clipId]
    );
    if (!clip) return res.status(404).json({ error: 'Clip no encontrado' });
    if (clip.user_id !== req.user.id) return res.status(403).json({ error: 'No autorizado' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY no configurada' });

    const prompt = `Texto del caption: "${clip.caption}"\nHook: "${clip.hook}"\n\nDevuelve 1-3 palabras o frases cortas (1-2 palabras cada una) DENTRO del texto del caption que sean las más impactantes para destacar visualmente. Devuelve JSON: {"keywords": [string]}`;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30_000);
    let r;
    try {
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
        signal: ctrl.signal,
      });
    } finally { clearTimeout(t); }

    if (!r.ok) throw new Error(`LLM ${r.status}`);
    const json = await r.json();
    const out = JSON.parse(json.choices[0].message.content);
    const cost = +((json.usage.prompt_tokens * 0.15 + json.usage.completion_tokens * 0.6) / 1e6).toFixed(6);

    await updateClip(clipId, req.user.id, { keywords: out.keywords || [] });
    await addCostToJob(clip.job_id, cost);
    res.json({ keywords: out.keywords || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
