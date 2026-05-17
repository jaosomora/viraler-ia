// api/mcp/tools/transcribeVideoUrl.js
// Transcribe un video desde URL (YouTube, IG Reels, TikTok, Facebook). Sync.
// Devuelve el TRANSCRIPT COMPLETO (no resumen) + metadata + id persistido.
// Diseñado para que Claude lo muestre literal al usuario, NO sintetice.

import { z } from 'zod';
import { runTranscription } from '../../services/transcribeService.js';
import { formatVideoMetadataLines } from './_videoMetadataFormat.js';

export const requiredScope = 'transcribe:write';

// CRÍTICO: la descripción es el "prompt" que ve Claude para decidir qué hacer.
// Instruimos explícitamente que muestre el transcript LITERAL, no que resuma.
export const description =
  'Transcribe un video desde URL (YouTube, YouTube Shorts, Instagram Reels, TikTok, Facebook Watch). ' +
  'Devuelve el TRANSCRIPT COMPLETO del video, junto con metadata (título, autor, duración, engagement) y el id de la transcripción persistida en la cuenta del usuario.\n\n' +

  'CÓMO PRESENTAR EL RESULTADO AL USUARIO (importante):\n' +
  '1. Empieza confirmando que la transcripción se guardó (incluye el id devuelto).\n' +
  '2. Muestra el TRANSCRIPT COMPLETO de forma LITERAL — en un bloque de cita o formato legible. NO resumas, NO parafrasees, NO extraigas "la idea central". El usuario pidió transcribir, no resumir.\n' +
  '3. Muestra la metadata del video (autor, plataforma, duración, engagement, descripción del creador) de forma breve y visual.\n' +
  '4. AL FINAL, ofrece próximos pasos opcionales: "¿Quieres que analice las ideas para que puedas replicar la estructura? ¿O prefieres un resumen?". Pero NO ejecutes nada de eso sin que el usuario lo pida.\n\n' +

  'Tiempo típico: 15-90 segundos para videos de hasta 10 minutos. ' +
  'Usa esta herramienta cuando el usuario pegue una URL de video y pida: "transcribe esto", "saca el texto", "qué dice este video", o similar. ' +
  'NO uses esta herramienta para archivos locales — esa función solo está en la app web de AS Tools.';

export const annotations = {
  title: 'Transcribir video desde URL',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
};

export const inputSchema = {
  url: z.string().url()
    .describe('URL pública del video. Acepta: youtube.com, youtu.be, youtube.com/shorts, instagram.com/reel, tiktok.com, facebook.com/watch, fb.watch.'),
};

// 2000 palabras cubre hasta ~15 min de habla densa. Por encima de eso truncamos
// y le decimos al cliente que use get_transcription para leer el resto.
const MAX_PREVIEW_WORDS = 2000;

function preview(text, maxWords = MAX_PREVIEW_WORDS) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { text, truncated: false };
  return { text: words.slice(0, maxWords).join(' ') + ' …', truncated: true };
}

export function makeHandler(user) {
  return async (args) => {
    const { url } = args;
    try {
      const result = await runTranscription(url, user.id);
      const { text: transcriptText, truncated } = preview(result.transcript);

      // Construcción del mensaje en orden óptimo para que Claude lo respete:
      // 1) Confirmación corta. 2) Transcript LITERAL primero (lo que el usuario pidió).
      // 3) Metadata. 4) Sugerencias de próximos pasos.
      const lines = [
        `✓ Transcripción guardada (id ${result.transcriptionId}).`,
        '',
        '─── TRANSCRIPT (mostrar al usuario literal, sin resumir) ───',
        transcriptText,
        '─── FIN TRANSCRIPT ───',
      ];
      if (truncated) {
        lines.push('');
        lines.push(`⚠️ Transcript truncado a las primeras ${MAX_PREVIEW_WORDS} palabras (texto completo: ${result.transcriptLength} caracteres). Avisa al usuario y ofrécele leer el resto con get_transcription(id=${result.transcriptionId}, chunk_size_chars=...).`);
      }

      lines.push('');
      lines.push(`**${result.title || 'sin título'}**`);
      lines.push(`Plataforma: ${result.platform} · Duración: ${Math.round(result.duration || 0)}s · Idioma: ${result.language}`);
      if (result.channel) lines.push(`Canal: ${result.channel}`);
      lines.push(...formatVideoMetadataLines(result.metadata));
      lines.push('');
      lines.push(`Costo estimado: $${result.estimatedCostUsd.toFixed(4)} USD · id en DB: ${result.transcriptionId}`);

      lines.push('');
      lines.push('─── PRÓXIMOS PASOS QUE PUEDES OFRECER (no ejecutar sin confirmación) ───');
      lines.push(`• Análisis de ideas (idea pelada + molde replicable) → analyze_ideas(transcription_id=${result.transcriptionId})`);
      lines.push('• Resumen ejecutivo del contenido (puedes hacerlo tú mismo en el chat)');
      lines.push(`• Releer transcript completo más tarde → get_transcription(transcription_id=${result.transcriptionId})`);

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        structuredContent: {
          transcription_id: result.transcriptionId,
          url: result.url,
          title: result.title,
          platform: result.platform,
          duration_seconds: result.duration,
          language: result.language,
          channel: result.channel,
          transcript: transcriptText,
          transcript_length_chars: result.transcriptLength,
          transcript_truncated: truncated,
          metadata: result.metadata,
          cost_usd: result.estimatedCostUsd,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error al transcribir: ${err.message}` }],
        isError: true,
      };
    }
  };
}
