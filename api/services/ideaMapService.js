// api/services/ideaMapService.js
//
// Generador de ideas — la compuerta es el producto.
//
// El usuario entrega dos columnas crudas en escenas (vida que NO quiere / vida que SÍ quiere).
// Esta herramienta:
//   1) Intenta extraer territorios del texto.
//   2) Si tropieza con sentimiento en vez de escena → Fallo 1, rechaza.
//   3) Si los territorios colapsan en un eje único → Fallo 2, rechaza con pregunta de desacople.
//   4) Si la respuesta al desacople es una fuga hacia la vida buena → Fallo 3, repregunta dura.
//   5) Solo si pasa, genera 4-5 ideas crudas con torsión.
//
// Límites duros (sección 9 del brief, decisión del owner):
//   - Máximo 2 repreguntas por filtro.
//   - Máximo 5 turnos totales antes de devolver "exhausted" (trabajar offline).
//
// Mismo patrón dual web/MCP que analysisService.js:
//   - Web: este service llama a OpenAI (gpt-4o-mini) en backend.
//   - MCP: el tool buildIdeaMap.js exporta el LENS sin ejecutar nada; Claude-en-chat aplica.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

// Precios oficiales gpt-4o-mini (USD por 1M tokens).
const PRICE_INPUT_PER_1M = 0.15;
const PRICE_OUTPUT_PER_1M = 0.60;

export const MAX_ATTEMPTS_PER_FILTER = 2;
export const MAX_TOTAL_TURNS = 5;
export const MIN_INPUT_CHARS = 80;

// ─────────────────────────────────────────────────────────────────────────
// LENS — Documento canónico del método. Lo exporta el MCP tool y lo usan
// los prompts de OpenAI para anclar el comportamiento. Si quieres cambiar el
// método, cámbialo aquí una sola vez.
// ─────────────────────────────────────────────────────────────────────────
export const LENS = `Generador de Ideas — método de mapa de contraste.

El usuario entrega dos columnas crudas: la vida que NO quiere y la vida que SÍ quiere, descritas como escenas concretas (martes, gente, lugares, qué hace, a qué le dijo sí, a qué le dijo no).

A partir de ese contraste, la herramienta:
1. Extrae territorios temáticos.
2. Abre cada territorio en subtemas y en un punto A (estado actual) → punto B (estado deseado).
3. Cruza subtemas de territorios distintos. De esa fricción salen frases-idea con torsión.
4. Si solo emerge un eje único legítimo (ej: dinero), no fuerza territorios falsos. Abre el eje en sus caras (ej: sostener / elegir / desear) y cruza caras.
5. Devuelve 4-5 frases crudas, sin pulir. Materia prima, no calendario.

La compuerta es el producto. Generar sin validar produce frases genéricas. Por eso la herramienta detecta y bloquea tres modos de fallo antes de generar:

FALLO 1 — Sentimiento en vez de escena.
La persona escribe estados emocionales y adjetivos abstractos ("me siento angustiado", "quiero estar tranquilo", "libertad", "amplitud") en lugar de escenas concretas ("el martes hago X con Y, le dije sí a Z").
Detección: lenguaje de estado emocional / adjetivos abstractos, sin sujeto concreto, sin acción, sin momento ubicable.
Acción: NO generar. Devolver la frase del propio usuario y pedir que la convierta en escena con un ejemplo antes/después. Incluir el gatillo: "¿y eso cuándo te pasó, exactamente? Escribe ese momento en vez del sentimiento."

FALLO 2 — Eje único disfrazado de varios.
La persona entrega "tres territorios" que son la misma cosa dicha tres veces (típico: todo cuelga del dinero).
Detección: los territorios extraídos reducen a un mismo concepto raíz.
Acción: NO forzar tres ejes falsos. Hacer la pregunta de desacople: "Si [eje principal] estuviera resuelto, fuera de la ecuación para siempre, ¿qué de la vida que NO quieres seguiría exactamente igual?"
Si tras eso sigue siendo un eje, ACEPTAR el eje único explícitamente y cambiar de estrategia: abrir el eje en sus caras y cruzar caras en vez de territorios. Un eje único NO es un error — es una respuesta legítima. La herramienta nunca penaliza ir hondo en vez de ancho.

FALLO 3 — La fuga.
Tras la pregunta de desacople, la persona se escapa hacia la vida buena ("entonces todo estaría bien, viajaría, crearía") en vez de quedarse en lo que sigue incomodando.
Acción preventiva: el copy de la pregunta de desacople debe nombrar la fuga antes de que ocurra. "Tu cabeza va a querer irse a lo bueno. Lo vas a sentir como alivio. No lo tomes. Quédate en el martes con todo resuelto y busca una sola cosa que igual te incomode."
Acción reactiva: si la respuesta es claramente una fuga (lenguaje de deseo / futuro positivo), repreguntar una vez más, distinto, antes de aceptar un "no queda nada".
Límite honesto: la herramienta NO puede verificar que la persona buscó en serio antes de decir "no aparece nada". Mejora el piso, no garantiza el techo.

LO QUE LA HERRAMIENTA NUNCA HACE:
- No genera si no pasó los tres filtros.
- No motiva, no coachea, no suaviza. Registro analítico y directo. Sin lenguaje de coaching genérico.
- No inventa profundidad. Eje único + búsqueda honesta = eje único.
- No produce más de 4-5 ideas. Más es ruido.
- No pulir las frases. La herramienta entrega crudo.
- No psicologiza al usuario. Esto es un ejercicio de contenido, no terapia.

ESTRUCTURA DE LAS IDEAS GENERADAS (paso final, solo cuando pasa la compuerta):
Cada frase tiene torsión: contradice o reencuadra una creencia implícita. No aconseja.
Patrones que funcionan (guía, no plantilla rígida):
- "Te enseñaron X. Nadie te dijo Y."
- "No es que no puedas Z. Es que [reencuadre]."
- "No es [lo obvio]. Es [la torsión]."
La frase sola va al output. Si hay nota de uso (de dónde sale, qué cruce produjo la fricción) va en campo aparte.

PROHIBIDO en cualquier output:
- Jerga de marketing: "engagement", "viralidad", "audiencia", "espectador", "alcance", "recurso retórico", "tesis", "narrativa".
- Lenguaje terapéutico: "tu niño interior", "abraza tu", "permite que".
- Genéricos vacíos: "para captar atención", "para conectar con tu público".

LÍMITES OPERATIVOS:
- Máximo 2 repreguntas por filtro.
- Máximo 5 turnos totales. Si se agotan, la herramienta corta con: "Esto no se desbloquea con repreguntas. Trabájalo offline antes de volver."`;

