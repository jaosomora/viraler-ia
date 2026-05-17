// api/mcp/tools/analyzeIdeas.js
// Genera el análisis de ideas (replicar, no auditar) sobre una transcripción.
// Idempotente: si ya existe análisis y force=false, devuelve el cacheado (evita doble cobro).

import { z } from 'zod';
import {
  getTranscriptionById,
  saveTranscriptionAnalysis,
  trackAnalysis,
} from '../../utils/usageTrackerSQLite.js';
import { analyzeTranscription } from '../../services/analysisService.js';

export const requiredScope = 'analyze:write';

export const description =
  'Genera un análisis de ideas sobre una transcripción ya guardada. ' +
  'El análisis NO es una auditoría — extrae la idea pelada del video y un molde paso a paso (con corchetes editables) ' +
  'para que el usuario pueda replicar la estructura en su propio tema/voz/sector. ' +
  'Devuelve el análisis en markdown. Idempotente: si ya hay análisis previo, lo devuelve cacheado salvo que pases force=true. ' +
  'Usa esta herramienta cuando el usuario pida "analiza las ideas", "qué puedo aprender de esto", "cómo replicar esta estructura", o similar. ' +
  'Consume cuota de OpenAI (~$0.002 por análisis).';

export const annotations = {
  title: 'Analizar ideas de transcripción',
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

export const inputSchema = {
  transcription_id: z.number().int().positive()
    .describe('Id de la transcripción a analizar.'),
  force: z.boolean().optional()
    .describe('Si true, regenera el análisis aunque ya exista uno previo. Default false (devuelve cacheado).'),
};

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

    const force = !!args.force;
    if (row.analysis && !force) {
      return {
        content: [{
          type: 'text',
          text:
            `Análisis cacheado (generado ${row.analysis_at} con ${row.analysis_model}). ` +
            `Para regenerar usa force=true.\n\n${row.analysis}`,
        }],
        structuredContent: {
          transcription_id: id,
          cached: true,
          model: row.analysis_model,
          generated_at: row.analysis_at,
          analysis_markdown: row.analysis,
        },
      };
    }

    try {
      const { analysis, model, costUsd } = await analyzeTranscription(row);
      await saveTranscriptionAnalysis(id, { analysis, model, costUsd });
      await trackAnalysis({ costUsd });

      return {
        content: [{
          type: 'text',
          text: `Análisis generado (${model}, costo $${costUsd.toFixed(4)} USD).\n\n${analysis}`,
        }],
        structuredContent: {
          transcription_id: id,
          cached: false,
          model,
          cost_usd: costUsd,
          generated_at: new Date().toISOString(),
          analysis_markdown: analysis,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error al analizar: ${err.message}` }],
        isError: true,
      };
    }
  };
}
