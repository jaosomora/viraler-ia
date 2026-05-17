// api/mcp/tools/analyzeIdeas.js
// MCP tool registrada como `analyze_video_transcript` (sin "ideas" en el nombre para no
// colisionar con build_idea_map → Generador de Ideas). El archivo conserva el nombre legacy
// porque la lógica es la misma. La tool decompone un video AJENO ya transcrito.
//
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
  'Analiza una TRANSCRIPCIÓN de video AJENO ya guardada en AS Tools. Requiere un transcription_id existente (devuelto por transcribe_video_url o list_my_transcriptions). ' +
  'Devuelve el transcript + un lente afinado para que TÚ (Claude) extraigas la estructura replicable del video del autor original. NO ejecuta LLM en el server.\n\n' +

  'NO ES el "Generador de Ideas". Si el usuario menciona "Generador de Ideas", "generar/sacar/hacer ideas", "ideas para mis publicaciones", "ideas que suenen a mí", o "mapa de ideas" → usa build_idea_map, NO esta tool. Esta tool SOLO sirve cuando hay un video ajeno transcrito y el usuario quiere replicar su estructura.\n\n' +

  'CUÁNDO USAR: el usuario pide "analiza este video que transcribí", "qué hay detrás de este video", "cómo replico esta estructura de [@autor]", "decompón este reel". Siempre apunta a un VIDEO AJENO YA TRANSCRITO.\n\n' +

  'CÓMO USAR EL RESULTADO:\n' +
  '1. Lee el bloque "LENTE DE ANÁLISIS" → es el system prompt afinado de AS Tools.\n' +
  '2. Lee el bloque "CONTEXTO + TRANSCRIPT" → es la entrada.\n' +
  '3. Aplica el lente al transcript y entrega al usuario el análisis siguiendo el formato exacto que pide el lente.\n' +
  '4. NO inventes contexto fuera del transcript. NO adaptes a sectores ajenos. Sigue el lente al pie de la letra.';

export const annotations = {
  title: 'Analizar transcripción de video (con Claude)',
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
