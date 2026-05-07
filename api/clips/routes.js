// api/clips/routes.js
// Handlers HTTP para los endpoints de AS Clips. Wire en server.js.
import fs from 'fs';
import path from 'path';
import {
  createJob, processJob, getJobWithClips, listUserJobs, listAllJobs,
  updateClip, regenerateClipMp4, deleteJob, addCostToJob, STAGES,
} from './clipsService.js';
import { regeneratePostCaption } from './highlightService.js';
import { FONT_CATALOG } from './subtitleGenerator.js';
import db from '../database/schema.js';

const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});

// POST /api/clips/generate { url } o multipart con file
export async function generateHandler(req, res) {
  try {
    const userId = req.user.id;
    const { url } = req.body || {};
    const sourceFilename = req.file ? req.file.path : null;

    if (!url && !sourceFilename) {
      return res.status(400).json({ error: 'Falta url o archivo' });
    }

    const jobId = await createJob({ userId, sourceUrl: url || null, sourceFilename });
    res.json({ success: true, jobId });

    // Worker async: no bloqueamos la respuesta
    setImmediate(() => processJob(jobId));
  } catch (err) {
    console.error('[clips] generate error:', err);
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

// PATCH /api/clips/:id — guardar edits del editor
export async function updateClipHandler(req, res) {
  try {
    await updateClip(req.params.id, req.user.id, req.body || {});
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// GET /api/clips/:id/download?resolution=1080
// Si los parámetros editables cambiaron desde el último render, regenera el MP4 antes de servir.
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
    await updateClip(clipId, req.user.id, { post_caption: postCaption, post_caption_tone: tone });
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
