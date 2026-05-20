// api/clips/clipsService.js
// Orquestador del job: descarga, transcribe, detecta highlights, genera clips.
// Mantiene status en DB y archivos en /opt/data/clips/<jobId>/ (prod) o data/clips/<jobId>/ (dev).
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../database/schema.js';
import { transcribeWithTimestamps } from './whisperService.js';
import { generateHighlights, generateHookForRange, snapRangeToSegments } from './highlightService.js';
import { cleanupOrthography } from './orthographyCleanup.js';
import { buildAssForClip } from './subtitleGenerator.js';
import {
  downloadVideoToPath, getVideoMetadata, extractAudioFromVideo,
  renderClip, renderClipBase, burnSubtitlesOnBase, baseParamsHash,
} from './videoProcessor.js';

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
    clipCount = null, // null = auto (LLM decide) — ignorado en modo manual
    defaultResolution = '1080',
    aspectRatio = '9:16',
    fontPresetMode = 'auto', // 'auto' | 'role' | 'single'
    // Defaults estética "Algo Sentido": Editorial (Playfair + Lora + italic editorial)
    fontHook = 'PlayfairDisplay',
    fontCaption = 'LoraSemiBold',
    fontKeyword = 'PlayfairDisplayItalic',
    // Nuevo: modo de selección de clips
    mode = 'auto', // 'auto' | 'manual'
    hookAutoEnabled = 1, // solo aplica en modo manual
  } = options;
  await run(
    `INSERT INTO clip_jobs (
      id, user_id, source_url, source_filename, status,
      requested_clip_count, default_resolution, aspect_ratio,
      font_preset_mode, font_hook_default, font_caption_default, font_keyword_default,
      mode, hook_auto_enabled
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, sourceUrl || null, sourceFilename || null,
     clipCount, defaultResolution, aspectRatio,
     fontPresetMode, fontHook, fontCaption, fontKeyword,
     mode, hookAutoEnabled ? 1 : 0]
  );
  log(id, `created (mode=${mode}, clips=${clipCount || 'auto'}, res=${defaultResolution}, aspect=${aspectRatio}, fonts=${fontPresetMode})`);
  return id;
}

// Worker async — se dispara después de devolver el jobId al cliente.
// Si el job tiene mode='manual', pausa en status='awaiting_selection' tras transcribir
// y espera a que el cliente llame POST /jobs/:id/submit-ranges (que dispara resumeManualJob).
export async function processJob(jobId) {
  const jobDir = path.join(CLIPS_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  try {
    const job = await get('SELECT * FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) throw new Error('Job no encontrado');
    const isManual = job.mode === 'manual';

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
      await downloadVideoToPath(job.source_url, sourcePath, ({ pct, size }) => {
        log(jobId, `download ${pct.toFixed(0)}% of ${size}`);
      });
      log(jobId, `download complete (${elapsed()})`);
    } else if (job.source_filename) {
      fs.copyFileSync(job.source_filename, sourcePath);
      const sizeMb = (fs.statSync(sourcePath).size / 1024 / 1024).toFixed(1);
      try { fs.unlinkSync(job.source_filename); } catch {}
      log(jobId, `copied uploaded file · ${sizeMb}MB (${elapsed()})`);
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
    const { transcript: rawTranscript, costUsd: whisperCost } = await transcribeWithTimestamps(audioPath, 'es');
    log(jobId, `Whisper done · ${rawTranscript.words?.length || 0} palabras · $${whisperCost.toFixed(4)} (${elapsed()})`);

    // Pase de limpieza ortográfica con GPT-4o-mini (acentos, mayúsculas, ¿?). Si falla, usa el original.
    log(jobId, `cleaning orthography…`);
    const { cleaned: transcript, costUsd: cleanupCost } = await cleanupOrthography(rawTranscript);
    log(jobId, `cleanup done · $${cleanupCost.toFixed(4)} (${elapsed()})`);

    const whisperJsonPath = path.join(jobDir, 'whisper.json');
    fs.writeFileSync(whisperJsonPath, JSON.stringify(transcript));
    await run(
      'UPDATE clip_jobs SET whisper_json_path=?, whisper_cost_usd=?, llm_cost_usd=llm_cost_usd+?, total_cost_usd=total_cost_usd+? WHERE id=?',
      [whisperJsonPath, whisperCost, cleanupCost, cleanupCost, jobId]
    );
    fs.unlinkSync(audioPath);

    // ========== Branch modo manual ==========
    // El usuario decidirá qué fragmentos van. Pausamos el worker y esperamos POST /submit-ranges.
    // El video fuente (source.mp4) queda en disco para que renderemos las bases cuando el usuario decida.
    if (isManual) {
      await run(
        `UPDATE clip_jobs SET status='awaiting_selection', stage_index=3 WHERE id=?`,
        [jobId]
      );
      log(jobId, `→ awaiting_selection: transcript listo (${transcript.words?.length || 0} palabras). Esperando rangos del usuario. (${elapsed()})`);
      return;
    }
    // ========== /Branch modo manual ==========

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
      // Defaults "Algo Sentido" Editorial: tipografía editorial cálida + oro envejecido sutil
      // + outline mínimo. Si el usuario quiere algo más fuerte, aplica una plantilla diferente.
      await run(
        `INSERT INTO clips (
          id, job_id, clip_index, title, hook, caption, keywords,
          post_caption, post_caption_tone, post_captions_cache,
          start_seconds, end_seconds, virality_score, reasoning,
          font_hook, font_caption, font_keyword,
          hook_color, caption_color, keyword_color, outline_color,
          outline_enabled, outline_thickness, shadow_opacity,
          hook_font_size, caption_font_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          job.font_hook_default || 'PlayfairDisplay',
          job.font_caption_default || 'LoraSemiBold',
          job.font_keyword_default || 'PlayfairDisplayItalic',
          '#F5F1E8', '#FAFAF7', '#C9A961', '#000000',
          1, 2, 35,
          78, 54,
        ]
      );
    }
    log(jobId, `${clips.length} clips guardados en DB`);

    // Etapa 7-9: renderizar el base.mp4 (sin subs) de cada clip a la resolución default.
    // Modelo Opus: el .ass + burn-in se hace ON-DEMAND al exportar, no aquí.
    // El preview en el editor reproduce este base.mp4 con overlay HTML sincronizado encima.
    await setStage(jobId, 7);
    const clipRows = await all('SELECT * FROM clips WHERE job_id=? ORDER BY clip_index', [jobId]);
    const targetRes = job.default_resolution || '1080';
    for (let idx = 0; idx < clipRows.length; idx++) {
      const clip = clipRows[idx];
      const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]'), aspect_ratio: job.aspect_ratio || '9:16' };
      const basePath = path.join(jobDir, `${c.id}_base_${targetRes}.mp4`);
      log(jobId, `rendering base ${idx + 1}/${clipRows.length} "${c.title}" @ ${targetRes}p ${c.aspect_ratio} (no subs)…`);
      const renderStart = Date.now();
      await renderClipBase({ sourceVideo: sourcePath, clip: c, outputPath: basePath, resolution: targetRes });
      log(jobId, `base ${idx + 1} rendered in ${((Date.now() - renderStart) / 1000).toFixed(1)}s`);
      const hash = baseParamsHash(c, targetRes);
      await run(
        `UPDATE clips SET base_video_path=?, base_params_hash=?, output_resolution=?, render_mode='overlay', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [basePath, hash, targetRes, c.id]
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

// Reanuda un job en modo manual cuando el usuario envía sus rangos vía POST /submit-ranges.
// - Snap cada rango a fronteras de palabra (whisper segments) y aplica retreatEndIfContinuation.
// - Filtra rangos fuera de [10s, 120s] (rango duro más permisivo que el auto [25-100]).
// - Por cada rango, genera hook + caption + keywords + post_captions con gpt-4o-mini (si está habilitado).
// - Inserta clips y dispara el render de bases (stages 7-9).
const MANUAL_MIN_DURATION = 10;
const MANUAL_MAX_DURATION = 120;

export async function resumeManualJob(jobId, rangesInput) {
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

  try {
    const job = await get('SELECT * FROM clip_jobs WHERE id=?', [jobId]);
    if (!job) throw new Error('Job no encontrado');
    if (job.status !== 'awaiting_selection') {
      throw new Error(`Job no está esperando selección (status=${job.status})`);
    }
    if (!job.whisper_json_path || !fs.existsSync(job.whisper_json_path)) {
      throw new Error('Transcript ya no disponible');
    }
    if (!job.source_video_path || !fs.existsSync(job.source_video_path)) {
      throw new Error('Video fuente ya no disponible');
    }

    const whisperJson = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
    const hookAuto = job.hook_auto_enabled !== 0;

    // 1. Snap + retreat + filtro de duración
    const validRanges = [];
    for (const r of (rangesInput || [])) {
      if (typeof r.start !== 'number' || typeof r.end !== 'number') continue;
      if (r.end <= r.start) continue;
      const snapped = snapRangeToSegments(whisperJson, r.start, r.end);
      const dur = snapped.end_seconds - snapped.start_seconds;
      if (dur < MANUAL_MIN_DURATION || dur > MANUAL_MAX_DURATION) {
        console.warn(`[clips:${jobId.slice(0,8)}] dropping manual range ${snapped.start_seconds.toFixed(1)}-${snapped.end_seconds.toFixed(1)} — duración ${dur.toFixed(1)}s fuera de [${MANUAL_MIN_DURATION}, ${MANUAL_MAX_DURATION}]`);
        continue;
      }
      validRanges.push(snapped);
    }

    if (validRanges.length === 0) {
      throw new Error('No hay rangos válidos (mínimo 10s, máximo 120s después de snap)');
    }

    // Guardar rangos para auditoría y avanzar status
    await run(
      `UPDATE clip_jobs SET manual_ranges=?, status='running', stage_index=6 WHERE id=?`,
      [JSON.stringify(validRanges), jobId]
    );
    log(jobId, `manual: ${validRanges.length} rango(s) válido(s) tras snap (${elapsed()})`);

    // 2. Por cada rango, generar copy (hook+caption+keywords+post_captions) con gpt-4o-mini.
    //    Si hookAuto=false, los campos quedan vacíos para que el usuario los rellene en el editor.
    let totalHookCost = 0;
    const clipsToInsert = [];
    for (let i = 0; i < validRanges.length; i++) {
      const r = validRanges[i];
      let copy;
      if (hookAuto) {
        copy = await generateHookForRange(whisperJson, r.start_seconds, r.end_seconds);
        totalHookCost += copy.costUsd || 0;
        log(jobId, `manual: hook ${i + 1}/${validRanges.length} generado · $${(copy.costUsd || 0).toFixed(4)}`);
      } else {
        copy = {
          title: `Mi clip ${i + 1}`,
          hook: '',
          caption: '',
          keywords: [],
          post_captions: { pregunta: '', storytelling: '', insight: '' },
          costUsd: 0,
        };
      }
      clipsToInsert.push({ ...r, ...copy });
    }
    await run(
      `UPDATE clip_jobs SET llm_cost_usd=llm_cost_usd+?, total_cost_usd=total_cost_usd+? WHERE id=?`,
      [totalHookCost, totalHookCost, jobId]
    );

    // 3. Insertar clips en DB
    // Si el job ya tenía clips (caso "agregar más clips"), arrancamos clip_index desde MAX+1
    // para no chocar con los existentes y mantener el orden de creación.
    const maxExistingIdx = await get(
      'SELECT COALESCE(MAX(clip_index), -1) AS max_idx FROM clips WHERE job_id=?',
      [jobId]
    );
    const startIdx = (maxExistingIdx?.max_idx ?? -1) + 1;
    for (let i = 0; i < clipsToInsert.length; i++) {
      const c = clipsToInsert[i];
      const clipId = newId();
      const postCaptions = c.post_captions || { pregunta: '', storytelling: '', insight: '' };
      const activeTone = 'pregunta';
      await run(
        `INSERT INTO clips (
          id, job_id, clip_index, title, hook, caption, keywords,
          post_caption, post_caption_tone, post_captions_cache,
          start_seconds, end_seconds, virality_score, reasoning,
          font_hook, font_caption, font_keyword,
          hook_color, caption_color, keyword_color, outline_color,
          outline_enabled, outline_thickness, shadow_opacity,
          hook_font_size, caption_font_size
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clipId, jobId, startIdx + i,
          c.title || `Clip ${startIdx + i + 1}`,
          c.hook || '',
          c.caption || '',
          JSON.stringify(c.keywords || []),
          postCaptions[activeTone] || '',
          activeTone,
          JSON.stringify(postCaptions),
          c.start_seconds, c.end_seconds, 0, 'manual: elegido por el usuario',
          job.font_hook_default || 'PlayfairDisplay',
          job.font_caption_default || 'LoraSemiBold',
          job.font_keyword_default || 'PlayfairDisplayItalic',
          '#F5F1E8', '#FAFAF7', '#C9A961', '#000000',
          1, 2, 35,
          78, 54,
        ]
      );
    }
    log(jobId, `manual: ${clipsToInsert.length} clip(s) insertados (índices ${startIdx}..${startIdx + clipsToInsert.length - 1})`);

    // 4. Renderizar bases (stages 7-9) — solo los clips que aún no tienen base_video_path.
    //    Caso "agregar más clips": los clips viejos ya están renderizados, los saltamos.
    await setStage(jobId, 7);
    const clipRows = await all(
      'SELECT * FROM clips WHERE job_id=? AND (base_video_path IS NULL OR base_video_path = ?) ORDER BY clip_index',
      [jobId, '']
    );
    const targetRes = job.default_resolution || '1080';
    for (let idx = 0; idx < clipRows.length; idx++) {
      const clip = clipRows[idx];
      const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]'), aspect_ratio: job.aspect_ratio || '9:16' };
      const jobDir = path.dirname(job.source_video_path);
      const basePath = path.join(jobDir, `${c.id}_base_${targetRes}.mp4`);
      log(jobId, `rendering base ${idx + 1}/${clipRows.length} "${c.title}" @ ${targetRes}p ${c.aspect_ratio}…`);
      const renderStart = Date.now();
      await renderClipBase({ sourceVideo: job.source_video_path, clip: c, outputPath: basePath, resolution: targetRes });
      log(jobId, `base ${idx + 1} rendered in ${((Date.now() - renderStart) / 1000).toFixed(1)}s`);
      const hash = baseParamsHash(c, targetRes);
      await run(
        `UPDATE clips SET base_video_path=?, base_params_hash=?, output_resolution=?, render_mode='overlay', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
        [basePath, hash, targetRes, c.id]
      );
    }
    await setStage(jobId, 8);
    await setStage(jobId, 9);

    // total_clips = count actual (incluye viejos + nuevos)
    const totalNow = await get('SELECT COUNT(*) AS n FROM clips WHERE job_id=?', [jobId]);
    await run(
      `UPDATE clip_jobs SET
         status='done', stage_index=10, total_clips=?,
         finished_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [totalNow?.n || clipsToInsert.length, jobId]
    );
    log(jobId, `manual: job completo · ${clipsToInsert.length} clips · hook cost $${totalHookCost.toFixed(4)} (${elapsed()})`);
  } catch (err) {
    console.error(`[clips] resumeManualJob ${jobId} failed:`, err);
    await run(
      `UPDATE clip_jobs SET status='error', error_message=?, finished_at=CURRENT_TIMESTAMP WHERE id=?`,
      [String(err.message || err).slice(0, 500), jobId]
    );
  }
}

