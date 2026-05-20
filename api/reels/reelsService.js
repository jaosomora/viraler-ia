// api/reels/reelsService.js
// Orquestador de Reels Cleaner.
//
// Flujo de 3 pasos:
//   1) pending → running → awaiting_review (revisar silencios)
//   2) awaiting_review → rendering_base → awaiting_style_review (revisar estilo + subs)
//          Re-loops si el usuario re-ajusta silencios o cambia estilo/texto
//   3) awaiting_style_review → done (descarga el preview tal cual)
//
// Reusa: whisperService, extractAudioFromVideo, cleanupOrthography de Clips.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import db from '../database/schema.js';
import { transcribeWithTimestamps } from '../clips/whisperService.js';
import { extractAudioFromVideo } from '../clips/videoProcessor.js';
import { cleanupOrthography } from '../clips/orthographyCleanup.js';
import { detectGaps, buildKeepSegments, remapWords } from './silenceDetector.js';
import { buildReelAss, buildChunks, REEL_FONT_OPTIONS } from './reelSubtitles.js';
import { renderReelBase, burnSubsOnBase, probeDuration, renderVoiceSample } from './reelRenderer.js';
import { mixMusicOntoReel } from './musicMixer.js';
import { getTrack as getMusicTrack, listTracks as listMusicTracks } from './musicService.js';
import { MUSIC_TAGS, tagsCatalogForLLM } from './musicTags.js';
import { ensureLocalFile } from './curateService.js';
import { trackReelUsage } from '../utils/usageTrackerSQLite.js';

export const REEL_STAGES = [
  { idx: 0, emoji: '📥', msg: 'Recibiendo tu toma…', percent: 8 },
  { idx: 1, emoji: '🎧', msg: 'Extrayendo el audio…', percent: 20 },
  { idx: 2, emoji: '✍️', msg: 'Transcribiendo lo que dijiste…', percent: 45 },
  { idx: 3, emoji: '👀', msg: 'Detectando silencios para tu revisión…', percent: 65 },
  { idx: 4, emoji: '✂️', msg: 'Aplicando los cortes que validaste…', percent: 80 },
  { idx: 5, emoji: '🎨', msg: 'Aplicando los subtítulos a tu reel…', percent: 92 },
  { idx: 6, emoji: '✨', msg: 'Empaquetando el reel final…', percent: 99 },
];

const isProd = process.env.NODE_ENV === 'production';
const REELS_ROOT = isProd ? '/opt/data/reels' : path.resolve(process.cwd(), 'data/reels');
fs.mkdirSync(REELS_ROOT, { recursive: true });

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
  console.log(`[reels:${jobId.slice(0, 8)}] ${msg}`);
}

async function setStage(jobId, stageIdx, status = 'running') {
  await run('UPDATE reel_jobs SET stage_index=?, status=? WHERE id=?', [stageIdx, status, jobId]);
}

export async function createJob({ userId, sourceFilename, title }) {
  const id = newId();
  await run(
    `INSERT INTO reel_jobs (id, user_id, source_filename, title, status) VALUES (?, ?, ?, ?, 'pending')`,
    [id, userId, sourceFilename || null, title || null]
  );
  log(id, `created`);
  return id;
}

