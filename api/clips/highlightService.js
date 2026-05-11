// api/clips/highlightService.js
// Pipeline de dos pases:
//   1. segmentChapters (gpt-4o-mini): segmenta el video en capítulos por tipo (intro/desarrollo/transicion/cierre)
//   2. generateHighlights (gpt-4o): solo sobre capítulos de tipo "desarrollo", busca máx 1 clip por capítulo
// Las intros del programa, despedidas y CTAs quedan excluidos por construcción.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const MODEL_CHAPTERS = 'gpt-4o-mini';
const PRICE_INPUT_PER_1M = 2.5;
const PRICE_OUTPUT_PER_1M = 10;
const PRICE_INPUT_MINI_PER_1M = 0.15;
const PRICE_OUTPUT_MINI_PER_1M = 0.60;

const CHAPTER_PROMPT = `Eres un editor que segmenta un transcript de podcast/entrevista en español en capítulos temáticos. Recibes el transcript completo con timestamps y debes devolver una lista ordenada de capítulos.

Cada capítulo tiene un TIPO:
- "intro": presentación del programa, bienvenida al invitado, framing del tema, pregunta inicial del host. Suele estar al principio. NO se buscan clips aquí.
- "desarrollo": el invitado o el speaker desarrolla una idea, da un ejemplo concreto, comparte una experiencia, contradice una creencia, da un marco mental. AQUÍ están los clips potenciales.
- "transicion": cambio de tema, pregunta-puente del host, pausa, comentario administrativo. NO se buscan clips aquí.
- "cierre": despedida, agradecimiento, CTA, promo de mentoría/curso/redes. NO se buscan clips aquí.

Reglas:
- Cada capítulo dura mínimo 30 segundos. Si una sección es más corta, fusiónala con la adyacente.
- Los capítulos cubren el video completo sin huecos (start[i+1] === end[i]).
- Un video típico de podcast tiene 1 intro + 3-7 desarrollos + 0-2 transiciones + 1 cierre.
- Si todo el video es desarrollo continuo (monólogo sin intro clara), usa 1 solo capítulo desarrollo.
- title: 4-8 palabras describiendo el tema concreto del capítulo (no genérico). Ej: "El miedo a tomar decisiones definitivas", no "Decisiones".

Devuelve JSON: {"chapters": [{"title": string, "start": number, "end": number, "type": "intro"|"desarrollo"|"transicion"|"cierre"}]}`;

