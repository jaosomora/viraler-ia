// api/clips/orthographyCleanup.js
// Pasa el transcript de Whisper por GPT-4o-mini para corregir acentos y puntuación
// preservando el conteo de palabras y los timestamps. Una sola llamada con todo el
// transcript siempre que quepa (gpt-4o-mini soporta 128K) — así el modelo ve el
// contexto global y no inventa puntos finales en chunks boundary, ni capitaliza
// líneas que son mitad de frase. Si una línea individual cambia el conteo de
// tokens (ej. "porque" → "por qué"), se descarta SOLO esa línea, no todo el job.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;

const CALL_TIMEOUT_MS = 120_000;
// Si la entrada supera ~80K chars (~20K tokens), partimos en chunks grandes con
// solape de contexto. Para la mayoría de jobs cabe todo en una llamada.
const SINGLE_CALL_MAX_CHARS = 80_000;
const CHUNK_SIZE_SEGMENTS = 120;       // segmentos por chunk en modo fallback
const CHUNK_CONTEXT_OVERLAP = 5;       // líneas de contexto antes/después (read-only)

const SYSTEM_PROMPT = `Eres un editor de transcripciones en español. Recibes líneas numeradas de un transcript de Whisper y debes corregir acentos, mayúsculas y puntuación SIN cambiar las palabras.

Reglas estrictas (en orden de prioridad):

1. CONTEO DE PALABRAS IDÉNTICO POR LÍNEA. Si te tienta separar o unir palabras de forma que cambie el conteo de tokens (separados por espacio) de una línea, NO LO HAGAS. Mantén la forma original aunque te parezca incorrecta. Ejemplos: si recibes "porque" no lo cambies a "por qué"; si recibes "por que" no lo unas a "porque"; si recibes "deeste" no lo separes a "de este".

2. NO agregues, no quites, no reordenes palabras.

3. Conserva exactamente la misma cantidad de líneas y el mismo número [N] al inicio.

4. Decisiones de puntuación y mayúsculas usando el contexto COMPLETO del transcript: una frase que continúa entre dos líneas NO lleva punto al final de la primera ni mayúscula al inicio de la segunda. Solo capitaliza el verdadero inicio de oración. Solo cierra con punto donde verdaderamente termina la idea.

REGLA CRÍTICA SOBRE MAYÚSCULAS A MITAD DE FRASE: si la línea anterior NO termina en . ! ? entonces la línea actual DEBE empezar en MINÚSCULA. Aplica incluso a conjunciones, pronombres y preposiciones que parezcan "iniciar idea" — son continuación, deben ir en minúscula. Ejemplos correctos:
  [0] Estás evitando tu deseo porque sabes que viene con cambios
  [1] y eso asusta más que quedarte donde estás   ← minúscula porque [0] no termina con . ! ?
  [2] lo sentiste, ese deseo profundo                ← minúscula porque [1] no termina con . ! ?
  [3] pero apenas apareció, te escondiste detrás     ← minúscula porque [2] termina en coma, no en punto
Ejemplo INCORRECTO (NO hagas esto):
  [0] Estás evitando tu deseo porque sabes que viene con cambios
  [1] Y eso asusta...   ← MAL: "Y" no debe ir en mayúscula porque la frase continúa
Palabras frecuentes que GPT tiende a capitalizar mal: Y, O, Pero, Porque, Si, Cuando, Como, No, Tu, Mi, Lo, El, La, Un, De, Para, Por, Con, Que. Vigila estas en cada línea.

5. Acentos: corrige los faltantes según la regla ortográfica española (interrogativos, pronombres tónicos, verbos en pasado, etc.).

6. Signos de apertura: en español las preguntas llevan ¿ al inicio y ? al final; las exclamaciones ¡ ... !. Pero ojo regla #1: si agregas ¿ o ¡ como token separado con espacio, eso cambia el conteo. Pégalo a la palabra siguiente sin espacio: "¿Qué" no "¿ Qué".

Devuelve JSON: {"lines": [{"i": number, "text": string}]}`;

async function fetchWithTimeout(url, options, timeoutMs) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  catch (e) {
    if (e.name === 'AbortError') throw new Error('Cleanup timeout');
    throw e;
  } finally { clearTimeout(t); }
}

const tokenize = (text) => text.split(/\s+/).filter(Boolean);

function buildPayload(segments, offset = 0, contextBefore = [], contextAfter = []) {
  const numbered = segments.map((s, i) => `[${i}] ${s.text.trim()}`).join('\n');
  let userContent = '';
  if (contextBefore.length) {
    userContent += `Contexto anterior (NO devuelvas estas líneas, solo úsalas para decidir si una frase continúa):\n`;
    userContent += contextBefore.map(s => `... ${s.text.trim()}`).join('\n') + '\n\n';
  }
  userContent += `Líneas a corregir:\n${numbered}`;
  if (contextAfter.length) {
    userContent += `\n\nContexto posterior (NO devuelvas estas líneas, solo úsalas para decidir si una frase continúa):\n`;
    userContent += contextAfter.map(s => `... ${s.text.trim()}`).join('\n');
  }
  return { userContent, offset };
}

async function callOpenAI(apiKey, userContent) {
  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  }, CALL_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const parsed = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);
  return { lines: parsed.lines, cost };
}