// Worker async hasta awaiting_review (silencios).
export async function processJobUntilReview(jobId) {
  const jobDir = path.join(REELS_ROOT, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  try {
    const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
    if (!job) throw new Error('Job no encontrado');

    await setStage(jobId, 0);
    const sourcePath = path.join(jobDir, 'source.mp4');
    if (!job.source_filename) throw new Error('Job sin source_filename');
    // Rename (mv) en vez de copy para no duplicar la huella en disco.
    try {
      fs.renameSync(job.source_filename, sourcePath);
    } catch {
      fs.copyFileSync(job.source_filename, sourcePath);
      try { fs.unlinkSync(job.source_filename); } catch {}
    }

    const duration = await probeDuration(sourcePath);
    if (duration > 600) throw new Error('El video supera el límite de 10 minutos');
    await run('UPDATE reel_jobs SET source_video_path=?, duration_seconds=? WHERE id=?',
      [sourcePath, duration, jobId]);

    await setStage(jobId, 1);
    const audioPath = path.join(jobDir, 'audio.mp3');
    await extractAudioFromVideo(sourcePath, audioPath);
    log(jobId, `audio extracted (${duration.toFixed(1)}s)`);

    await setStage(jobId, 2);
    const { transcript: raw, costUsd: whisperCost } = await transcribeWithTimestamps(audioPath, 'es');
    log(jobId, `whisper done · ${raw.words?.length || 0} palabras · $${whisperCost.toFixed(4)}`);

    let transcript = raw;
    let cleanupCost = 0;
    try {
      const out = await cleanupOrthography(raw);
      transcript = out.cleaned;
      cleanupCost = out.costUsd || 0;
      log(jobId, `cleanup done · $${cleanupCost.toFixed(4)}`);
    } catch (e) {
      log(jobId, `cleanup falló (continuamos con raw): ${e.message}`);
    }

    const whisperJsonPath = path.join(jobDir, 'whisper.json');
    fs.writeFileSync(whisperJsonPath, JSON.stringify(transcript));
    fs.unlinkSync(audioPath);

    await run(
      `UPDATE reel_jobs
       SET whisper_json_path=?, whisper_cost_usd=?, total_cost_usd=?, stage_index=3, status='awaiting_review'
       WHERE id=?`,
      [whisperJsonPath, whisperCost, whisperCost + cleanupCost, jobId]
    );
    log(jobId, `→ awaiting_review (silencios)`);
  } catch (err) {
    console.error(`[reels:${jobId.slice(0,8)}] error:`, err.message);
    await run('UPDATE reel_jobs SET status=?, error_message=? WHERE id=?',
      ['error', err.message.slice(0, 500), jobId]).catch(() => {});
  }
}

/**
 * Usuario aprobó silencios. Render del base.mp4 (cuts+crop, sin subs) + burn-in inicial.
 * Tras esto, status='awaiting_style_review'.
 */
export async function applyCutsAndRenderBase(jobId, cuts) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_review', 'awaiting_style_review', 'done', 'error'].includes(job.status)) {
    throw new Error(`Job en estado ${job.status}, no se puede aplicar cortes`);
  }
  if (!job.source_video_path || !fs.existsSync(job.source_video_path)) {
    throw new Error('El video fuente fue purgado');
  }
  if (!job.whisper_json_path || !fs.existsSync(job.whisper_json_path)) {
    throw new Error('Falta el transcript del job');
  }

  const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
  const keepSegments = buildKeepSegments(cuts, job.duration_seconds);
  if (keepSegments.length === 0) {
    throw new Error('No queda nada del video tras aplicar los cortes');
  }
  const finalDuration = keepSegments.reduce((a, s) => a + s.durationOriginal, 0);
  const remapped = remapWords(transcript.words || [], keepSegments);

  await run(
    `UPDATE reel_jobs SET cuts_json=?, remapped_words_json=?, output_duration_seconds=?,
     status='rendering_base', stage_index=4, preview_dirty=1
     WHERE id=?`,
    [JSON.stringify(cuts), JSON.stringify(remapped), finalDuration, jobId]
  );

  // Lanzar async para no bloquear el HTTP.
  _renderBaseAsync(jobId, job, keepSegments, remapped, finalDuration).catch(err => {
    console.error(`[reels:${jobId.slice(0,8)}] base render error:`, err.message);
  });
}