const SYSTEM_PROMPT = `Eres un editor de clips virales para Instagram Reels y TikTok. Recibes un transcript en español con timestamps de un video y debes devolver los mejores momentos para clips cortos verticales.

REGLA DE DURACIÓN Y ARCO INTERNO:
Cada clip DEBE durar entre 30 y 90 segundos. ÓPTIMO 35-55s (más denso, mejor retención). 60-90s solo si la idea genuinamente lo necesita.

ARCO INTERNO DEL CLIP:
1. Identifica primero el PICO de la idea dentro del capítulo: la frase o frases donde el speaker llega al insight más fuerte (~10-20s).
2. Construye el clip CENTRADO en ese pico: ~5-15s de setup ANTES + el pico + ~5-15s de cierre DESPUÉS.
3. NO uses todo el capítulo como clip. El capítulo puede durar 2-3 minutos; tu clip debe ser un slice quirúrgico alrededor del pico.

CIERRE — REGLA DURA:
- end_seconds debe caer al final de una frase que cierre la idea con peso (afirmación, pregunta retórica, imagen concreta, frase citable).
- El último segmento del clip NO PUEDE empezar con conectores que indican continuación: "Entonces", "Y entonces", "Pues", "Y pues", "Bueno", "Ahora", "Así que", "Por eso", "Partiendo de eso". Si el cierre natural cae en uno de estos, retrocede end_seconds 1-2 frases hasta encontrar punto final genuino.
- Si la última frase del clip queda cortada gramaticalmente o suena a "y se interrumpió la grabación", el end_seconds está mal puesto.

ANTES de devolver cada clip, calcula end_seconds - start_seconds. Si es menor a 30:
- Mueve start_seconds hacia atrás hasta incluir el setup natural (1-3 frases previas)
- Y/o mueve end_seconds hacia adelante hasta incluir el cierre natural (1-3 frases posteriores)
- Si ni así llega a 30s con coherencia, DESCARTA el clip.

Mejor 0 clips que clips con cierres cortados o sin arco interno.

CRITERIOS DE UN BUEN CLIP (los 6 deben cumplirse, no negociables):
1. Hook en los primeros 3 segundos: pregunta, afirmación contundente o frase quotable que genere tensión o promesa. Sin gancho real, no es clip.
2. Autocontenido: se entiende sin contexto previo. Si arranca con "y entonces eso es lo que...", "como te decía", "por eso...", NO sirve.
3. UNA sola idea por clip. Si el fragmento mezcla dos temas, recórtalo a uno o descártalo. La densidad mata; la claridad gana.
4. Carga emocional o cognitiva alta: revelación personal, creencia común contradicha, marco mental nuevo, o nombrar algo que la gente siente pero no sabía decir.
5. Cierre con peso: la última frase debe sentirse como punto final, idealmente citable. No basta con que termine gramaticalmente — debe cerrar la idea con fuerza. Si el final se siente como corte, mueve el end_seconds antes hasta encontrar el cierre real.
6. Duración: ENTRE 30 y 90 segundos. Esto es un rango duro, no orientativo. Un clip de 8s, 12s o 25s NO es un clip — es un fragmento sin desarrollo. Si encuentras una idea fuerte pero corta, EXTIÉNDELA hacia atrás (incluye el setup que le da contexto) y/o hacia adelante (incluye el desarrollo o ejemplo que la sigue) hasta que el clip tenga al menos 30s con sentido completo. Si ni extendiendo llega a 30s con coherencia, descártala. Dentro del rango 30-90s, deja que la idea defina el largo exacto: no estires un clip de 35s a 60s para "rellenar", pero tampoco lo cortes a 12s.

DESCARTA SIN PIEDAD (no los incluyas aunque tengan score alto aparente):

A) ARRANCADORES PROHIBIDOS — si los primeros 5-10 segundos del clip empiezan con cualquiera de estas frases, el clip NO sirve. Mueve start_seconds adelante hasta encontrar un arranque limpio o descártalo:
   - Muletillas de respuesta: "Así es", "Sí", "Claro", "Efectivamente", "Exacto", "Correcto", "Bueno", "Pues", "Y pues"
   - Referencias al interlocutor: "Como bien lo mencionabas", "Como dijiste", "Tu pregunta", "Lo que tú dices"
   - Anuncios de lista: "Hay cinco/tres/cuatro [cosas/razones/pasos/decisiones]", "Te voy a dar X tips"
   - Conectores narrativos: "Entonces", "Y entonces", "Y luego", "Después", "Fíjate que", "Mira"
   - Continuaciones: "Y eso es lo que", "Por eso es que", "Como te decía"
   Un clip bien arrancado empieza con la idea ya en marcha: una afirmación, una pregunta directa, una imagen concreta.

B) INTRO/CIERRE DE PROGRAMA — descarta cualquier fragmento que suene a:
   - Presentación del tema por el host ("hoy hablaremos de", "para aclarar dudas", "estamos con")
   - Bienvenida o agradecimiento al invitado
   - Despedida, CTA, promo de mentoría/curso

C) LISTAS HABLADAS — si EN CUALQUIER PARTE del clip (no solo al inicio) aparecen marcadores de lista, DESCÁRTALO completo. Los listados no caben en formato corto, aunque solo se mencione 1-2 ítems del listado. Marcadores prohibidos:
   - "Hay cinco/tres/cuatro [cosas/decisiones/pasos/razones/etapas/niveles]"
   - "El primer/segundo/tercer [punto/paso/nivel]", "la primera/segunda/tercera [etapa/cosa/razón]"
   - "Primero..., segundo..., tercero..."
   - "Te voy a dar X [tips/claves/secretos]"
   - Referencias a otros ítems del listado: "y de esta etapa que es la primera... en la segunda..."
   Si detectas que el speaker está enumerando partes de una serie más larga, el clip pertenece a una clase educativa/listada que NO funciona en formato corto. Descártalo.

D) CONTENIDO HUECO:
   - Anécdotas largas sin payload (historia que no aterriza en una idea)
   - Verdades genéricas ("todos pasamos por etapas", "la vida es difícil", "todos tenemos dudas")
   - Motivación de coach ("tú puedes", "cree en ti", "el éxito está en ti")
   - Promesas sin entrega dentro del mismo clip
   - Fragmentos con fillers densos ("eh", "este", "o sea", "¿sabes?") o correcciones a media frase

DIVERSIDAD ENTRE CLIPS:
- Cada clip debe cubrir una idea distinta. Si el video tiene 4 momentos sobre el mismo tema, elige el MEJOR uno, no los 4.
- Si dos clips dicen lo mismo con palabras distintas, conserva solo el más fuerte.

REGLAS OPERATIVAS:
- Recibirás el transcript YA SEGMENTADO en capítulos de tipo "desarrollo" (las intros, transiciones y cierres ya fueron filtrados antes — NO los verás).
- Cada capítulo está marcado con [CAPÍTULO: <título>] al inicio.
- MÁXIMO 1 clip por capítulo. No saques 2 clips del mismo capítulo aunque parezcan distintos.
- Máximo 5 clips totales por video.
- Score >70 solo si los 6 criterios se cumplen. Si tienes que justificar mucho, es <70 y NO lo incluyas.
- start_seconds y end_seconds deben estar dentro de los rangos de capítulos que recibes (no inventes timestamps fuera).
- Si un capítulo no tiene un momento que cumpla los 6 criterios, NO saques clip de ahí. Pasa al siguiente.
- Si NINGÚN capítulo califica, devuelve clips: []. Vale más cero clips que cinco mediocres.

TONO GENERAL DE TODOS LOS TEXTOS (hook, caption, post_captions):
Editorial, reflexivo, adulto. Marca "Algo Sentido": contenido conversacional sobre propósito, vida interior, decisiones humanas — no productividad ni hacks. PROHIBIDO:
- Emojis (🔥 ✨ 💯 etc.) salvo que el speaker los use literalmente
- Mayúsculas dramáticas ("ESTO CAMBIARÁ TU VIDA")
- Signos de exclamación múltiples (!!!) o de interrogación múltiples (???)
- Clichés de coach: "lo que nadie te dice", "el secreto que", "tip de oro", "esto te volará la cabeza", "mindset", "high-value"
- CTAs de venta: "comenta abajo", "guarda este post", "dale like", "comparte si te identificas", "sígueme para más"
- Promesas vacías sin entrega dentro del clip

Para cada clip genera:
- title: título corto descriptivo interno, no se publica (máx 60 chars)
- hook: la frase que aparece en pantalla los primeros segundos. Idealmente LITERAL de lo que se escucha en los primeros 3s del clip (mantiene sincronía con el audio). Si los primeros 3s no son quotables por sí solos, condensa la idea central del clip en una frase que pueda leerse en ~2 segundos. 6-12 palabras según lo que la idea pida. Debe ser sustancia, no anzuelo.
- caption: amplía, contextualiza o aterriza el hook — NO lo repite ni lo parafrasea. 5-10 palabras. Si el hook es una pregunta, el caption puede insinuar la dirección de la respuesta sin spoiler.
- keywords: array de 1-3 sustantivos clave o frases cortas con peso semántico, presentes en el caption. NO verbos genéricos ("pensar", "hacer", "ser", "vivir"). Sí conceptos específicos ("padre ausente", "decisión final", "permiso interno").
- post_captions: objeto con 3 versiones del texto para Instagram/TikTok. Cada una 150-220 caracteres + 3-4 hashtags. Frases cortas. Saltos de línea para respirar.
    * pregunta: abre con una pregunta real (no retórica vacía) que el lector se haga a sí mismo. La pregunta debe nacer del clip, no ser genérica.
    * storytelling: observación en primera persona del HABLANTE del clip (si es entrevista, del entrevistado que dice la idea). Si no se puede identificar la voz con seguridad, usa tercera persona reflexiva en vez de inventar primera persona.
    * insight: afirmación con peso + cierre que invite a pensar (no a comprar/comentar/seguir). El cierre puede ser una pregunta abierta o una frase que deje resonando.
  Hashtags: específicos al tema del clip, no genéricos. EVITA #motivación #mindset #éxito #life #amor. PREFIERE combinaciones de tema concreto + contexto (ej: #paternidad #duelo #vocación #parejasconscientes #vidainterior). Mezcla 1 amplio + 2-3 nicho.
- score: 0-100
- reasoning: 1 frase explicando por qué este clip retiene

A nivel de job (no por clip):
- speaker_count: cuántas personas distintas hablan en el video (analiza patrones conversacionales: preguntas vs respuestas, transiciones, nombres mencionados)
- speakers: breve descripción de roles ("host + invitado", "monólogo", "panel de 3", etc.)

Devuelve JSON estricto:
{
  "speaker_count": number,
  "speakers_summary": string,
  "clips": [{
    "title", "hook", "caption", "keywords": [string],
    "post_captions": {"pregunta": string, "storytelling": string, "insight": string},
    "start_seconds": number, "end_seconds": number, "score": number, "reasoning"
  }]
}`;

