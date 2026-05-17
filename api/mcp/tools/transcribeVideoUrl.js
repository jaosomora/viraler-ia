// api/mcp/tools/transcribeVideoUrl.js
// Transcribe un video desde URL (YouTube, IG Reels, TikTok, Facebook). Sync.
// Devuelve transcription_id + preview. El texto completo se lee con get_transcription.

import { z } from 'zod';
import { runTranscription } from '../../services/transcribeService.js';
import { formatVideoMetadataLines } from './_videoMetadataFormat.js';

export const requiredScope = 'transcribe:write';

export const description =
  'Transcribe un video desde URL (YouTube, YouTube Shorts, Instagram Reels, TikTok, Facebook Watch). ' +
  'Devuelve el id de la transcripción persistida, metadata del video (título, autor, duración, engagement si está disponible) y un preview de las primeras ~500 palabras del transcript. ' +
  'Para leer el transcript completo después usa `get_transcription` con el id devuelto. Para generar un análisis de ideas usa `analyze_ideas`. ' +
  'Tiempo típico: 15-60 segundos para videos de hasta 10 minutos. ' +
  'Usa esta herramienta cuando el usuario pegue una URL de video y pida transcribirla, sacarle el texto, "qué dice este video", o similar. ' +
  'NO uses esta herramienta si el usuario quiere transcribir un archivo de audio/video que ya tiene en local — esa función solo está disponible en la app web de AS Tools.';

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

// Devuelve solo las primeras N palabras del transcript para no inflar la respuesta MCP.
function preview(text, maxWords = 500) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return { text, truncated: false };
  return { text: words.slice(0, maxWords).join(' ') + ' …', truncated: true };
}

export function makeHandler(user) {
  return async (args) => {
    const { url } = args;
    try {
      const result = await runTranscription(url, user.id);
      const { text: previewText, truncated } = preview(result.transcript);

      const lines = [
        `✓ Transcripción guardada (id ${result.transcriptionId}).`,
        `**${result.title || 'sin título'}**`,
        `Plataforma: ${result.platform} · Duración: ${Math.round(result.duration || 0)}s · Idioma: ${result.language}`,
      ];
      if (result.channel) lines.push(`Canal: ${result.channel}`);
      lines.push(...formatVideoMetadataLines(result.metadata));
      lines.push('');
      lines.push(`Costo estimado: $${result.estimatedCostUsd.toFixed(4)} USD`);
      lines.push('');
      lines.push(truncated ? '— Preview (primeras ~500 palabras) —' : '— Transcript —');
      lines.push(previewText);
      if (truncated) {
        lines.push('');
        lines.push(`(Transcript truncado. Texto completo: ${result.transcriptLength} caracteres. Usa get_transcription con id=${result.transcriptionId} para leerlo entero.)`);
      }

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
          transcript_length_chars: result.transcriptLength,
          transcript_preview: previewText,
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