async function _renderBaseAsync(jobId, job, keepSegments, remappedWords, finalDuration) {
  try {
    const jobDir = path.join(REELS_ROOT, jobId);
    const basePath = path.join(jobDir, 'base.mp4');

    log(jobId, `rendering base · ${keepSegments.length} segments · final ${finalDuration.toFixed(1)}s`);
    await renderReelBase({
      sourceVideo: job.source_video_path,
      keepSegments,
      outputPath: basePath,
    });
    log(jobId, `base done`);

    await run(`UPDATE reel_jobs SET base_video_path=?, stage_index=5 WHERE id=?`, [basePath, jobId]);

    // Primera burn-in con estilo default (o el guardado si re-render).
    await _burnPreview(jobId);

    await run(
      `UPDATE reel_jobs SET status='awaiting_style_review', stage_index=6, preview_dirty=0 WHERE id=?`,
      [jobId]
    );
    log(jobId, `→ awaiting_style_review`);
  } catch (err) {
    console.error(`[reels:${jobId.slice(0,8)}] render error:`, err.message);
    await run('UPDATE reel_jobs SET status=?, error_message=? WHERE id=?',
      ['error', err.message.slice(0, 500), jobId]).catch(() => {});
  }
}

async function _burnPreview(jobId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!job.base_video_path || !fs.existsSync(job.base_video_path)) {
    throw new Error('Base video no existe');
  }
  if (!job.remapped_words_json) throw new Error('Falta remapped_words_json');

  const remapped = JSON.parse(job.remapped_words_json);
  const overrides = job.caption_overrides ? JSON.parse(job.caption_overrides) : [];
  const finalDuration = job.output_duration_seconds || 0;
  const style = {
    fontCaption: job.font_caption,
    captionColor: job.caption_color,
    outlineColor: job.outline_color,
    captionFontSize: job.caption_font_size,
    subPosition: job.sub_position,
    outlineThickness: job.outline_thickness,
  };

  const jobDir = path.join(REELS_ROOT, jobId);
  const assPath = path.join(jobDir, 'subs.ass');
  const outPath = path.join(jobDir, 'reel.mp4');

  fs.writeFileSync(assPath, buildReelAss(remapped, finalDuration, style, overrides));
  await burnSubsOnBase({
    baseVideo: job.base_video_path,
    assPath,
    outputPath: outPath,
    voiceAutolevel: !!job.voice_autolevel,
    voiceGainDb: job.voice_gain_db || 0,
  });
  await run(`UPDATE reel_jobs SET output_path=?, preview_dirty=0 WHERE id=?`, [outPath, jobId]);
  log(jobId, `preview burned (font=${style.fontCaption}, color=${style.captionColor}, pos=${style.subPosition}, voice=${job.voice_autolevel ? 'auto' : 'off'}${job.voice_gain_db ? `+${job.voice_gain_db}dB` : ''})`);
}

/**
 * Re-burn del preview con el estilo + overrides actuales en DB.
 * Async; el frontend hace polling.
 */
export async function renderPreview(jobId) {
  const job = await get('SELECT user_id, status FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_style_review', 'done', 'error'].includes(job.status)) {
    throw new Error(`Job en estado ${job.status}, no se puede re-renderizar el preview`);
  }
  await run(`UPDATE reel_jobs SET status='rendering_preview', stage_index=5, preview_dirty=1 WHERE id=?`, [jobId]);
  // async
  (async () => {
    try {
      await _burnPreview(jobId);
      await run(`UPDATE reel_jobs SET status='awaiting_style_review', stage_index=6 WHERE id=?`, [jobId]);
    } catch (err) {
      console.error(`[reels:${jobId.slice(0,8)}] preview re-render error:`, err.message);
      await run('UPDATE reel_jobs SET status=?, error_message=? WHERE id=?',
        ['error', err.message.slice(0, 500), jobId]).catch(() => {});
    }
  })();
}

/**
 * Actualiza estilo + overrides de texto. NO re-renderiza (eso lo pide el usuario explícito).
 * Marca preview_dirty=1 si algo cambió.
 */
