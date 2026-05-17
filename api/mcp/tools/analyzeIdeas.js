// api/mcp/tools/analyzeIdeas.js
// Cuando este tool se llama desde el MCP (cliente = Claude.ai), NO ejecutamos gpt-4o-mini.
// En su lugar, devolvemos el transcript + el LENTE (system prompt que ya está afinado)
// para que el propio Claude del chat aplique el análisis con su capacidad superior.
//
// La REST API /api/transcriptions/:id/analyze (que alimenta la UI web) sigue
// ejecutando gpt-4o-mini y persistiendo en DB — eso NO se toca.

import { z } from 'zod';
import { getTranscriptionById } from '../../utils/usageTrackerSQLite.js';
import { SYSTEM_PROMPT, buildUserPrompt } from '../../services/analysisService.js';

export const requiredScope = 'analyze:write';

export const description =
  'Devuelve el transcript de un video junto con el lente de análisis afinado de AS Tools, ' +
  'para que TÚ (Claude) hagas la síntesis de "idea pelada + molde replicable" con tu propia capacidad. ' +
  'NO ejecuta gpt-4o-mini ni consume cuota OpenAI — el análisis lo produces tú mismo en este chat usando las instrucciones que vienen en el resultado.\n\n' +

  'CÓMO USAR EL RESULTADO (importante):\n' +
  '1. Lee el bloque "LENTE DE ANÁLISIS" → es el system prompt afinado de AS Tools (replicar no auditar, sin jerga de marketing, formato específico de 2 secciones).\n' +
  '2. Lee el bloque "CONTEXTO + TRANSCRIPT" → es la entrada que normalmente recibe gpt-4o-mini.\n' +
  '3. Aplica el lente al transcript y entrega al usuario el análisis siguiendo el formato exacto que pide el lente (las 2 secciones markdown: 💡 La jugada en dos líneas + 📋 El molde paso a paso).\n' +
  '4. NO inventes contexto adicional fuera del transcript. NO adaptes a sectores ajenos. Sigue el lente al pie de la letra.\n\n' +

  'Usa este tool cuando el usuario pida: "analiza las ideas", "qué hay detrás de este video", "saca el molde replicable", "cómo replico esta estructura". ' +
  'Requiere haber transcrito el video antes (necesitas el transcription_id).';

export const annotations = {
  title: 'Analizar ideas de transcripción (con Claude)',
  readOnlyHint: true,
  openWorldHint: false,
};

export const inputSchema = {
  transcription_id: z.number().int().positive()
    .describe('Id de la transcripción a analizar (devuelto por transcribe_video_url o list_my_transcriptions).'),
};

function safeParseJSON(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export function makeHandler(user) {
  return async (args) => {
    const id = args.transcription_id;
    const row = await getTranscriptionById(id, user.id);
    if (!row) {
      return {
        content: [{ type: 'text', text: `Transcripción ${id} no encontrada o no es tuya.` }],
        isError: true,
      };
    }

    const transcript = (row.transcript || '').trim();
    if (transcript.length < 30) {
      return {
        content: [{ type: 'text', text: 'El transcript es demasiado corto para analizar (menos de 30 caracteres).' }],
        isError: true,
      };
    }

    // Normalizar hashtags si vienen como string JSON (DB)
    const normalized = {
      ...row,
      hashtags: typeof row.hashtags === 'string' ? safeParseJSON(row.hashtags) : row.hashtags,
    };
    const userPrompt = buildUserPrompt(normalized);

    const text = [
      `Transcripción id=${id} cargada. Aplica el lente al transcript siguiendo estas instrucciones:`,
      '',
      '─── LENTE DE ANÁLISIS (system prompt afinado de AS Tools) ───',
      SYSTEM_PROMPT,
      '─── FIN LENTE ───',
      '',
      '─── CONTEXTO + TRANSCRIPT (lo que aplicarías el lente) ───',
      userPrompt,
      '─── FIN CONTEXTO ───',
      '',
      'Ahora produce el análisis siguiendo el formato exacto del lente (2 secciones markdown: 💡 La jugada en dos líneas + 📋 El molde paso a paso) y entrégalo al usuario. NO ejecutes ningún tool adicional, NO adaptes a sectores ajenos, NO inventes contexto. Solo aplica el lente al transcript.',
    ].join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        transcription_id: id,
        title: row.title,
        platform: row.platform,
        duration_seconds: row.duration,
        analysis_lens: SYSTEM_PROMPT,
        analysis_input: userPrompt,
        executed_by: 'claude_in_chat',
        cost_usd: 0,
      },
    };
  };
}
