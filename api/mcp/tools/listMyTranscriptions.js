// api/mcp/tools/listMyTranscriptions.js
// Lista las transcripciones del usuario autenticado. Stateless, paginable.
// Reusa db directo (no hay un service shared para esto y la query es simple).
import { z } from 'zod';
import db from '../../database/schema.js';

export const inputSchema = {
  limit: z.number().int().min(1).max(50).optional()
    .describe('Cuántas transcripciones devolver (1-50, default 20).'),
  platform: z.enum(['youtube', 'instagram', 'tiktok', 'facebook', 'upload']).optional()
    .describe('Filtrar por plataforma de origen.'),
};

export const description =
  'Lista las transcripciones que el usuario actual ha generado en AS Tools, ordenadas de más recientes a más viejas. Devuelve id, título, plataforma, duración, y fecha. ' +
  'Usa esta herramienta cuando el usuario pregunte "¿qué transcripciones tengo?", "muéstrame mis transcripciones recientes", o necesites localizar el id de una transcripción para luego leerla o analizarla. ' +
  'NO uses esta herramienta para crear transcripciones nuevas — para eso existe `transcribe_video_url`.';

export const annotations = {
  title: 'Listar mis transcripciones',
  readOnlyHint: true,
  openWorldHint: false,
};

export function makeHandler(user) {
  return async (args) => {
    const limit = args?.limit ?? 20;
    const platform = args?.platform;

    const where = ['user_id = ?'];
    const params = [user.id];
    if (platform) {
      where.push('platform = ?');
      params.push(platform);
    }
    params.push(limit);

    const sql = `
      SELECT id, title, platform, duration, channel, url, created_at,
             (analysis IS NOT NULL) AS has_analysis,
             LENGTH(transcript) AS transcript_length
      FROM transcriptions
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const rows = await new Promise((resolve, reject) => {
      db.all(sql, params, (err, rs) => err ? reject(err) : resolve(rs));
    });

    const items = rows.map(r => ({
      id: r.id,
      title: r.title || '(sin título)',
      platform: r.platform,
      duration_seconds: r.duration,
      channel: r.channel,
      url: r.url,
      created_at: r.created_at,
      has_analysis: !!r.has_analysis,
      transcript_length_chars: r.transcript_length,
    }));

    const summary = items.length === 0
      ? 'No tienes transcripciones todavía.'
      : `${items.length} transcripción(es)${platform ? ` en ${platform}` : ''}:\n` +
        items.map(i => `• [${i.id}] ${i.title} (${i.platform}, ${Math.round(i.duration_seconds || 0)}s) — ${i.created_at}`).join('\n');

    return {
      content: [
        { type: 'text', text: summary },
      ],
      structuredContent: { transcriptions: items },
    };
  };
}