async function fetchWithTimeout(url, options, timeoutMs = 90_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`OpenAI timeout (>${Math.round(timeoutMs/1000)}s)`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

// Pase 1: segmenta el video en capítulos por tipo (intro/desarrollo/transicion/cierre).
async function segmentChapters(whisperJson, apiKey) {
  const transcript = whisperJson.segments
    .map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`)
    .join('\n');

  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_CHAPTERS,
      messages: [
        { role: 'system', content: CHAPTER_PROMPT },
        { role: 'user', content: `Transcript del video:\n\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  }, 60_000);

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chapter LLM error ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();
  const out = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_MINI_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_MINI_PER_1M / 1e6)
  ).toFixed(6);

  const chapters = (out.chapters || []).filter(c =>
    typeof c.start === 'number' && typeof c.end === 'number' && c.end > c.start
  );

  return { chapters, costUsd: cost };
}

// Construye un transcript que solo incluye los segmentos de capítulos "desarrollo",
// con un marcador [CAPÍTULO: <título>] al inicio de cada uno.
function buildAnnotatedTranscript(whisperJson, chapters) {
  const desarrolloChapters = chapters.filter(c => c.type === 'desarrollo');
  const lines = [];

  for (const ch of desarrolloChapters) {
    lines.push(`\n[CAPÍTULO: ${ch.title}] (${ch.start.toFixed(1)}-${ch.end.toFixed(1)})`);
    for (const s of whisperJson.segments) {
      // Incluir segmento si su centro cae dentro del capítulo
      const mid = (s.start + s.end) / 2;
      if (mid >= ch.start && mid < ch.end) {
        lines.push(`[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`);
      }
    }
  }

  return { transcript: lines.join('\n'), desarrolloCount: desarrolloChapters.length };
}