// Reabre un job ya terminado (status='done') para que el usuario marque MÁS rangos.
// Reutiliza el whisper.json y source.mp4 que ya están en disco (no re-transcribe, no re-descarga).
// Convierte el job a mode='manual' y lo deja en status='awaiting_selection'. Los clips existentes
// se mantienen intactos; los nuevos rangos se agregarán después de ellos al volver a submitir.
export async function reopenJobForSelection(jobId, userId) {
  const job = await get('SELECT * FROM clip_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (job.user_id !== userId) throw new Error('No autorizado');
  if (job.status !== 'done') throw new Error(`Solo se pueden reabrir jobs completos (status actual: ${job.status})`);
  if (!job.whisper_json_path || !fs.existsSync(job.whisper_json_path)) {
    throw new Error('Transcript ya no disponible — el job fue purgado');
  }
  if (!job.source_video_path || !fs.existsSync(job.source_video_path)) {
    throw new Error('Video fuente ya no disponible — el job fue purgado');
  }
  await run(
    `UPDATE clip_jobs SET mode='manual', status='awaiting_selection', stage_index=3, finished_at=NULL WHERE id=?`,
    [jobId]
  );
  log(jobId, `reabierto para selección manual (clips existentes se mantienen)`);
  return { success: true, jobId };
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
    'keyword_color', 'camera_motion', 'sub_position', 'aspect_ratio',
    'outline_enabled', 'outline_thickness', 'shadow_opacity',
    'hook_font_size', 'caption_font_size',
    'hook_italic', 'hook_underline', 'caption_italic', 'caption_underline',
    'keyword_italic', 'keyword_underline',
    'keyword_bg_color', 'keyword_bg_opacity',
    'transition', 'hook_enabled',
    'hook_color', 'caption_color', 'outline_color',
    'karaoke_enabled', 'karaoke_dim_opacity'];
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
  if (updates.caption_overrides !== undefined) {
    sets.push('caption_overrides=?');
    params.push(typeof updates.caption_overrides === 'string' ? updates.caption_overrides : JSON.stringify(updates.caption_overrides));
  }
  if (sets.length === 0) return;
  sets.push('updated_at=CURRENT_TIMESTAMP');
  params.push(clipId);
  await run(`UPDATE clips SET ${sets.join(', ')} WHERE id=?`, params);
}

