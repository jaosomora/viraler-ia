// api/clips/clipsService.js
// Orquestador del job: descarga, transcribe, detecta highlights, genera clips.
// Mantiene status en DB y archivos en /opt/data/clips/<jobId>/ (prod) o data/clips/<jobId>/ (dev).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../database/schema.js';
import { transcribeWithTimestamps } from './whisperService.js';
import { generateHighlights } from './highlightService.js';
import { buildAssForClip } from './subtitleGenerator.js';
import { downloadVideoToPath, getVideoMetadata, extractAudioFromVideo, renderClip } from './videoProcessor.js';

// Etapas con copy creativo (matching el mockup). Frontend lee `stage_index` y resuelve copy desde aquí.
export const STAGES = [
  { idx: 0, emoji: '📡', msg: 'Bajando el video del internet…', percent: 8 },
  { idx: 1, emoji: '🎧', msg: 'Escuchando bien lo que dicen…', percent: 22 },
  { idx: 2, emoji: '✍️', msg: 'Pasando todo a texto en español…', percent: 35 },
  { idx: 3, emoji: '🪙', msg: 'Buscando los momentos que valen oro…', percent: 60 },
  { idx: 4, emoji: '🧠', msg: 'Cazando insights poderosos…', percent: 70 },
  { idx: 5, emoji: '🎯', msg: 'Eligiendo los hooks más virales…', percent: 78 },
  { idx: 6, emoji: '✂️', msg: 'Cortando con bisturí cada highlight…', percent: 86 },
  { idx: 7, emoji: '🎨', msg: 'Pintando los subtítulos estilo Instagram…', percent: 92 },
  { idx: 8, emoji: '🎬', msg: 'Dándole movimiento a la cámara…', percent: 96 },
  { idx: 9, emoji: '✨', msg: 'Revisando la genialidad antes de entregar…', percent: 99 },
];

const isProd = process.env.NODE_ENV === 'production';
const CLIPS_ROOT = isProd ? '/opt/data/clips' : path.resolve(process.cwd(), 'data/clips');
fs.mkdirSync(CLIPS_ROOT, { recursive: true });

function newId() { return crypto.randomBytes(8).toString('hex'); }

const run = (sql, params = []) => new Promise((res, rej) => {
  db.run(sql, params, function (err) { err ? rej(err) : res(this); });
});
const get = (sql, params = []) => new Promise((res, rej) => {
  db.get(sql, params, (err, row) => err ? rej(err) : res(row));
});
const all = (sql, params = []) => new Promise((res, rej) => {
  db.all(sql, params, (err, rows) => err ? rej(err) : res(rows || []));
});

function log(jobId, msg) {
  const short = jobId.slice(0, 8);
  console.log(`[clips:${short}] ${msg}`);
}

async function setStage(jobId, stageIdx, status = 'running') {
  await run('UPDATE clip_jobs SET stage_index=?, status=? WHERE id=?', [stageIdx, status, jobId]);
  const stage = STAGES[stageIdx] || { msg: `stage ${stageIdx}` };
  log(jobId, `→ stage ${stageIdx}: ${stage.msg}`);
}