// ─────────────────────────────────────────────────────────────────────────
// PROMPTS — solo se usan en la capa web (backend → OpenAI). El MCP no los
// invoca; Claude-en-chat aplica el LENS directo.
// ─────────────────────────────────────────────────────────────────────────

export const GATE_SYSTEM_PROMPT = `Eres la compuerta del Generador de Ideas. Tu trabajo es LEER las dos columnas crudas del usuario (vida que NO quiere / vida que SÍ quiere) e intentar extraer territorios. Durante ese intento detectas si el insumo está roto.

${LENS}

Devuelves JSON estricto con esta forma exacta:
{
  "fallo_1": { "detected": boolean, "evidence": "frase exacta del usuario que delata el sentimiento, o ''", "repregunta": "copy en español hablando al usuario, con la frase suya + pedido de escena + gatillo, o ''" },
  "fallo_2": { "detected": boolean, "axis_candidate": "nombre del eje único en una palabra (ej: 'dinero', 'tiempo'), o ''", "evidence": "por qué los territorios colapsan en uno, en 1-2 líneas, o ''", "repregunta": "pregunta de desacople con copy que anticipa la fuga, o ''" },
  "extracted_territorios": [ { "nombre": "...", "subtemas": ["...", "..."], "punto_a": "...", "punto_b": "..." } ],
  "axis_mode": "multi" | "single_pending_desacople" | "single_with_caras",
  "caras": [ { "nombre": "...", "subtemas": ["...", "..."] } ]
}

REGLAS DURAS:
- Si fallo_1.detected = true, NO sigas analizando. extracted_territorios = [], axis_mode = "multi", caras = [], fallo_2.detected = false.
- Si fallo_2.detected = true, extracted_territorios queda vacío y axis_mode = "single_pending_desacople". caras también vacío (se llenan después de la respuesta del usuario).
- axis_mode = "multi" solo cuando hay 2 o más territorios genuinamente distintos.
- axis_mode = "single_with_caras" solo si vienes de una iteración previa donde el usuario ya respondió la pregunta de desacople y confirmó que el eje único es real — en ese caso llenas caras (ej: dinero → sostener / elegir / desear).
- repregunta debe sonar a humano hablando a humano. No "como IA". Habla en segunda persona, directo, sin coaching.
- Ningún campo "repregunta" puede contener jerga prohibida.
- Devuelve SOLO el JSON, sin markdown, sin explicación.`;