// Asegura que el base.mp4 exista y corresponda a los params actuales (start/end/aspect/camera/res).
// Si el hash cambió o no existe el archivo, lo regenera. Reusa si ya está válido.
export async function ensureClipBase(clipId, resolution = '1080') {
  const clip = await get('SELECT * FROM clips WHERE id=?', [clipId]);
  if (!clip) throw new Error('Clip no encontrado');
  if (clip.render_mode === 'burned-legacy') {
    throw new Error('Este clip es legacy (subs quemados): no se puede previsualizar con overlay');
  }
  const job = await get('SELECT * FROM clip_jobs WHERE id=?', [clip.job_id]);
  if (!job || !job.source_video_path || !fs.existsSync(job.source_video_path)) {
    throw new Error('Video fuente ya no disponible — el job fue purgado');
  }
  const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]') };
  const jobDir = path.dirname(job.source_video_path);
  const basePath = path.join(jobDir, `${clipId}_base_${resolution}.mp4`);
  const expected = baseParamsHash(c, resolution);
  const valid = clip.base_video_path === basePath
    && clip.base_params_hash === expected
    && fs.existsSync(basePath);
  if (!valid) {
    log(clip.job_id, `regenerating base for ${clipId} @ ${resolution}p (params changed or missing)`);
    await renderClipBase({ sourceVideo: job.source_video_path, clip: c, outputPath: basePath, resolution });
    await run(
      `UPDATE clips SET base_video_path=?, base_params_hash=?, output_resolution=?, render_mode='overlay', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [basePath, expected, resolution, clipId]
    );
  }
  return basePath;
}

// Exporta MP4 final con subs quemados, partiendo del base.mp4 (rápido: solo burn-in).
// Usado por el botón "Exportar MP4" del editor. Reemplaza al viejo regenerateClipMp4.
export async function exportClipMp4(clipId, resolution = '1080') {
  const clip = await get('SELECT * FROM clips WHERE id=?', [clipId]);
  if (!clip) throw new Error('Clip no encontrado');
  const job = await get('SELECT * FROM clip_jobs WHERE id=?', [clip.job_id]);
  if (!job) throw new Error('Job no encontrado');

  // Compatibilidad legacy: si el clip nació con subs quemados, mantenemos el path viejo.
  if (clip.render_mode === 'burned-legacy') {
    if (!fs.existsSync(job.source_video_path || '')) throw new Error('Video fuente no disponible');
    const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
    const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]') };
    const jobDir = path.dirname(job.source_video_path);
    const assPath = path.join(jobDir, `${clipId}.ass`);
    const outPath = path.join(jobDir, `${clipId}_${resolution}.mp4`);
    fs.writeFileSync(assPath, buildAssForClip(c, transcript));
    await renderClip({ sourceVideo: job.source_video_path, clip: c, assPath, outputPath: outPath, resolution });
    await run(
      `UPDATE clips SET output_path=?, output_resolution=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [outPath, resolution, clipId]
    );
    return outPath;
  }

  // Modo overlay (default): reusa base.mp4, solo quema subs encima.
  const basePath = await ensureClipBase(clipId, resolution);
  const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
  const c = { ...clip, keywords: JSON.parse(clip.keywords || '[]') };
  const jobDir = path.dirname(job.source_video_path);
  const assPath = path.join(jobDir, `${clipId}.ass`);
  const outPath = path.join(jobDir, `${clipId}_export_${resolution}.mp4`);
  fs.writeFileSync(assPath, buildAssForClip(c, transcript));
  await burnSubtitlesOnBase({ baseVideo: basePath, assPath, outputPath: outPath });
  await run(
    `UPDATE clips SET output_path=?, output_resolution=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [outPath, resolution, clipId]
  );
  return outPath;
}

// Alias retrocompatible.
export const regenerateClipMp4 = exportClipMp4;

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

// Al arrancar el server, todo job que quedó en estado no-terminal es zombie (su worker murió).
// Los marcamos como error con un mensaje claro para que el usuario sepa que debe reintentar.
// El pipeline corre en el mismo proceso del server (no hay queue externa), así que un reinicio
// — sea por nodemon, deploy o crash — siempre interrumpe trabajos en vuelo.
export async function recoverZombieJobs() {
  const zombies = await all(
    `SELECT id, title, source_url FROM clip_jobs WHERE status NOT IN ('done', 'error')`
  );
  if (zombies.length === 0) return 0;
  await run(
    `UPDATE clip_jobs SET status='error',
       error_message='Interrumpido por reinicio del servidor. Vuelve a generar.',
       finished_at=CURRENT_TIMESTAMP
     WHERE status NOT IN ('done', 'error')`
  );
  for (const z of zombies) {
    console.warn(`[clips] zombie recuperado: ${z.id.slice(0,8)} "${z.title || z.source_url || ''}"`);
  }
  return zombies.length;
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
