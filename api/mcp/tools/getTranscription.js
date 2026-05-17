// api/mcp/tools/getTranscription.js
// Lee el texto completo + metadata de una transcripción del usuario.
// Acepta opción para chunkear el texto si es muy largo (evita respuestas MCP gigantes).

import { z } from 'zod';
import { getTranscriptionById } from '../../utils/usageTrackerSQLite.js';
import { formatVideoMetadataLines } from './_videoMetadataFormat.js';

export const requiredScope = 'transcribe:read';

export const description =
  'Lee el texto completo de una transcripción ya guardada por su id. Devuelve el transcript entero, ' +
  'la metadata del video (título, autor, plataforma, duración, engagement) y, si existe, el análisis ' +
  'de ideas previamente generado. Soporta paginación por chunks de caracteres para transcripciones largas. ' +
  'Usa esta herramienta después de `transcribe_video_url` o `list_my_transcriptions` para acceder al contenido completo. ' +
  'Para transcripciones largas (>20k caracteres) considera pedir solo el chunk que necesites o pedirle al usuario en qué parte enfocarse.';

export const annotations = {
  title: 'Leer transcripción completa',
  readOnlyHint: true,
  openWorldHint: false,
};

export const inputSchema = {
  transcription_id: z.number().int().positive()
    .describe('Id numérico de la transcripción (devuelto por transcribe_video_url o list_my_transcriptions).'),
  chunk_size_chars: z.number().int().min(1000).max(50000).optional()
    .describe('Si se especifica, devuelve solo un chunk de N caracteres. Default: texto completo.'),
  chunk_index: z.number().int().min(0).optional()
    .describe('Índice del chunk a devolver (0-based). Solo aplica si chunk_size_chars está set. Default 0.'),
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

    const transcript = row.transcript || '';
    let chunkInfo = null;
    let displayText = transcript;

    if (args.chunk_size_chars) {
      const size = args.chunk_size_chars;
      const totalChunks = Math.max(1, Math.ceil(transcript.length / size));
      const idx = Math.min(args.chunk_index ?? 0, totalChunks - 1);
      const start = idx * size;
      displayText = transcript.slice(start, start + size);
      chunkInfo = { chunk_index: idx, total_chunks: totalChunks, chunk_size_chars: size };
    }

    const lines = [
      `[id ${row.id}] **${row.title || 'sin título'}**`,
      `Plataforma: ${row.platform} · Duración: ${Math.round(row.duration || 0)}s · Transcrito: ${row.created_at}`,
    ];
    if (row.url) lines.push(`URL: ${row.url}`);
    if (row.channel) lines.push(`Canal: ${row.channel}`);
    lines.push(...formatVideoMetadataLines(row));
    if (row.analysis) lines.push(`Análisis previo: sí (generado ${row.analysis_at})`);
    if (chunkInfo) lines.push(`Chunk ${chunkInfo.chunk_index + 1} de ${chunkInfo.total_chunks} (${chunkInfo.chunk_size_chars} chars/chunk)`);
    lines.push('');
    lines.push('— Transcript —');
    lines.push(displayText);

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      structuredContent: {
        id: row.id,
        url: row.url,
        title: row.title,
        platform: row.platform,
        duration_seconds: row.duration,
        channel: row.channel,
        language: row.language,
        created_at: row.created_at,
        transcript: displayText,
        transcript_full_length_chars: transcript.length,
        chunk: chunkInfo,
        metadata: {
          view_count: row.view_count,
          like_count: row.like_count,
          comment_count: row.comment_count,
          share_count: row.share_count,
          uploader_handle: row.uploader_handle,
          uploader_url: row.uploader_url,
          upload_date: row.upload_date,
          description: row.description,
          hashtags: safeParseJSON(row.hashtags),
        },
        analysis: row.analysis ? {
          markdown: row.analysis,
          model: row.analysis_model,
          generated_at: row.analysis_at,
        } : null,
      },
    };
  };
}