// Aplica correcciones validando per-línea: si el conteo de tokens cambia,
// descarta esa línea (mantiene el original). Devuelve cuántas se aplicaron y descartaron.
function applyCorrections(segments, corrections, offset = 0) {
  let applied = 0;
  let skipped = 0;
  for (const c of corrections) {
    const globalIdx = c.i + offset;
    const seg = segments[globalIdx];
    if (!seg || !c.text) { skipped += 1; continue; }
    const origCount = tokenize(seg.text).length;
    const newCount = tokenize(c.text).length;
    if (origCount !== newCount) { skipped += 1; continue; }
    seg.text = c.text;
    applied += 1;
  }
  return { applied, skipped };
}

/**
 * Limpia ortografía/puntuación del transcript de Whisper preservando timestamps.
 * @param {object} whisperJson — JSON original con words y segments.
 * @returns {Promise<{cleaned, costUsd, stats}>} — cleaned tiene misma estructura.
 */
export async function cleanupOrthography(whisperJson) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { cleaned: whisperJson, costUsd: 0, stats: { applied: 0, skipped: 0 } };

  const segments = whisperJson.segments || [];
  if (segments.length === 0) return { cleaned: whisperJson, costUsd: 0, stats: { applied: 0, skipped: 0 } };

  const cloned = JSON.parse(JSON.stringify(whisperJson));
  const totalChars = segments.reduce((acc, s) => acc + (s.text?.length || 0), 0);
  let totalCost = 0;
  let totalApplied = 0;
  let totalSkipped = 0;

  try {
    // Modo preferido: una sola llamada con TODO el transcript → contexto global perfecto.
    if (totalChars <= SINGLE_CALL_MAX_CHARS) {
      const { userContent } = buildPayload(segments);
      const { lines, cost } = await callOpenAI(apiKey, userContent);
      totalCost += cost;
      if (!Array.isArray(lines) || lines.length !== segments.length) {
        console.warn(`[cleanup] line count mismatch (expected ${segments.length}, got ${lines?.length}), keeping original`);
        return { cleaned: whisperJson, costUsd: 0, stats: { applied: 0, skipped: segments.length } };
      }
      const { applied, skipped } = applyCorrections(cloned.segments, lines, 0);
      totalApplied += applied;
      totalSkipped += skipped;
    } else {
      // Modo fallback: chunks grandes con overlap de contexto (no en paralelo para
      // que el modelo pueda inferir continuidad con menos sorpresas).
      const chunks = [];
      for (let i = 0; i < segments.length; i += CHUNK_SIZE_SEGMENTS) {
        chunks.push({ offset: i, segs: segments.slice(i, i + CHUNK_SIZE_SEGMENTS) });
      }
      for (const c of chunks) {
        const ctxBefore = segments.slice(Math.max(0, c.offset - CHUNK_CONTEXT_OVERLAP), c.offset);
        const ctxAfter = segments.slice(c.offset + c.segs.length, c.offset + c.segs.length + CHUNK_CONTEXT_OVERLAP);
        const { userContent } = buildPayload(c.segs, c.offset, ctxBefore, ctxAfter);
        try {
          const { lines, cost } = await callOpenAI(apiKey, userContent);
          totalCost += cost;
          if (!Array.isArray(lines) || lines.length !== c.segs.length) {
            console.warn(`[cleanup] chunk @${c.offset} line count mismatch, skipping`);
            totalSkipped += c.segs.length;
            continue;
          }
          const { applied, skipped } = applyCorrections(cloned.segments, lines, c.offset);
          totalApplied += applied;
          totalSkipped += skipped;
        } catch (err) {
          console.warn(`[cleanup] chunk @${c.offset} failed: ${err.message}`);
          totalSkipped += c.segs.length;
        }
      }
    }

    totalCost = +totalCost.toFixed(6);

    // Re-mapear `words` per-segmento ahora que `segments[i].text` puede haber cambiado.
    // Solo re-asigna `word` cuando el conteo de tokens del segmento coincide con
    // el conteo de words que caen dentro del rango temporal del segmento. Si no
    // coincide, deja esos words como están (preservando alineación temporal).
    if (Array.isArray(whisperJson.words) && whisperJson.words.length) {
      const newWords = whisperJson.words.map(w => ({ ...w }));
      for (let si = 0; si < cloned.segments.length; si++) {
        const seg = cloned.segments[si];
        const wordIdxs = [];
        for (let wi = 0; wi < newWords.length; wi++) {
          const w = newWords[wi];
          // Un word pertenece a este segmento si su centro temporal cae en el rango.
          const center = (w.start + w.end) / 2;
          if (center >= seg.start && center < seg.end) wordIdxs.push(wi);
        }
        const toks = tokenize(seg.text);
        if (toks.length !== wordIdxs.length) continue; // no rematchea si difiere
        for (let k = 0; k < toks.length; k++) {
          newWords[wordIdxs[k]].word = toks[k];
        }
      }
      cloned.words = newWords;
    }

    console.log(`[cleanup] applied=${totalApplied} skipped=${totalSkipped} segments cost=$${totalCost}`);
    return { cleaned: cloned, costUsd: totalCost, stats: { applied: totalApplied, skipped: totalSkipped } };
  } catch (err) {
    console.warn('[cleanup] failed, using original:', err.message);
    return { cleaned: whisperJson, costUsd: totalCost, stats: { applied: totalApplied, skipped: totalSkipped } };
  }
}