export async function updateStyle(jobId, patch) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');

  const fields = [];
  const values = [];
  const allowed = [
    'font_caption', 'caption_color', 'outline_color', 'caption_font_size', 'sub_position', 'outline_thickness',
    'voice_autolevel', 'voice_gain_db',
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      let v = patch[k];
      if (k === 'voice_autolevel') v = v ? 1 : 0;
      if (k === 'voice_gain_db') v = Math.max(-12, Math.min(18, parseInt(v, 10) || 0));
      fields.push(`${k}=?`);
      values.push(v);
    }
  }
  if (patch.caption_overrides !== undefined) {
    fields.push('caption_overrides=?');
    values.push(typeof patch.caption_overrides === 'string'
      ? patch.caption_overrides
      : JSON.stringify(patch.caption_overrides));
  }
  if (!fields.length) return;
  fields.push('preview_dirty=1');
  values.push(jobId);
  await run(`UPDATE reel_jobs SET ${fields.join(', ')} WHERE id=?`, values);
}

/**
 * Avanza de awaiting_style_review al paso de música.
 * Lo que esté en output_path (reel con subs quemados) será la base para la mezcla.
 */
export async function continueToMusicReview(jobId) {
  const job = await get('SELECT status, preview_dirty FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_style_review', 'awaiting_music_review', 'done'].includes(job.status)) {
    throw new Error(`No se puede pasar a música desde estado ${job.status}`);
  }
  // Si los subs están dirty, los re-burneamos antes de pasar a música (sino la mezcla
  // tomaría un base con subs viejos).
  if (job.preview_dirty) await _burnPreview(jobId);
  await run(`UPDATE reel_jobs SET status='awaiting_music_review', stage_index=6 WHERE id=?`, [jobId]);
}

export async function reopenStyleReview(jobId) {
  const job = await get('SELECT status FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_music_review', 'done'].includes(job.status)) {
    throw new Error(`No se puede volver a estilo desde ${job.status}`);
  }
  await run(`UPDATE reel_jobs SET status='awaiting_style_review', stage_index=5 WHERE id=?`, [jobId]);
}

/**
 * Guarda la selección de música del usuario (track + parámetros).
 */
export async function updateMusic(jobId, patch) {
  const fields = [];
  const values = [];
  const allowed = [
    'music_track_id', 'music_volume_db', 'music_ducking',
    'music_fade_in', 'music_fade_out', 'music_start_offset', 'music_skipped',
  ];
  for (const k of allowed) {
    if (patch[k] !== undefined) {
      fields.push(`${k}=?`);
      values.push(patch[k]);
    }
  }
  if (!fields.length) return;
  values.push(jobId);
  await run(`UPDATE reel_jobs SET ${fields.join(', ')} WHERE id=?`, values);
}

/**
 * Mezcla la música actual sobre el reel (output_path con subs quemados) y guarda
 * el resultado en output_with_music.mp4. Async; el frontend hace polling.
 */
export async function renderMusicMix(jobId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_music_review', 'done'].includes(job.status)) {
    throw new Error(`Estado ${job.status} no permite re-mezclar música`);
  }
  if (!job.music_track_id) throw new Error('No hay track de música seleccionado');
  if (!job.output_path || !fs.existsSync(job.output_path)) {
    throw new Error('Reel sin música base no existe');
  }

  await run(`UPDATE reel_jobs SET status='rendering_music_mix', stage_index=7 WHERE id=?`, [jobId]);

  (async () => {
    try {
      const track = await getMusicTrack(job.music_track_id);
      if (!track) throw new Error('Track de música no existe');
      const localFile = await ensureLocalFile(track); // lazy download si es remoto
      const jobDir = path.join(REELS_ROOT, jobId);
      const out = path.join(jobDir, 'reel_with_music.mp4');
      await mixMusicOntoReel({
        reelVideo: job.output_path,
        musicPath: localFile,
        reelDuration: job.output_duration_seconds,
        volumeDb: job.music_volume_db ?? -16,
        ducking: !!job.music_ducking,
        fadeIn: job.music_fade_in ?? 1.0,
        fadeOut: job.music_fade_out ?? 1.5,
        startOffset: job.music_start_offset ?? 0,
        outputPath: out,
      });
      log(jobId, `music mix done · track=${track.name}`);
      await run(`UPDATE reel_jobs SET status='awaiting_music_review', stage_index=8 WHERE id=?`, [jobId]);
    } catch (err) {
      console.error(`[reels:${jobId.slice(0,8)}] music mix error:`, err.message);
      await run('UPDATE reel_jobs SET status=?, error_message=? WHERE id=?',
        ['error', err.message.slice(0, 500), jobId]).catch(() => {});
    }
  })();
}

