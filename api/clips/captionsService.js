// api/clips/captionsService.js
// Modelo Opus: el transcript ya generado se sirve como "capa de captions" editable.
// Los chunks viven en memoria/cómputo derivado del whisper.json + overrides en DB.
// El frontend los renderiza encima del base.mp4 sin tocar ffmpeg en cada edición.
import fs from 'fs';

// Agrupa palabras del transcript en chunks de 2-3 palabras o ~22 chars (matching el .ass).
// Retorna timestamps absolutos (del transcript), el caller los pasa a relativos si los muestra.
export function chunkWordsForClip(whisperJson, startSeconds, endSeconds) {
  const words = (whisperJson.words || []).filter(
    w => w.start >= startSeconds - 0.05 && w.end <= endSeconds + 0.05
  );
  if (words.length === 0) return [];

  const chunks = [];
  let buf = [], chars = 0;
  for (const w of words) {
    const wlen = (w.word || '').trim().length;
    if (buf.length >= 3 || chars + wlen + 1 > 22) {
      if (buf.length) chunks.push(buf);
      buf = []; chars = 0;
    }
    buf.push(w);
    chars += wlen + 1;
  }
  if (buf.length) chunks.push(buf);

  let lastEndedSentence = true;
  return chunks.map((chunk, idx) => {
    const start = chunk[0].start;
    const end = Math.max(start + 0.1, chunk[chunk.length - 1].end);
    const words = chunk.map(c => ({
      text: (c.word || '').trim(),
      start: c.start,
      end: c.end,
    }));
    let text = words.map(w => w.text).join(' ');
    if (lastEndedSentence) text = text.charAt(0).toUpperCase() + text.slice(1);
    else text = text.charAt(0).toLowerCase() + text.slice(1);
    lastEndedSentence = /[.!?]\s*$/.test(text);
    return { idx, start, end, text, words };
  });
}

// Devuelve los chunks listos para el frontend: timestamps relativos al inicio del clip,
// con overrides aplicados (texto custom o hidden=true).
export function getCaptionChunks(clip, whisperJson) {
  const baseChunks = chunkWordsForClip(whisperJson, clip.start_seconds, clip.end_seconds);
  let overrides = [];
  try { overrides = clip.caption_overrides ? JSON.parse(clip.caption_overrides) : []; } catch { overrides = []; }
  const ovMap = new Map(overrides.map(o => [o.idx, o]));

  return baseChunks.map(c => {
    const ov = ovMap.get(c.idx);
    // Las words mantienen su tiempo absoluto (los chunks se trasladan al inicio del clip);
    // el frontend recalcula la palabra activa contra videoRef.currentTime relativo al clip.
    const relWords = (c.words || []).map(w => ({
      text: w.text,
      start: +(w.start - clip.start_seconds).toFixed(3),
      end: +(w.end - clip.start_seconds).toFixed(3),
    }));
    return {
      idx: c.idx,
      start: +(c.start - clip.start_seconds).toFixed(3),
      end: +(c.end - clip.start_seconds).toFixed(3),
      text: ov?.text !== undefined ? ov.text : c.text,
      original_text: c.text,
      words: relWords,
      hidden: !!ov?.hidden,
      edited: ov?.text !== undefined && ov.text !== c.text,
    };
  });
}

// Carga whisper.json desde disco. Devuelve {} si no existe (clips legacy).
export function loadWhisperJson(jobWhisperPath) {
  if (!jobWhisperPath || !fs.existsSync(jobWhisperPath)) return { words: [] };
  try { return JSON.parse(fs.readFileSync(jobWhisperPath, 'utf8')); }
  catch { return { words: [] }; }
}
