// api/reels/silenceDetector.js
// Detecta gaps de silencio entre palabras del transcript de Whisper.
// No re-analiza el audio: usa los timestamps por palabra que Whisper ya entrega.

/**
 * Devuelve TODOS los gaps entre palabras consecutivas, sin filtrar por umbral.
 * El frontend filtra contra el threshold actual al mostrar (slider en vivo).
 *
 * @param {object} whisperJson — { words: [{word, start, end}], duration }
 * @returns {Array<{idx, start, end, duration, prevWord, nextWord}>}
 */
export function detectGaps(whisperJson) {
  const words = (whisperJson?.words || []).filter(w => typeof w.start === 'number' && typeof w.end === 'number');
  if (words.length < 2) return [];

  const gaps = [];

  // Gap inicial (antes de la primera palabra)
  if (words[0].start > 0.15) {
    gaps.push({
      idx: 0,
      start: 0,
      end: words[0].start,
      duration: words[0].start,
      prevWord: null,
      nextWord: (words[0].word || '').trim(),
      position: 'leading',
    });
  }

  // Gaps internos
  for (let i = 0; i < words.length - 1; i++) {
    const a = words[i];
    const b = words[i + 1];
    const gap = b.start - a.end;
    if (gap > 0.15) {
      gaps.push({
        idx: gaps.length,
        start: a.end,
        end: b.start,
        duration: +gap.toFixed(3),
        prevWord: (a.word || '').trim(),
        nextWord: (b.word || '').trim(),
        position: 'internal',
      });
    }
  }

  // Gap final (después de la última palabra hasta duration)
  const last = words[words.length - 1];
  const total = whisperJson?.duration ?? last.end;
  if (total - last.end > 0.15) {
    gaps.push({
      idx: gaps.length,
      start: last.end,
      end: total,
      duration: +(total - last.end).toFixed(3),
      prevWord: (last.word || '').trim(),
      nextWord: null,
      position: 'trailing',
    });
  }

  return gaps;
}

/**
 * Dada la lista de cortes que el usuario confirmó (cada uno = rango a ELIMINAR del video),
 * construye los "segmentos a mantener": pares [start,end] del video original que se concatenan
 * en orden para producir el video final.
 *
 * Aplica un pad simétrico para evitar comerse la cola de la palabra previa o el ataque de la
 * siguiente (consonantes como "N", "P", "T" tienen transients muy cortos pero audibles).
 * Default 100ms — estándar de edición profesional de habla.
 *
 * @param {Array<{start, end}>} cuts — rangos a eliminar (en segundos, en timeline original)
 * @param {number} totalDuration — duración del video original en segundos
 * @param {number} padSeconds — margen de seguridad alrededor de cada corte (default 0.10s)
 * @returns {Array<{start, end, durationOriginal, newStart, newEnd}>}
 */
export function buildKeepSegments(cuts, totalDuration, padSeconds = 0.10) {
  // Normalizar: ordenar, encoger por pad, descartar cortes inválidos, mergear si se solapan.
  // Padding asimétrico para cortes anclados a borde (start=0 o end=duration):
  //   - El borde anclado: 0 pad (no hay nada que proteger fuera del archivo).
  //   - El otro extremo: tampoco se padea. Whisper marca arranque/fin de palabra
  //     con precisión ~10ms; un pad de 100ms aquí dejaría silencio audible antes
  //     de la primera palabra (o después de la última), justo lo que el usuario
  //     pidió eliminar al marcar un trim-head/tail o un silencio de borde.
  // Cortes internos (entre dos palabras): pad simétrico estándar para no comer
  // la cola del fonema previo ni el ataque del siguiente.
  const padded = (cuts || [])
    .map(c => {
      const isBoundaryCut = c.start <= 0.001 || c.end >= totalDuration - 0.001;
      const pad = isBoundaryCut ? 0 : padSeconds;
      return {
        start: Math.max(0, c.start + pad),
        end: Math.min(totalDuration, c.end - pad),
      };
    })
    .filter(c => c.end > c.start + 0.05)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const c of padded) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end) {
      last.end = Math.max(last.end, c.end);
    } else {
      merged.push({ ...c });
    }
  }

  // Invertir: lo que NO está cortado = a mantener.
  const keeps = [];
  let cursor = 0;
  for (const c of merged) {
    if (c.start > cursor + 0.05) {
      keeps.push({ start: cursor, end: c.start });
    }
    cursor = Math.max(cursor, c.end);
  }
  if (totalDuration - cursor > 0.05) {
    keeps.push({ start: cursor, end: totalDuration });
  }

  // Anotar timeline final.
  let newCursor = 0;
  return keeps.map(k => {
    const dur = k.end - k.start;
    const segment = {
      start: +k.start.toFixed(3),
      end: +k.end.toFixed(3),
      durationOriginal: +dur.toFixed(3),
      newStart: +newCursor.toFixed(3),
      newEnd: +(newCursor + dur).toFixed(3),
    };
    newCursor += dur;
    return segment;
  });
}

/**
 * Re-mapea las palabras del transcript original a la timeline del video editado.
 * Palabras que caen dentro de un corte se DESCARTAN.
 * Palabras que caen en un keep segment reciben nuevos timestamps relativos al video final.
 *
 * @param {Array} originalWords — words array del whisper.json
 * @param {Array} keepSegments — output de buildKeepSegments
 * @returns {Array} words con start/end remapeados
 */
export function remapWords(originalWords, keepSegments) {
  const out = [];
  for (const w of originalWords || []) {
    if (typeof w.start !== 'number' || typeof w.end !== 'number') continue;
    // Buscar segmento que contenga la palabra completa.
    const seg = keepSegments.find(s => w.start >= s.start - 0.02 && w.end <= s.end + 0.02);
    if (!seg) continue; // palabra cae dentro de un corte
    const offset = seg.newStart - seg.start;
    out.push({
      ...w,
      start: +(w.start + offset).toFixed(3),
      end: +(w.end + offset).toFixed(3),
    });
  }
  return out;
}