export async function createJob({ userId, sourceUrl, sourceFilename, options = {} }) {
  const id = newId();
  const {
    clipCount = null, // null = auto (LLM decide)
    defaultResolution = '1080',
    aspectRatio = '9:16',
    fontPresetMode = 'auto', // 'auto' | 'role' | 'single'
    fontHook = 'Anton',
    fontCaption = 'InterSemiBold',
    fontKeyword = 'MontserratBold',
  } = options;
  await run(
    `INSERT INTO clip_jobs (
      id, user_id, source_url, source_filename, status,
      requested_clip_count, default_resolution, aspect_ratio,
      font_preset_mode, font_hook_default, font_caption_default, font_keyword_default
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, sourceUrl || null, sourceFilename || null,
     clipCount, defaultResolution, aspectRatio,
     fontPresetMode, fontHook, fontCaption, fontKeyword]
  );
  log(id, `created (clips=${clipCount || 'auto'}, res=${defaultResolution}, aspect=${aspectRatio}, fonts=${fontPresetMode})`);
  return id;
}

// Worker async — se dispara después de devolver el jobId al cliente.
export async function processJob(jobId) {
  const jobDir = path.join(CLIPS_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  try {
    const job = await get('SELECT * FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) throw new Error('Job no encontrado');

    // Etapa 0: descargar video
    await setStage(jobId, 0);
    const sourcePath = path.join(jobDir, 'source.mp4');
    if (job.source_url) {
      log(jobId, `fetching metadata for ${job.source_url}`);
      const meta = await getVideoMetadata(job.source_url);
      if (meta.duration > 3600) throw new Error('Video supera el límite de 60 minutos');
      log(jobId, `video: "${meta.title}" · ${Math.round(meta.duration)}s · ${meta.width}x${meta.height}`);
      await run(
        'UPDATE clip_jobs SET title=?, duration_seconds=?, thumbnail=?, source_width=?, source_height=? WHERE id=?',
        [meta.title, meta.duration, meta.thumbnail, meta.width || null, meta.height || null, jobId]
      );
      log(jobId, `downloading video…`);
      await downloadVideoToPath(job.source_url, sourcePath);
      log(jobId, `download complete (${elapsed()})`);
    } else if (job.source_filename) {
      fs.copyFileSync(job.source_filename, sourcePath);
      log(jobId, `copied uploaded file (${elapsed()})`);
    } else {
      throw new Error('Job sin source_url ni source_filename');
    }
    await run('UPDATE clip_jobs SET source_video_path=? WHERE id=?', [sourcePath, jobId]);

    // Etapa 1-2: extraer audio + transcribir
    await setStage(jobId, 1);
    const audioPath = path.join(jobDir, 'audio.mp3');
    await extractAudioFromVideo(sourcePath, audioPath);
    log(jobId, `audio extracted (${elapsed()})`);

    await setStage(jobId, 2);
    log(jobId, `calling Whisper…`);
    const { transcript, costUsd: whisperCost } = await transcribeWithTimestamps(audioPath, 'es');
    log(jobId, `Whisper done · ${transcript.words?.length || 0} palabras · $${whisperCost.toFixed(4)} (${elapsed()})`);
    const whisperJsonPath = path.join(jobDir, 'whisper.json');
    fs.writeFileSync(whisperJsonPath, JSON.stringify(transcript));
    await run(
      'UPDATE clip_jobs SET whisper_json_path=?, whisper_cost_usd=? WHERE id=?',
      [whisperJsonPath, whisperCost, jobId]
    );
    fs.unlinkSync(audioPath);

    // Etapa 3-5: highlights + speakers + post captions (1 sola llamada LLM)
    await setStage(jobId, 3);
    log(jobId, `calling GPT-4o for highlights (timeout 90s)…`);
    const { clips, costUsd: llmCost, speakerCount, speakersSummary } = await generateHighlights(transcript, {
      clipCount: job.requested_clip_count,
    });
    log(jobId, `GPT-4o done · ${clips.length} clips · ${speakerCount} speakers · $${llmCost.toFixed(4)} (${elapsed()})`);
    await setStage(jobId, 4);
    await setStage(jobId, 5);

    // Etapa 6: insertar clips en DB con preferencias job-level
    await setStage(jobId, 6);
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i];
      const clipId = newId();
      // El LLM ahora devuelve post_captions {pregunta, storytelling, insight}
      const postCaptions = c.post_captions || { pregunta: c.post_caption || '', storytelling: '', insight: '' };
      const activeTone = 'pregunta';
      await run(
        `INSERT INTO clips (
          id, job_id, clip_index, title, hook, caption, keywords,
          post_caption, post_caption_tone, post_captions_cache,
          start_seconds, end_seconds, virality_score, reasoning,
          font_hook, font_caption, font_keyword
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clipId, jobId, i,
          c.title || `Clip ${i + 1}`,
          c.hook || '',
          c.caption || '',
          JSON.stringify(c.keywords || []),
          postCaptions[activeTone] || '',
          activeTone,
          JSON.stringify(postCaptions),
          c.start_seconds, c.end_seconds, c.score || 0, c.reasoning || '',
          job.font_hook_default || 'Anton',
          job.font_caption_default || 'InterSemiBold',
          job.font_keyword_default || 'MontserratBold',
        ]
      );
    }
    log(jobId, `${clips.length} clips guardados en DB`);

    // Etapa 7-9: renderizar a la resolución default del job
    await setStage(jobId, 7);
    const clipRows = await all('SELECT * FROM clips WHERE job_id=? ORDER BY clip_index', [jobId]);
    const targetRes = job.default_resolution || '1080';
    for (let idx = 0; idx < clipRows.length; idx++) {
      const clip = clipRows[idx];
      const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]'), aspect_ratio: job.aspect_ratio || '9:16' };
      const assPath = path.join(jobDir, `${c.id}.ass`);
      const outPath = path.join(jobDir, `${c.id}_${targetRes}.mp4`);
      fs.writeFileSync(assPath, buildAssForClip(c, transcript));
      log(jobId, `rendering clip ${idx + 1}/${clipRows.length} "${c.title}" @ ${targetRes}p ${c.aspect_ratio}…`);
      const renderStart = Date.now();
      await renderClip({ sourceVideo: sourcePath, clip: c, assPath, outputPath: outPath, resolution: targetRes });
      log(jobId, `clip ${idx + 1} rendered in ${((Date.now() - renderStart) / 1000).toFixed(1)}s`);
      await run(
        `UPDATE clips SET output_path=?, output_resolution=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [outPath, targetRes, c.id]
      );
    }
    await setStage(jobId, 8);
    await setStage(jobId, 9);

    // Cleanup: borrar source.mp4 (ahorra ~80MB por job, podemos regenerar si user pide otra res)
    // Comentado por ahora para soportar download en otras resoluciones sin re-descargar.
    // fs.unlinkSync(sourcePath);

    const totalCost = +(whisperCost + llmCost).toFixed(6);
    await run(
      `UPDATE clip_jobs SET
        status='done', stage_index=10, total_clips=?,
        llm_cost_usd=?, total_cost_usd=?,
        finished_at=CURRENT_TIMESTAMP
      WHERE id=?`,
      [clips.length, llmCost, totalCost, jobId]
    );

    console.log(`[clips] Job ${jobId} done. ${clips.length} clips. Cost $${totalCost.toFixed(4)}`);
  } catch (err) {
    console.error(`[clips] Job ${jobId} failed:`, err);
    await run(
      `UPDATE clip_jobs SET status='error', error_message=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`,
      [String(err.message || err).slice(0, 500), jobId]
    );
  }
}

export async function getJobWithClips(jobId, userId = null) {
  const where = userId ? 'WHERE id=? AND user_id=?' : 'WHERE id=?';
  const params = userId ? [jobId, userId] : [jobId];
  const job = await get(`SELECT * FROM clip_jobs ${where}`, params);
  if (!job) return null;
  const rawClips = await all('SELECT * FROM clips WHERE job_id=? ORDER BY clip_index', [jobId]);
  const clips = rawClips.map(c => ({
    ...c,
    keywords: JSON.parse(c.keywords || '[]'),
    post_captions_cache: c.post_captions_cache ? JSON.parse(c.post_captions_cache) : null,
  }));
  const stage = STAGES[job.stage_index] || STAGES[STAGES.length - 1];
  return { ...job, clips, stage };
}

export async function listUserJobs(userId) {
  const jobs = await all(
    `SELECT j.*, COUNT(c.id) as clip_count
     FROM clip_jobs j LEFT JOIN clips c ON c.job_id = j.id
     WHERE j.user_id = ? GROUP BY j.id ORDER BY j.created_at DESC`,
    [userId]
  );
  return jobs;
}

export async function listAllJobs() {
  return await all(
    `SELECT j.*, u.email as user_email, u.name as user_name, COUNT(c.id) as clip_count
     FROM clip_jobs j
     LEFT JOIN users u ON u.id = j.user_id
     LEFT JOIN clips c ON c.job_id = j.id
     GROUP BY j.id ORDER BY j.created_at DESC`
  );
}

export async function updateClip(clipId, userId, updates) {
  const job = await get(
    'SELECT j.user_id FROM clips c JOIN clip_jobs j ON j.id=c.job_id WHERE c.id=?',
    [clipId]
  );
  if (!job) throw new Error('Clip no encontrado');
  if (job.user_id !== userId) throw new Error('No autorizado');

  const allowed = ['title', 'hook', 'caption', 'post_caption', 'post_caption_tone',
    'start_seconds', 'end_seconds', 'font_hook', 'font_caption', 'font_keyword',
    'keyword_color', 'camera_motion', 'sub_position'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (updates[k] !== undefined) { sets.push(`${k}=?`); params.push(updates[k]); }
  }
  if (updates.keywords !== undefined) {
    sets.push('keywords=?');
    params.push(JSON.stringify(updates.keywords));
  }
  if (updates.post_captions_cache !== undefined) {
    sets.push('post_captions_cache=?');
    params.push(typeof updates.post_captions_cache === 'string' ? updates.post_captions_cache : JSON.stringify(updates.post_captions_cache));
  }
  if (sets.length === 0) return;
  sets.push('updated_at=CURRENT_TIMESTAMP');
  params.push(clipId);
  await run(`UPDATE clips SET ${sets.join(', ')} WHERE id=?`, params);
}

// Re-renderiza un clip aplicando los parámetros actuales (texto, fuentes, keywords, etc.)
// Llamado al hacer "Descargar" si hubo cambios en el editor.
export async function regenerateClipMp4(clipId, resolution = '1080') {
  const clip = await get('SELECT * FROM clips WHERE id=?', [clipId]);
  if (!clip) throw new Error('Clip no encontrado');
  const job = await get('SELECT * FROM clip_jobs WHERE id=?', [clip.job_id]);
  if (!job || !job.source_video_path || !fs.existsSync(job.source_video_path)) {
    throw new Error('Video fuente ya no disponible — el job fue purgado');
  }
  const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
  const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]') };
  const jobDir = path.dirname(job.source_video_path);
  const assPath = path.join(jobDir, `${clipId}.ass`);
  const outPath = path.join(jobDir, `${clipId}_${resolution}.mp4`);
  fs.writeFileSync(assPath, buildAssForClip(c, transcript));
  await renderClip({
    sourceVideo: job.source_video_path,
    clip: c,
    assPath,
    outputPath: outPath,
    resolution,
  });
  await run(
    `UPDATE clips SET output_path=?, output_resolution=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [outPath, resolution, clipId]
  );
  return outPath;
}

export async function deleteJob(jobId, userId, isOwner = false) {
  const where = isOwner ? 'WHERE id=?' : 'WHERE id=? AND user_id=?';
  const params = isOwner ? [jobId] : [jobId, userId];
  const job = await get(`SELECT * FROM clip_jobs ${where}`, params);
  if (!job) throw new Error('Job no encontrado');
  // Borrar archivos del filesystem
  const jobDir = path.join(CLIPS_ROOT, jobId);
  if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true });
  // Borrar de DB (CASCADE borra clips)
  await run('DELETE FROM clip_jobs WHERE id=?', [jobId]);
}

export async function addCostToJob(jobId, addLlmCost) {
  await run(
    `UPDATE clip_jobs SET
      llm_cost_usd = llm_cost_usd + ?,
      total_cost_usd = total_cost_usd + ?
    WHERE id=?`,
    [addLlmCost, addLlmCost, jobId]
  );
}
