// api/services/analysisService.js
// Análisis on-demand de una transcripción: el usuario pulsa "Analizar ideas" y
// gpt-4o-mini devuelve un breakdown estructurado (hook, estructura, mecanismo emocional,
// patrón replicable, lectura de métricas, tesis vs ejecución, takeaways).
//
// No es un resumen — el objetivo es ayudar al usuario a entender el patrón replicable
// detrás de un video que funcionó. Las métricas se incluyen en el prompt cuando existen.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// Precios oficiales gpt-4o-mini (USD por 1M tokens).
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;

const SYSTEM_PROMPT = `Hablas como una persona, no como un analista de marketing. Como un amigo inteligente que vio el video y te explica qué onda con él.

Tu objetivo es darle al usuario material OPERATIVO para REPLICAR el mismo tipo de video en otro tema, otra voz u otro sector. NO estudias el video, NO lo auditas. Le das dos piezas: un recordatorio mínimo de qué jugada es, y un molde paso a paso con espacios para rellenar.

NADA de jerga: prohibido "engagement", "viralidad", "audiencia", "espectador", "automejoramiento", "ratios", "benchmarks", "recurso retórico", "tesis", "narrativa". Habla como humano, no como manual.

Devuelve markdown con EXACTAMENTE estas 2 secciones, en este orden:

## 💡 La jugada en dos líneas
Exactamente 2 líneas, una con cada cosa:
- **Idea:** la idea de fondo del video, en una frase, despegada del tema y del estilo del autor. Como si se la contaras en un café a alguien que no vio el video.
- **Lógica:** el truco de pensamiento que usa para sostener esa idea, en una frase. Nómbralo en lenguaje normal (no "antimetábola"). Ejemplos de cómo nombrarlo: "te dice 'no es A, es B' y te hace click", "te promete X cosas numeradas y las va cumpliendo punto por punto", "te muestra dos malas opciones y aparece una tercera", "te cuenta algo personal y lo vuelve regla general", "te tira una pregunta y la respuesta no es la que esperabas".

Eso es todo. Dos líneas, sin párrafos extra, sin explicación.

## 📋 El molde paso a paso
La estructura del video original, **vaciada de su tema**, escrita como receta numerada para que el usuario rellene los corchetes con su propio tema/voz/sector.

ANTES de armar el molde, observa el transcript con lupa y captura LA MECÁNICA REAL, no una versión genérica "marketing". Cosas que debes notar y reflejar en los pasos:

- ¿Cómo arranca EXACTAMENTE? ¿Hay warm-up o entra directo al título-promesa? ¿La primera frase es una afirmación, una pregunta, un dato? Cita el patrón, no inventes un arranque "que enganche" si el video real no hace eso.
- Si hay lista o serie de elementos: ¿cuántas palabras tiene cada elemento en promedio? ¿Verbos en imperativo, en infinitivo, en otra forma? ¿Hay transiciones entre elementos o van pegados sin pausa?
- ¿El último elemento de la lista cumple la MISMA función que los anteriores, o es distinto (remate, giro, CTA)? Si es distinto, decílo como un paso aparte.
- ¿El tono es expositivo, imperativo seco, confidencial, agresivo, didáctico? Describilo como SE SIENTE escuchar al creador, no con adjetivos de manual ("convincente", "claro").
- ¿Cómo cierra exactamente? ¿CTA al canal, remate filosófico, pregunta abierta, frase memorable? Pega el tipo de cierre real.

Reglas del molde resultante:
- 5 a 8 pasos numerados.
- Cada paso es UNA frase imperativa en segunda persona: "Arranca con…", "Suelta…", "Pivota a…", "Cierra con…".
- DENTRO de cada paso debe haber DOS cosas:
  1. La mecánica observada (en texto plano, prescriptiva: "sin warm-up", "en 2-5 palabras", "sin justificación entre puntos", "en imperativo seco", etc).
  2. Los corchetes **[en negrita]** marcando dónde el usuario rellena con su tema.
- NO uses fórmulas marketing genéricas tipo "para captar la atención", "para enganchar al espectador", "tono firme y convincente". Esas son palabras de relleno que no informan.

Ejemplos del formato esperado (fíjate cómo la mecánica está EN el paso, no afuera):

✅ BIEN: "1. Arranca directo con tu título-promesa, en una sola frase, sin introducción: **[número] + [lo que prometes]**. Sin saludo, sin contexto."

✅ BIEN: "3. Suelta cada punto en 2-5 palabras, en imperativo seco (verbo al inicio), sin justificación entre uno y otro: **[verbo] + [complemento corto]**. Ej de longitud: 'Habla menos' = 2 palabras."

❌ MAL: "1. Arranca con una afirmación tajante que capte la atención sobre [tu tema]." ← genérico, no describe nada real del video.

❌ MAL: "1. Arranca con 'habla menos, cumple tu palabra' para enganchar al espectador con un recurso retórico." ← análisis, no molde.

Después de los pasos numerados, agrega:
**Duración real:** [segundos del video original]
**Cómo se siente escucharlo:** [1 frase que describa la sensación auditiva: ej. "como si te estuviera regañando un amigo mayor", "como si te contara un secreto en voz baja", "como una metralleta sin pausa". NADA de "claro y directo" — sé específico y físico].

Reglas duras del output entero:
- Habla en segunda persona. Nunca "el espectador" ni "la audiencia".
- Frases cortas. Sin párrafos largos.
- Cero anglicismos torpes ("automejoramiento" no, "mejorar como persona" sí).
- NO empieces con "Este video…" ni "El creador…".
- Markdown puro. Sin tablas. Sin HTML.`;