/**
 * Pide al LLM que sugiera 3 tracks del catálogo dados el transcript + duración.
 * Devuelve array de track ids ordenados por relevancia. No modifica la DB.
 */
export async function suggestMusic(jobId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!job.whisper_json_path || !fs.existsSync(job.whisper_json_path)) {
    throw new Error('Falta transcript del job');
  }
  const tracks = await listMusicTracks({});
  if (tracks.length === 0) return { suggestions: [], reasoning: 'Tu biblioteca está vacía.' };

  const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
  const text = (transcript.words || []).map(w => w.word).join(' ').slice(0, 2500);

  // Catálogo numerado: usamos índices (1..N) para que el LLM no pueda alucinar IDs.
  // Mapeamos de vuelta a ids reales al validar.
  const numberedCatalog = tracks.map((t, i) => ({
    num: i + 1,
    name: t.name,
    artist: t.artist || '',
    tags: t.tags,
    bpm: t.bpm,
    duration_seconds: t.duration_seconds,
  }));

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!anthropicKey && !openaiKey) throw new Error('Ni ANTHROPIC_API_KEY ni OPENAI_API_KEY configuradas');

  const systemPrompt = `Eres un curador musical experto para reels de Instagram/TikTok. Recibes la transcripción de un reel y un catálogo numerado de tracks. Recomienda los 3 mejores tracks ordenados por relevancia.

REGLAS:
1. Devuelves SIEMPRE 3 sugerencias (o todas si el catálogo tiene menos de 3).
2. Usas SOLO los números (1, 2, 3…) del catálogo numerado que te paso. No inventes números fuera del rango.
3. Las 3 sugerencias deben ser VARIADAS — no 3 tracks casi idénticos. Una opción segura (mejor fit) + dos opciones alternativas con tonos distintos pero también válidos.
4. Cada "reason" debe ser una frase CONCRETA explicando por qué encaja con el contenido específico (no genérica como "tiene buen tono"). Cita algo del transcript si ayuda.

Tags disponibles (slug:categoría:label): ${tagsCatalogForLLM()}

Devuelves JSON con esta estructura exacta:
{"suggestions": [{"num": 1, "reason": "..."}, {"num": 23, "reason": "..."}, {"num": 47, "reason": "..."}], "summary": "una línea sobre el tono del reel"}`;

  const userPrompt = `Transcripción (duración ${(job.output_duration_seconds || 0).toFixed(0)}s):
"""
${text}
"""

Catálogo numerado (${numberedCatalog.length} tracks). Usa solo los "num" de esta lista:
${JSON.stringify(numberedCatalog, null, 2)}

Devuelve EXACTAMENTE 3 sugerencias variadas en JSON.`;

  let parsed;
  if (anthropicKey) {
    // Claude — mejor instrucción siguiendo + JSON estricto.
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Claude error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    // Extraer JSON del response (Claude a veces lo envuelve en ```json … ```)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude no devolvió JSON parseable');
    parsed = JSON.parse(jsonMatch[0]);
  } else {
    // Fallback OpenAI
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    parsed = JSON.parse(data.choices[0].message.content);
  }

  // Mapear num → id real (validación trivial: num está en rango 1..N).
  const suggestions = (parsed.suggestions || [])
    .map(s => {
      const num = parseInt(s.num, 10);
      if (!num || num < 1 || num > tracks.length) return null;
      return { id: tracks[num - 1].id, reason: s.reason || '' };
    })
    .filter(Boolean)
    .slice(0, 3);

  // Estimar costo: ~4 chars/token aproximado. Input = systemPrompt + userPrompt. Output ~300 tokens.
  // Pricing: gpt-4o-mini = $0.15/1M in, $0.60/1M out. Claude Sonnet = $3/1M in, $15/1M out.
  const inTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
  const outTokens = 300;
  const usedClaude = !!anthropicKey;
  const costUsd = usedClaude
    ? (inTokens * 3 + outTokens * 15) / 1_000_000
    : (inTokens * 0.15 + outTokens * 0.60) / 1_000_000;
  await run(
    `UPDATE reel_jobs SET llm_cost_suggest_usd=COALESCE(llm_cost_suggest_usd,0)+?, total_cost_usd=total_cost_usd+? WHERE id=?`,
    [costUsd, costUsd, jobId]
  ).catch(() => {});

  return { suggestions, summary: parsed.summary || '', costUsd };
}

