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

// POST /api/clips/generate { url, options } o multipart con file + options JSON
export async function generateHandler(req, res) {
  try {
    const userId = req.user.id;
    const body = req.body || {};
    const { url } = body;
    const sourceFilename = req.file ? req.file.path : null;

    if (!url && !sourceFilename) {
      return res.status(400).json({ error: 'Falta url o archivo' });
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