export function buildGateUserPrompt({ vida_no_quiero, vida_si_quiero, prior_attempts = [] }) {
  const parts = [];
  parts.push('VIDA QUE NO QUIERO (lado izquierdo de la hoja):');
  parts.push(vida_no_quiero.trim());
  parts.push('');
  parts.push('VIDA QUE SÍ QUIERO (lado derecho de la hoja):');
  parts.push(vida_si_quiero.trim());

  if (prior_attempts.length > 0) {
    parts.push('');
    parts.push('HISTORIAL DE REPREGUNTAS PREVIAS (más reciente al final):');
    for (const a of prior_attempts) {
      parts.push(`- Filtro ${a.filter}: tu repregunta dijo "${a.repregunta || '(no registrada)'}" → el usuario respondió: "${a.user_response}"`);
    }
    parts.push('');
    parts.push('IMPORTANTE: si el último intento fue del Fallo 2 y el usuario respondió a la pregunta de desacople, EVALÚA si la respuesta es una fuga (Fallo 3) o si confirma el eje único. Si es fuga, marca fallo_2.detected = true otra vez con una repregunta distinta. Si confirma eje único legítimo, axis_mode = "single_with_caras" y llena el array de caras.');
  }

  return parts.join('\n');
}

export const FUGA_SYSTEM_PROMPT = `Eres el detector de fuga del Generador de Ideas. Recibes la respuesta del usuario a una pregunta de desacople (Fallo 2) y decides si está fugando hacia la vida buena (Fallo 3) o si está respondiendo en serio.

${LENS}

Devuelves JSON estricto:
{
  "es_fuga": boolean,
  "evidence": "qué del lenguaje del usuario delata la fuga (verbos de deseo / futuro positivo / lugar al que se escapa), o ''",
  "repregunta_dura": "si es fuga, copy distinto al anterior que la nombre y la corte, o ''"
}

REGLAS:
- "es_fuga" = true cuando la respuesta es lenguaje de vida buena: viajar, crear, ser libre, disfrutar, descansar, fluir. La pregunta era "qué SIGUE incomodando", no "qué harías si todo estuviera bien".
- "es_fuga" = false cuando el usuario nombra algo que igual le incomoda (aunque sea pequeño). Eso es búsqueda honesta. También false si dice claramente "no aparece nada" después de haber buscado.
- repregunta_dura debe ser breve, directa, sin coaching. Ejemplo: "Eso es la vida buena. La pregunta era al revés — con todo eso ya pasando, ¿qué te sigue picando? Una sola cosa, aunque sea minúscula."
- Devuelve SOLO el JSON.`;

export function buildFugaUserPrompt({ desacople_question, user_response }) {
  return [
    'PREGUNTA DE DESACOPLE QUE SE LE HIZO AL USUARIO:',
    desacople_question,
    '',
    'RESPUESTA DEL USUARIO:',
    user_response,
  ].join('\n');
}

export const GENERATE_SYSTEM_PROMPT = `Eres el generador del Generador de Ideas. Te llega una estructura ya validada (territorios + subtemas + A/B, o un eje único con caras). Cruzas subtemas de unidades distintas y devuelves 4-5 frases crudas con torsión.

${LENS}

Devuelves JSON estricto:
{
  "ideas": [
    { "texto": "la frase cruda, una sola línea", "nota_uso": "1-2 líneas: qué subtemas cruzaste y por qué fricciona" },
    ...
  ]
}

REGLAS DURAS:
- Entre 4 y 5 ideas. Ni 3, ni 6.
- Cada idea: una sola línea, sin punto final obligatorio. Lenguaje directo, sin jerga prohibida.
- Cada cruce debe ser de subtemas (o caras) DISTINTOS. No cruces un subtema consigo mismo.
- Si recibes axis_mode = "single_with_caras", cruza caras en vez de territorios.
- nota_uso es para que el usuario entienda de dónde sale la idea. No coaching, no marketing.
- Devuelve SOLO el JSON.`;

export function buildGenerateUserPrompt({ axis_mode, extracted_territorios, caras }) {
  const parts = [`AXIS_MODE: ${axis_mode}`];
  if (axis_mode === 'multi') {
    parts.push('TERRITORIOS:');
    for (const t of extracted_territorios) {
      parts.push(`- ${t.nombre}`);
      parts.push(`  subtemas: ${(t.subtemas || []).join(', ')}`);
      parts.push(`  A: ${t.punto_a}`);
      parts.push(`  B: ${t.punto_b}`);
    }
  } else {
    parts.push('CARAS DEL EJE ÚNICO:');
    for (const c of caras) {
      parts.push(`- ${c.nombre}`);
      parts.push(`  subtemas: ${(c.subtemas || []).join(', ')}`);
    }
  }
  parts.push('');
  parts.push('Genera 4-5 ideas cruzando subtemas de unidades distintas. Devuelve solo el JSON.');
  return parts.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// Fetch helper + OpenAI call (puro: recibe prompts, devuelve JSON parseado + costo)
// ─────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs = 60_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function callOpenAIJSON({ systemPrompt, userPrompt, temperature = 0.5 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada en el servidor.');

  const res = await fetchWithTimeout(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
    }),
  }, 60_000);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('OpenAI devolvió respuesta vacía.');

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('OpenAI devolvió JSON inválido: ' + raw.slice(0, 200)); }

  const promptTokens = json.usage?.prompt_tokens || 0;
  const completionTokens = json.usage?.completion_tokens || 0;
  const costUsd = +(
    (promptTokens * PRICE_INPUT_PER_1M / 1e6) +
    (completionTokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);

  return { parsed, costUsd, model: MODEL };
}