/**
 * Marca el job como done. Si está en music_review con track seleccionado, asegura mezcla actualizada.
 */
export async function finalize(jobId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');

  if (job.status === 'awaiting_style_review' || job.preview_dirty) {
    if (job.preview_dirty) await _burnPreview(jobId);
  }
  // Si está en music_review con track, asegurar que la mezcla está hecha.
  // (Si el usuario va directo a finalize sin haber pulsado "Mezclar preview", lo hacemos ahora.)
  if (job.status === 'awaiting_music_review' && job.music_track_id && !job.music_skipped) {
    const jobDir = path.join(REELS_ROOT, jobId);
    const mixed = path.join(jobDir, 'reel_with_music.mp4');
    if (!fs.existsSync(mixed)) {
      const track = await getMusicTrack(job.music_track_id);
      if (track) {
        const localFile = await ensureLocalFile(track);
        await mixMusicOntoReel({
          reelVideo: job.output_path,
          musicPath: localFile,
          reelDuration: job.output_duration_seconds,
          volumeDb: job.music_volume_db ?? -16,
          ducking: !!job.music_ducking,
          fadeIn: job.music_fade_in ?? 1.0,
          fadeOut: job.music_fade_out ?? 1.5,
          startOffset: job.music_start_offset ?? 0,
          outputPath: mixed,
        });
      }
    }
  }
  await run(`UPDATE reel_jobs SET status='done', finished_at=CURRENT_TIMESTAMP WHERE id=?`, [jobId]);

  // Trackear en usage_stats (solo si NO estaba ya done — evita doble-cuenta si re-finaliza).
  if (job.status !== 'done') {
    const durMinutes = (job.output_duration_seconds || 0) / 60;
    const fresh = await get('SELECT total_cost_usd FROM reel_jobs WHERE id=?', [jobId]);
    trackReelUsage({ durationMinutes: durMinutes, costUsd: fresh?.total_cost_usd || 0 }).catch(() => {});
  }
}

/**
 * Renderiza 10s de muestra del base.mp4 con el procesamiento de voz indicado en `opts`
 * (o el guardado en el job si no se pasa). NO modifica el job — solo escribe un .mp3
 * temporal y devuelve su path. El cliente lo reproduce y al cerrar Paso 2 se purga con
 * el resto del jobDir.
 *
 * Acepta startSec opcional para que el usuario elija desde dónde escuchar (default 0).
 */