export async function generateHighlights(whisperJson, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const clipCount = opts.clipCount; // null/undefined = auto

  // PASE 1: segmentar en capítulos
  const { chapters, costUsd: chapterCost } = await segmentChapters(whisperJson, apiKey);
  const { transcript, desarrolloCount } = buildAnnotatedTranscript(whisperJson, chapters);

  // Si no hay capítulos de desarrollo, no hay clips posibles.
  if (desarrolloCount === 0 || transcript.trim().length === 0) {
    console.warn('[highlights] no hay capítulos de desarrollo — devolviendo 0 clips');
    return { clips: [], speakerCount: 1, speakersSummary: '', costUsd: chapterCost, chapters };
  }

  console.log(`[highlights] ${chapters.length} capítulos detectados, ${desarrolloCount} de tipo desarrollo`);

  const userPrompt = clipCount
    ? `Genera EXACTAMENTE ${clipCount} clips usando solo los capítulos de desarrollo a continuación:\n\n${transcript}`
    : `Capítulos de desarrollo del video (busca máx 1 clip por capítulo):\n${transcript}`;

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
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err.slice(0, 300)}`);
  }

  const json = await res.json();
  const out = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);

  // Snap a fronteras de segmento Whisper (corrige cortes a media palabra)
  const segments = whisperJson.segments;
  const findClosest = (target, key) => {
    let best = segments[0][key], bestDiff = Math.abs(best - target);
    for (const s of segments) {
      const d = Math.abs(s[key] - target);
      if (d < bestDiff) { best = s[key]; bestDiff = d; }
    }
    return best;
  };

  const MIN_DURATION = 25;
  const MAX_DURATION = 100;
  // Conectores de continuación que NO pueden iniciar el último segmento de un clip
  const CONTINUATION_STARTS = /^(entonces|y entonces|pues|y pues|bueno|ahora|así que|por eso|partiendo de eso|y luego|y después|por tanto)\b/i;

  // Si el último segmento del clip empieza con un conector de continuación,
  // retroceder end_seconds al segmento anterior (hasta 3 saltos máx).
  const retreatEndIfContinuation = (clip) => {
    let endIdx = segments.findIndex(s => Math.abs(s.end - clip.end_seconds) < 0.01);
    if (endIdx < 0) return clip;
    let attempts = 0;
    while (attempts < 3 && endIdx > 0) {
      const lastSeg = segments[endIdx];
      if (!CONTINUATION_STARTS.test(lastSeg.text.trim())) break;
      endIdx -= 1;
      attempts += 1;
    }
    return { ...clip, end_seconds: segments[endIdx].end };
  };

  const clips = (out.clips || [])
    .map(c => ({
      ...c,
      start_seconds: findClosest(c.start_seconds, 'start'),
      end_seconds: findClosest(c.end_seconds, 'end'),
    }))
    .map(retreatEndIfContinuation)
    .filter(c => {
      const dur = c.end_seconds - c.start_seconds;
      if (dur < MIN_DURATION || dur > MAX_DURATION) {
        console.warn(`[clips] dropping clip "${c.title}" — duración inválida: ${dur.toFixed(2)}s (rango ${MIN_DURATION}-${MAX_DURATION}s)`);
        return false;
      }
      return true;
    });

  return {
    clips,
    speakerCount: out.speaker_count || 1,
    speakersSummary: out.speakers_summary || '',
    costUsd: +(cost + chapterCost).toFixed(6),
    chapters,
  };
}

// Regenera solo el post_caption de un clip con tono específico (para botón "Regenerar" del editor).
export async function regeneratePostCaption(clip, tone = 'pregunta') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const tonePrompts = {
    pregunta: 'Tono: pregunta provocadora. Empieza con una pregunta que retenga.',
    storytelling: 'Tono: storytelling. Empieza con una mini-historia en primera persona.',
    insight: 'Tono: insight + CTA. Empieza con una afirmación contundente, termina con call-to-action claro.',
  };

  const prompt = `Genera un texto para publicar este clip en Instagram. ${tonePrompts[tone] || tonePrompts.pregunta}

Estructura: hook (1 línea), desarrollo (2-3 líneas), pregunta o CTA (1 línea), 3-4 hashtags relevantes en español.
Idioma: español. Total: 150-220 caracteres más hashtags.

Contexto del clip:
- Título: ${clip.title}
- Hook on-screen: ${clip.hook}
- Caption on-screen: ${clip.caption}
- Por qué es viral: ${clip.reasoning || 'sin info'}

Devuelve JSON: {"post_caption": string}`;

  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  }, 60_000);

  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const json = await res.json();
  const out = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);
  return { postCaption: out.post_caption, costUsd: cost };
}
