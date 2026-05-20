// api/clips/captionsService.js
// Modelo Opus: el transcript ya generado se sirve como "capa de captions" editable.
// Los chunks viven en memoria/cómputo derivado del whisper.json + overrides en DB.
// El frontend los renderiza encima del base.mp4 sin tocar ffmpeg en cada edición.
import fs from 'fs';

// Palabras españolas comunes que, cuando aparecen capitalizadas a mitad de frase
// (porque eran el primer token de un segment de Whisper, ej: "Y", "Pero", "Tu"),
// deben bajarse a minúscula. Lista curada de conjunciones, pronombres, preposiciones
// y partículas frecuentes — todas son no-nombres-propios. Si una persona realmente
// se llama "Y" o "Lo" estamos en problemas mayores que esto.
const MID_SENTENCE_LOWERCASE = new Set([
  // Conjunciones
  'Y', 'O', 'U', 'E', 'Ni', 'Pero', 'Mas', 'Sino', 'Aunque', 'Porque',
  'Pues', 'Si', 'Cuando', 'Mientras', 'Apenas', 'Como', 'Donde', 'Adonde',
  'Cuanto', 'Cuanta', 'Que', 'Quien', 'Quienes',
  // Pronombres y determinantes
  'El', 'La', 'Los', 'Las', 'Lo', 'Un', 'Una', 'Unos', 'Unas',
  'Mi', 'Tu', 'Su', 'Mis', 'Tus', 'Sus', 'Nuestro', 'Nuestra', 'Vuestro', 'Vuestra',
  'Este', 'Esta', 'Estos', 'Estas', 'Ese', 'Esa', 'Esos', 'Esas',
  'Aquel', 'Aquella', 'Aquellos', 'Aquellas', 'Esto', 'Eso', 'Aquello',
  'Me', 'Te', 'Se', 'Nos', 'Os', 'Le', 'Les',
  // Preposiciones
  'A', 'Ante', 'Bajo', 'Con', 'Contra', 'De', 'Del', 'Desde', 'En', 'Entre',
  'Hacia', 'Hasta', 'Para', 'Por', 'Según', 'Sin', 'Sobre', 'Tras',
  // Adverbios comunes
  'No', 'Sí', 'Muy', 'Más', 'Menos', 'Tan', 'Tanto', 'Ya', 'Aún', 'Aun',
  'También', 'Tampoco', 'Sólo', 'Solo', 'Casi', 'Apenas',
  'Quizá', 'Quizás', 'Acaso', 'Nunca', 'Jamás', 'Siempre', 'Ahora',
  'Antes', 'Después', 'Luego', 'Entonces', 'Hoy', 'Ayer', 'Mañana',
  'Aquí', 'Ahí', 'Allí', 'Allá', 'Acá', 'Arriba', 'Abajo', 'Dentro', 'Fuera',
  'Cerca', 'Lejos', 'Bien', 'Mal',
  // Verbos auxiliares y cópulas (no son nombres propios)
  'Es', 'Era', 'Soy', 'Eres', 'Somos', 'Son', 'Sois', 'Sea', 'Sean',
  'Está', 'Estás', 'Estoy', 'Estamos', 'Están', 'Fue', 'Fueron', 'Fui', 'Fuiste',
  'Hay', 'Había', 'Hubo', 'Habrá', 'Haya', 'He', 'Has', 'Ha', 'Hemos', 'Han',
]);

// Limpia capitalizaciones a mitad de frase. Recibe el texto del chunk (palabras
// separadas por espacio) y un flag indicando si la línea anterior cerró oración.
// Solo baja a minúscula palabras de la lista MID_SENTENCE_LOWERCASE que estén
// en posición de continuación (no después de . ! ?). Retorna el texto corregido.
function fixMidSentenceCaps(text, prevEndedSentence) {
  const tokens = text.split(/(\s+)/); // mantiene los espacios para reconstruir
  let endedSentence = prevEndedSentence;
  return tokens.map(tok => {
    if (!tok.trim()) return tok; // espacio puro
    if (!endedSentence && MID_SENTENCE_LOWERCASE.has(tok.replace(/[.,;:!?]+$/, ''))) {
      // Bajamos la inicial pero preservamos puntuación final si la hay
      tok = tok.charAt(0).toLowerCase() + tok.slice(1);
    }
    endedSentence = /[.!?]$/.test(tok.replace(/[,;:]+$/, ''));
    return tok;
  }).join('');
}

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
    // Paso 1: corrige mayúsculas mid-flow dentro del chunk (palabras de stop-list)
    text = fixMidSentenceCaps(text, lastEndedSentence);
    // Paso 2: ajusta la primera letra del chunk según el cierre del chunk anterior.
    //   - Si la anterior cerró oración → mayúscula inicial.
    //   - Si no → minúscula inicial (a menos que sea una palabra que sí debe ir
    //     en mayúscula, ej. nombre propio que no está en la stop-list).
    if (lastEndedSentence) text = text.charAt(0).toUpperCase() + text.slice(1);
    else {
      const firstWord = text.split(/\s/)[0] || '';
      const firstCore = firstWord.replace(/[.,;:!?]+$/, '');
      // Solo bajamos la inicial si es una palabra "segura" (stop-list) o si arranca
      // con minúscula ya. Si es una palabra que no está en stop-list y empieza con
      // mayúscula, asumimos que puede ser nombre propio y la dejamos.
      if (MID_SENTENCE_LOWERCASE.has(firstCore) || /^[a-záéíóúñü]/.test(firstWord)) {
        text = text.charAt(0).toLowerCase() + text.slice(1);
      }
    }
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
