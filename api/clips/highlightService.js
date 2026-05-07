// api/clips/highlightService.js
// Una sola llamada al LLM por job: devuelve highlights + título + hook + caption + keywords + post_caption + speakers.
// Esto evita N llamadas separadas y mantiene el costo bajo control.

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';
const PRICE_INPUT_PER_1M = 2.5;
const PRICE_OUTPUT_PER_1M = 10;

const SYSTEM_PROMPT = `Eres un editor de clips virales para Instagram Reels y TikTok. Recibes un transcript en español con timestamps de un video y debes devolver los mejores momentos para clips cortos verticales.

Para cada clip identifica:
- Hook fuerte en los primeros 3 segundos (pregunta, afirmación contundente, frase quotable)
- Pico emocional, revelación, contradicción o valor práctico tangible
- Autocontenido (se entiende sin contexto previo)

Reglas de selección:
- Duración 30-90 segundos
- Empieza y termina en frontera de frase natural
- Máximo 5 clips por video
- Score >70 solo si tiene gancho real, no rellenes
- IGNORA los últimos 60 segundos del video (suelen ser CTAs, despedidas, promos de mentorías)
- Si nada califica, devuelve clips: []

Para cada clip genera además:
- title: título corto descriptivo (máx 60 chars)
- hook: pregunta o frase de apertura quotable (10-12 palabras, irá como sub grande tipo Anton)
- caption: línea de soporte (8-10 palabras, sub más pequeño tipo Inter)
- keywords: array de 1-3 palabras o frases cortas a destacar dentro del caption
- post_caption: texto sugerido para pegar al publicar (estilo IG: hook impactante, 2-3 líneas de desarrollo, pregunta o CTA, 3-4 hashtags relevantes en español). Tono: pregunta provocadora.
- score: 0-100
- reasoning: 1 frase explicando por qué es viral

A nivel de job (no por clip):
- speaker_count: cuántas personas distintas hablan en el video (analiza patrones conversacionales: preguntas vs respuestas, transiciones, nombres mencionados)
- speakers: breve descripción de roles ("host + invitado", "monólogo", "panel de 3", etc.)

Devuelve JSON estricto:
{
  "speaker_count": number,
  "speakers_summary": string,
  "clips": [{"title", "hook", "caption", "keywords": [string], "post_caption", "start_seconds": number, "end_seconds": number, "score": number, "reasoning"}]
}`;

export async function generateHighlights(whisperJson) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY no configurada');

  const transcript = whisperJson.segments
    .map(s => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`)
    .join('\n');

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcript del video:\n\n${transcript}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
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

  const clips = (out.clips || []).map(c => ({
    ...c,
    start_seconds: findClosest(c.start_seconds, 'start'),
    end_seconds: findClosest(c.end_seconds, 'end'),
  }));

  return {
    clips,
    speakerCount: out.speaker_count || 1,
    speakersSummary: out.speakers_summary || '',
    costUsd: cost,
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

  const res = await fetch(OPENAI_CHAT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`LLM error ${res.status}`);
  const json = await res.json();
  const out = JSON.parse(json.choices[0].message.content);
  const cost = +(
    (json.usage.prompt_tokens * PRICE_INPUT_PER_1M / 1e6) +
    (json.usage.completion_tokens * PRICE_OUTPUT_PER_1M / 1e6)
  ).toFixed(6);
  return { postCaption: out.post_caption, costUsd: cost };
}
