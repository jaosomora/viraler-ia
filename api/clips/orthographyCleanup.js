// api/clips/orthographyCleanup.js
// Pasa el transcript de Whisper por GPT-4o-mini para corregir acentos y puntuación
// preservando el conteo de palabras y los timestamps. Si el modelo cambia el conteo,
// devolvemos el original (no rompemos el job).

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;

const CHUNK_SIZE = 30;          // segmentos por llamada
const CHUNK_TIMEOUT_MS = 45_000; // por chunk
const MAX_CONCURRENCY = 4;       // chunks en paralelo

async function fetchWithTimeout(url, options, timeoutMs = CHUNK_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  catch (e) {
    if (e.name === 'AbortError') throw new Error('Cleanup timeout');
    throw e;
  } finally { clearTimeout(t); }
}

async function cleanChunk(apiKey, chunkSegments, chunkOffset) {
  const lines = chunkSegments.map((s, i) => `[${i}] ${s.text.trim()}`).join('\n');
  const prompt = `Eres un editor de transcripciones en español. Recibes líneas numeradas de un transcript de Whisper que pueden tener errores de acentos, mayúsculas iniciales y puntuación. Corrige SOLO esos detalles ortográficos.

Reglas estrictas:
- NO cambies palabras ni reordenes
- NO agregues ni quites palabras
- Conserva exactamente la misma cantidad de líneas y el mismo número [N] al inicio
- Corrige acentos faltantes (ej: "que" → "qué" si es interrogativo, "tu" → "tú" si es pronombre)
- Capitaliza inicio de frase
- Agrega signos de puntuación faltantes (¿? ¡! , .) cuando sea claro por contexto
- En español, las preguntas llevan ¿ al inicio y ? al final

Devuelve JSON: {"lines": [{"i": number, "text": string}]}

Texto:
${lines}`;

  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const out = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);

  if (!Array.isArray(out.lines) || out.lines.length !== chunkSegments.length) {
    throw new Error(`line count mismatch: expected ${chunkSegments.length}, got ${out.lines?.length}`);
  }
  // Mapear índice local del chunk → índice global
  const corrections = out.lines.map(l => ({ i: l.i + chunkOffset, text: l.text }));
  return { corrections, cost };
}

// Pool con concurrencia limitada
async function runWithConcurrency(tasks, limit) {
  const results = new Array(tasks.length);
  let nextIdx = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (true) {
      const i = nextIdx++;
      if (i >= tasks.length) return;
      results[i] = await tasks[i]().catch(err => ({ __error: err }));
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Limpia ortografía/puntuación del transcript de Whisper.
 * @param {object} whisperJson — JSON original con words y segments.
 * @returns {Promise<{cleaned, costUsd}>} — cleaned tiene la misma estructura, palabras corregidas.
 */
export async function cleanupOrthography(whisperJson) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { cleaned: whisperJson, costUsd: 0 };

  const segments = whisperJson.segments || [];
  if (segments.length === 0) return { cleaned: whisperJson, costUsd: 0 };

  const original = JSON.parse(JSON.stringify(whisperJson));
  let totalCost = 0;

  // Dividir en chunks de CHUNK_SIZE segmentos
  const chunks = [];
  for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
    chunks.push({ offset: i, segs: segments.slice(i, i + CHUNK_SIZE) });
  }

  try {
    const tasks = chunks.map(c => () => cleanChunk(apiKey, c.segs, c.offset));
    const results = await runWithConcurrency(tasks, MAX_CONCURRENCY);

    // Si CUALQUIER chunk falló, fallback a original (preserva integridad word↔text)
    const firstError = results.find(r => r && r.__error);
    if (firstError) {
      console.warn('[cleanup] chunk failed, using original:', firstError.__error.message);
      return { cleaned: whisperJson, costUsd: 0 };
    }

    // Aplicar correcciones a segmentos
    for (const r of results) {
      totalCost += r.cost;
      for (const c of r.corrections) {
        if (original.segments[c.i] && c.text) original.segments[c.i].text = c.text;
      }
    }
    totalCost = +totalCost.toFixed(6);

    // Re-tokenizar segmentos limpios y mapear word-a-word por posición.
    // Si una palabra no se puede alinear, se conserva la original (no rompe nada).
    let segIdx = 0;
    let segTokens = [];
    let segTokenIdx = 0;
    const tokenize = (text) => text.split(/\s+/).filter(Boolean);
    if (segments.length > 0) {
      segTokens = tokenize(original.segments[0].text);
    }
    const newWords = (whisperJson.words || []).map(w => {
      while (segIdx < segments.length && w.start >= segments[segIdx].end) {
        segIdx += 1;
        segTokens = segIdx < segments.length ? tokenize(original.segments[segIdx].text) : [];
        segTokenIdx = 0;
      }
      if (segIdx >= segments.length || segTokenIdx >= segTokens.length) return w;
      const cleanedToken = segTokens[segTokenIdx];
      segTokenIdx += 1;
      return { ...w, word: cleanedToken };
    });
    original.words = newWords;

    return { cleaned: original, costUsd: totalCost };
  } catch (err) {
    console.warn('[cleanup] failed, using original:', err.message);
    return { cleaned: whisperJson, costUsd: totalCost };
  }
}