async function fetchWithTimeout(url, options, timeoutMs = 60_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const PLATFORM_LABEL = {
  instagram: 'Instagram Reel',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  'youtube-shorts': 'YouTube Shorts',
  facebook: 'Facebook',
  upload: 'archivo subido (sin metadata externa)',
};

function buildUserPrompt(t) {
  const parts = [];
  parts.push(`PLATAFORMA: ${PLATFORM_LABEL[t.platform] || t.platform || 'desconocida'}`);
  if (t.title && t.title !== 'Sin título') parts.push(`TÍTULO: ${t.title}`);
  if (t.duration) {
    const m = Math.floor(t.duration / 60);
    const s = Math.floor(t.duration % 60);
    parts.push(`DURACIÓN: ${m}:${String(s).padStart(2, '0')}`);
  }
  if (t.uploader_handle) parts.push(`CREADOR: @${t.uploader_handle}`);
  if (t.upload_date && t.upload_date.length === 8) {
    parts.push(`FECHA: ${t.upload_date.slice(0, 4)}-${t.upload_date.slice(4, 6)}-${t.upload_date.slice(6, 8)}`);
  }

  // Métricas + ratios
  const metricsLines = [];
  if (t.view_count !== null && t.view_count !== undefined) metricsLines.push(`views: ${t.view_count.toLocaleString('es')}`);
  if (t.like_count !== null && t.like_count !== undefined) metricsLines.push(`likes: ${t.like_count.toLocaleString('es')}`);
  if (t.comment_count !== null && t.comment_count !== undefined) metricsLines.push(`comments: ${t.comment_count.toLocaleString('es')}`);
  if (t.share_count !== null && t.share_count !== undefined) metricsLines.push(`shares: ${t.share_count.toLocaleString('es')}`);
  if (t.view_count && t.like_count) {
    const eng = ((t.like_count / t.view_count) * 100).toFixed(2);
    metricsLines.push(`engagement rate (likes/views): ${eng}%`);
  }
  if (t.view_count && t.comment_count) {
    const conv = ((t.comment_count / t.view_count) * 100).toFixed(3);
    metricsLines.push(`conversation rate (comments/views): ${conv}%`);
  }
  if (metricsLines.length > 0) {
    parts.push(`\nMÉTRICAS:\n${metricsLines.map(l => `- ${l}`).join('\n')}`);
  }

  if (t.description) {
    parts.push(`\nDESCRIPTION DEL CREADOR:\n"${t.description.slice(0, 600)}"`);
  }

  const hashtagsArr = Array.isArray(t.hashtags) ? t.hashtags : (typeof t.hashtags === 'string' ? safeParseArray(t.hashtags) : null);
  if (hashtagsArr && hashtagsArr.length > 0) {
    parts.push(`\nHASHTAGS: ${hashtagsArr.slice(0, 15).map(h => `#${String(h).replace(/^#/, '')}`).join(' ')}`);
  }

  // Transcript: truncamos defensivamente. Reels rara vez pasan de ~600 palabras;
  // videos largos sí, y no queremos disparar el costo. ~10k chars ≈ 2500 tokens entrada.
  const transcript = (t.transcript || t.text || '').trim();
  const truncated = transcript.length > 10_000 ? transcript.slice(0, 10_000) + '\n[...transcript truncado...]' : transcript;
  parts.push(`\nTRANSCRIPT:\n${truncated}`);

  parts.push(`\nGenera el análisis siguiendo el formato indicado.`);
  return parts.join('\n');
}

function safeParseArray(s) {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; } catch { return null; }
}

/**
 * Genera el análisis de una transcripción.
 * @param {Object} transcription - Row de DB (snake_case) o normalizado.
 * @returns {Promise<{ analysis: string, model: string, costUsd: number }>}
 */
export async function analyzeTranscription(transcription) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY no configurada en el servidor.');
  }

  const transcript = (transcription.transcript || transcription.text || '').trim();
  if (!transcript || transcript.length < 30) {
    throw new Error('La transcripción es demasiado corta para analizar.');
  }

  const userPrompt = buildUserPrompt(transcription);

  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
    }),
  }, 60_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const analysis = json.choices?.[0]?.message?.content?.trim();
  if (!analysis) throw new Error('OpenAI devolvió una respuesta vacía.');

  const promptTokens = json.usage?.prompt_tokens || 0;
  const completionTokens = json.usage?.completion_tokens || 0;
  const costUsd = +(
    (promptTokens * PRICE_INPUT_PER_1M / 1e6) +
    (completionTokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);

  return { analysis, model: MODEL, costUsd };
}