// ─────────────────────────────────────────────────────────────────────────
// API pública del service
// ─────────────────────────────────────────────────────────────────────────

/**
 * Aplica la compuerta. Si pasa, queda lista para generar.
 * Si el último prior_attempt fue del fallo_2, se invoca también el fugaDetector.
 *
 * Inputs:
 *   vida_no_quiero, vida_si_quiero — texto crudo del usuario
 *   prior_attempts — historial [{filter, repregunta, user_response}]
 *
 * Output: { kind: 'pass'|'reject', failed_filter?, repregunta?, axis_mode?, structure?, costUsd }
 */
export async function runGate({ vida_no_quiero, vida_si_quiero, prior_attempts = [] }) {
  const userPrompt = buildGateUserPrompt({ vida_no_quiero, vida_si_quiero, prior_attempts });
  const { parsed, costUsd } = await callOpenAIJSON({
    systemPrompt: GATE_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.2,
  });

  // Si el último intento fue Fallo 2 y ya tenemos una respuesta del usuario,
  // chequeamos fuga (Fallo 3) ANTES de aceptar lo que diga la compuerta.
  const last = prior_attempts[prior_attempts.length - 1];
  let fugaCost = 0;
  if (last && last.filter === 'fallo_2' && last.user_response) {
    const fuga = await callOpenAIJSON({
      systemPrompt: FUGA_SYSTEM_PROMPT,
      userPrompt: buildFugaUserPrompt({ desacople_question: last.repregunta || '', user_response: last.user_response }),
      temperature: 0.2,
    });
    fugaCost = fuga.costUsd;
    if (fuga.parsed?.es_fuga) {
      return {
        kind: 'reject',
        failed_filter: 'fallo_3',
        diagnostic: fuga.parsed.evidence || '',
        repregunta: fuga.parsed.repregunta_dura || '',
        costUsd: +(costUsd + fugaCost).toFixed(6),
      };
    }
  }

  if (parsed.fallo_1?.detected) {
    return {
      kind: 'reject',
      failed_filter: 'fallo_1',
      diagnostic: parsed.fallo_1.evidence || '',
      repregunta: parsed.fallo_1.repregunta || '',
      costUsd: +(costUsd + fugaCost).toFixed(6),
    };
  }
  if (parsed.fallo_2?.detected) {
    return {
      kind: 'reject',
      failed_filter: 'fallo_2',
      diagnostic: parsed.fallo_2.evidence || '',
      repregunta: parsed.fallo_2.repregunta || '',
      axis_candidate: parsed.fallo_2.axis_candidate || '',
      costUsd: +(costUsd + fugaCost).toFixed(6),
    };
  }

  // Pasó la compuerta.
  return {
    kind: 'pass',
    axis_mode: parsed.axis_mode || 'multi',
    structure: {
      extracted_territorios: parsed.extracted_territorios || [],
      caras: parsed.caras || [],
    },
    costUsd: +(costUsd + fugaCost).toFixed(6),
  };
}

/**
 * Genera las ideas. Solo se invoca cuando runGate devolvió kind='pass'.
 */
export async function runGenerate({ axis_mode, structure }) {
  const userPrompt = buildGenerateUserPrompt({
    axis_mode,
    extracted_territorios: structure.extracted_territorios,
    caras: structure.caras,
  });
  const { parsed, costUsd } = await callOpenAIJSON({
    systemPrompt: GENERATE_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.7,
  });

  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
  // Recorte defensivo: si el modelo se pasó, cortamos a 5.
  return {
    ideas: ideas.slice(0, 5),
    costUsd,
  };
}

/**
 * Helper puro para los handlers: dada la lista actual de attempts_per_filter,
 * decide si todavía se puede repreguntar.
 */
export function canStillRepregunta({ attempts_per_filter, failed_filter, turn }) {
  if (turn >= MAX_TOTAL_TURNS) return { ok: false, reason: 'max_turns_reached' };
  const used = attempts_per_filter?.[failed_filter] || 0;
  if (used >= MAX_ATTEMPTS_PER_FILTER) return { ok: false, reason: 'max_attempts_per_filter' };
  return { ok: true };
}

export const EXHAUSTED_MESSAGE = 'Esto no se desbloquea con repreguntas. Trabájalo offline antes de volver.';
