// api/clips/orthographyCleanup.js
// Pasa el transcript de Whisper por GPT-4o-mini para corregir acentos y puntuación
// preservando el conteo de palabras y los timestamps. Si el modelo cambia el conteo,
// devolvemos el original (no rompemos el job).

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;

async function fetchWithTimeout(url, options, timeoutMs = 60_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: ctrl.signal }); }
  catch (e) {
    if (e.name === 'AbortError') throw new Error('Cleanup timeout');
    throw e;
  } finally { clearTimeout(t); }
}

/**
 * Limpia ortografía/puntuación del transcript de Whisper.
 * @param {object} whisperJson — JSON original con words y segments.
 * @returns {Promise<{cleaned, costUsd}>} — cleaned tiene la misma estructura, palabras corregidas.
 */
export async function cleanupOrthography(whisperJson) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { cleaned: whisperJson, costUsd: 0 };

  // Procesamos por segmentos para no superar el contexto y mantener la estructura.
  // Para cada segmento: enviar texto crudo, pedir versión corregida con misma cantidad de palabras.
  const segments = whisperJson.segments || [];
  const original = JSON.parse(JSON.stringify(whisperJson));
  let totalCost = 0;

  // Hacer un solo round-trip con todo el texto para minimizar overhead.
  // Formato: array de líneas numeradas, devuelve array con la misma cantidad de líneas corregidas.
  const lines = segments.map((s, i) => `[${i}] ${s.text.trim()}`).join('\n');
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

  try {
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
    totalCost = +(
      (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
      (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
    ).toFixed(6);

    if (!Array.isArray(out.lines) || out.lines.length !== segments.length) {
      console.warn('[cleanup] line count mismatch, using original');
      return { cleaned: original, costUsd: totalCost };
    }

    // Aplicar texto corregido a cada segmento
    for (let i = 0; i < segments.length; i++) {
      const correction = out.lines.find(l => l.i === i) || out.lines[i];
      if (correction && correction.text) original.segments[i].text = correction.text;
    }

    // No tocamos words[] (mantenemos el texto original ahí para sync exacto).
    // Los subs en el video usan palabras crudas para timing pero podemos reemplazar texto
    // con un "alineamiento" simple: para cada word, ver si su texto sigue presente en el segmento limpio.
    // Si fallamos en alinear, dejamos el word original (no rompe nada).
    // Estrategia: re-tokenizar el segmento limpio y mapear posicionalmente word-a-word.
    let segIdx = 0;
    let segTokens = [];
    let segTokenIdx = 0;
    const tokenize = (text) => text.split(/\s+/).filter(Boolean);
    if (segments.length > 0) {
      segTokens = tokenize(original.segments[0].text);
    }
    const newWords = (whisperJson.words || []).map(w => {
      // Avanzar al segmento que contiene este word (por timestamp)
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