export async function generateVoiceSample(jobId, { startSec = 0, autolevel, gainDb } = {}) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!job.base_video_path || !fs.existsSync(job.base_video_path)) {
    throw new Error('Aún no hay base render para muestrear');
  }
  // Si el caller no manda flags, usamos los del job.
  const useAuto = autolevel === undefined ? !!job.voice_autolevel : !!autolevel;
  const useGain = gainDb === undefined ? (job.voice_gain_db || 0) : Math.max(-12, Math.min(18, parseInt(gainDb, 10) || 0));

  const jobDir = path.join(REELS_ROOT, jobId);
  const outPath = path.join(jobDir, `voice_sample_${Date.now()}.mp3`);
  // Limpiamos samples viejos (el usuario solo necesita el último).
  try {
    for (const f of fs.readdirSync(jobDir)) {
      if (f.startsWith('voice_sample_') && f.endsWith('.mp3')) {
        try { fs.unlinkSync(path.join(jobDir, f)); } catch {}
      }
    }
  } catch {}

  await renderVoiceSample({
    baseVideo: job.base_video_path,
    startSec: Math.max(0, startSec),
    durationSec: 10,
    autolevel: useAuto,
    gainDb: useGain,
    outputPath: outPath,
  });
  return outPath;
}

/**
 * Permite volver del style_review al silence_review (sin perder el transcript).
 */
export async function reopenSilenceReview(jobId) {
  const job = await get('SELECT status FROM reel_jobs WHERE id=?', [jobId]);
  if (!job) throw new Error('Job no encontrado');
  if (!['awaiting_style_review', 'done'].includes(job.status)) {
    throw new Error(`No se puede reabrir desde estado ${job.status}`);
  }
  await run(`UPDATE reel_jobs SET status='awaiting_review', stage_index=3 WHERE id=?`, [jobId]);
}

/**
 * Job para el frontend. Incluye transcript+gaps (silence review) o chunks (style review)
 * según el estado.
 */
export async function getJobForUser(jobId, userId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?', [jobId, userId]);
  if (!job) return null;

  const payload = { ...job };
  payload.stages = REEL_STAGES;
  payload.font_options = REEL_FONT_OPTIONS;

  if (job.whisper_json_path && fs.existsSync(job.whisper_json_path)) {
    try {
      const transcript = JSON.parse(fs.readFileSync(job.whisper_json_path, 'utf8'));
      payload.words = transcript.words || [];
      payload.gaps = detectGaps(transcript);
    } catch {
      payload.words = [];
      payload.gaps = [];
    }
  }
  if (job.cuts_json) {
    try { payload.cuts = JSON.parse(job.cuts_json); } catch { payload.cuts = []; }
  }
  if (job.remapped_words_json) {
    try {
      const remapped = JSON.parse(job.remapped_words_json);
      const overrides = job.caption_overrides ? JSON.parse(job.caption_overrides) : [];
      payload.chunks = buildChunks(remapped, job.output_duration_seconds || 0, overrides);
    } catch { payload.chunks = []; }
  }
  if (job.music_track_id) {
    try { payload.music_track = await getMusicTrack(job.music_track_id); } catch { payload.music_track = null; }
  }
  payload.music_tags_catalog = MUSIC_TAGS;
  // Si existe la mezcla con música, indicárselo al frontend.
  const mixedPath = path.join(REELS_ROOT, jobId, 'reel_with_music.mp4');
  payload.has_music_mix = fs.existsSync(mixedPath);

  return payload;
}

export async function listJobsForUser(userId) {
  return all(
    `SELECT id, title, source_filename, status, stage_index, duration_seconds,
            output_duration_seconds, error_message, created_at, finished_at, files_purged
     FROM reel_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 100`,
    [userId]
  );
}

export async function deleteJob(jobId, userId) {
  const job = await get('SELECT * FROM reel_jobs WHERE id=? AND user_id=?', [jobId, userId]);
  if (!job) return { success: false, message: 'Job no encontrado' };
  const jobDir = path.join(REELS_ROOT, jobId);
  try { if (fs.existsSync(jobDir)) fs.rmSync(jobDir, { recursive: true, force: true }); } catch {}
  await run('DELETE FROM reel_jobs WHERE id=?', [jobId]);
  return { success: true };
}

export async function recoverZombieReels() {
  const result = await run(
    `UPDATE reel_jobs SET status='error', error_message='Servidor reiniciado durante el procesamiento'
     WHERE status IN ('pending', 'running', 'rendering_base', 'rendering_preview', 'rendering_music_mix')`
  );
  return result.changes || 0;
}
