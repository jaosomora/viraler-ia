// api/ideaMaps.js
// Handlers REST de Generador de Ideas (build_idea_map). Máquina de estados multi-turno.
//
// Endpoints:
//   POST   /api/idea-maps                 → arranca un mapa con las dos columnas crudas. Corre la compuerta. Si pasa, también genera. Si no, devuelve repregunta.
//   POST   /api/idea-maps/:id/respond     → el usuario responde a la repregunta. Repite el ciclo.
//   GET    /api/idea-maps                 → lista mapas del usuario.
//   GET    /api/idea-maps/:id             → detalle del mapa.
//   DELETE /api/idea-maps/:id             → borra (solo el propio).
//
// El estado vive en DB. Cada turn registra el intento en history para que el LLM lo vea
// en la siguiente vuelta (necesario para que la compuerta sepa qué ya se repreguntó).

import {
  runGate, runGenerate, canStillRepregunta,
  MAX_ATTEMPTS_PER_FILTER, MAX_TOTAL_TURNS, MIN_INPUT_CHARS, EXHAUSTED_MESSAGE,
} from './services/ideaMapService.js';
import {
  createIdeaMap, getIdeaMap, listIdeaMaps, updateIdeaMap,
  deleteIdeaMap, trackIdeaMap,
} from './utils/ideaMapsTracker.js';

// ─────────────────────────────────────────────────────────────────────────
// Lógica de turno — pura sobre el estado del mapa, decide qué pasa.
// Llama runGate (y runGenerate si pasa). Persiste el resultado.
// ─────────────────────────────────────────────────────────────────────────
async function processTurn(map) {
  const priorAttempts = (map.history || []).map(h => ({
    filter: h.filter, repregunta: h.repregunta, user_response: h.user_response,
  })).filter(a => a.user_response); // solo intentos con respuesta

  const gate = await runGate({
    vida_no_quiero: map.vida_no_quiero,
    vida_si_quiero: map.vida_si_quiero,
    prior_attempts: priorAttempts,
  });

  let accumCost = (map.cost_usd || 0) + gate.costUsd;

  if (gate.kind === 'reject') {
    // ¿Puede repreguntar todavía?
    const room = canStillRepregunta({
      attempts_per_filter: map.attempts_per_filter,
      failed_filter: gate.failed_filter,
      turn: map.turn,
    });
    if (!room.ok) {
      await updateIdeaMap(map.id, {
        status: 'exhausted',
        failed_filter: gate.failed_filter,
        diagnostic: gate.diagnostic,
        repregunta: null,
        cost_usd: accumCost,
      });
      return {
        status: 'exhausted',
        map_id: map.id,
        reason: room.reason,
        message: EXHAUSTED_MESSAGE,
        cost_usd: accumCost,
      };
    }

    // Registrar el rechazo en history para que el próximo runGate lo vea.
    const newHistory = [
      ...(map.history || []),
      { turn: map.turn, filter: gate.failed_filter, repregunta: gate.repregunta, diagnostic: gate.diagnostic, user_response: null },
    ];
    const newAttempts = { ...(map.attempts_per_filter || {}) };
    newAttempts[gate.failed_filter] = (newAttempts[gate.failed_filter] || 0) + 1;

    await updateIdeaMap(map.id, {
      status: 'awaiting_correction',
      failed_filter: gate.failed_filter,
      diagnostic: gate.diagnostic,
      repregunta: gate.repregunta,
      history: newHistory,
      attempts_per_filter: newAttempts,
      cost_usd: accumCost,
    });

    return {
      status: 'rejected',
      map_id: map.id,
      failed_filter: gate.failed_filter,
      diagnostic: gate.diagnostic,
      repregunta: gate.repregunta,
      attempts_remaining_this_filter: MAX_ATTEMPTS_PER_FILTER - newAttempts[gate.failed_filter],
      turns_remaining: MAX_TOTAL_TURNS - map.turn,
      cost_usd: accumCost,
    };
  }

  // Pasó la compuerta. Generar.
  const gen = await runGenerate({ axis_mode: gate.axis_mode, structure: gate.structure });
  accumCost = +(accumCost + gen.costUsd).toFixed(6);

  await updateIdeaMap(map.id, {
    status: 'success',
    failed_filter: null,
    repregunta: null,
    axis_mode: gate.axis_mode,
    structure: gate.structure,
    ideas: gen.ideas,
    cost_usd: accumCost,
  });
  await trackIdeaMap({ costUsd: accumCost });

  return {
    status: 'success',
    map_id: map.id,
    axis_mode: gate.axis_mode,
    structure: gate.structure,
    ideas: gen.ideas,
    cost_usd: accumCost,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────

export async function createHandler(req, res) {
  try {
    const { vida_no_quiero, vida_si_quiero } = req.body || {};
    if (typeof vida_no_quiero !== 'string' || typeof vida_si_quiero !== 'string') {
      return res.status(400).json({ error: 'vida_no_quiero y vida_si_quiero son requeridos (string).' });
    }
    if (vida_no_quiero.trim().length < MIN_INPUT_CHARS || vida_si_quiero.trim().length < MIN_INPUT_CHARS) {
      return res.status(400).json({
        error: `Cada columna necesita al menos ${MIN_INPUT_CHARS} caracteres. Escribe escenas concretas (martes, gente, lugares, qué haces), no resúmenes.`,
      });
    }

    const id = await createIdeaMap({
      userId: req.user.id,
      vida_no_quiero: vida_no_quiero.trim(),
      vida_si_quiero: vida_si_quiero.trim(),
    });
    const map = await getIdeaMap(id, req.user.id);
    const result = await processTurn(map);
    res.json(result);
  } catch (err) {
    console.error('[idea-maps] create failed:', err);
    res.status(500).json({ error: err.message || 'Error al crear mapa de ideas' });
  }
}

export async function respondHandler(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const { user_response } = req.body || {};
    if (typeof user_response !== 'string' || user_response.trim().length < 3) {
      return res.status(400).json({ error: 'Tu respuesta es demasiado corta.' });
    }

    const map = await getIdeaMap(id, req.user.id);
    if (!map) return res.status(404).json({ error: 'Mapa no encontrado' });
    if (map.status !== 'awaiting_correction') {
      return res.status(409).json({ error: `El mapa ya está en estado "${map.status}", no admite más respuestas.` });
    }

    // Cerrar el último item de history con la respuesta del usuario y avanzar turno.
    const history = [...(map.history || [])];
    const lastIdx = history.findLastIndex(h => h.user_response === null);
    if (lastIdx === -1) {
      return res.status(409).json({ error: 'Estado inconsistente: no hay repregunta pendiente.' });
    }
    history[lastIdx] = { ...history[lastIdx], user_response: user_response.trim() };

    await updateIdeaMap(id, { history, turn: map.turn + 1 });
    const updated = await getIdeaMap(id, req.user.id);
    const result = await processTurn(updated);
    res.json(result);
  } catch (err) {
    console.error('[idea-maps] respond failed:', err);
    res.status(500).json({ error: err.message || 'Error al procesar respuesta' });
  }
}

export async function getHandler(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const map = await getIdeaMap(id, req.user.id);
    if (!map) return res.status(404).json({ error: 'Mapa no encontrado' });
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function listHandler(req, res) {
  try {
    const rows = await listIdeaMaps(req.user.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteHandler(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const result = await deleteIdeaMap(id, req.user.id);
    if (!result.success) return res.status(404).json(result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function adminListHandler(req, res) {
  try {
    const { listAllIdeaMaps } = await import('./utils/ideaMapsTracker.js');
    const rows = await listAllIdeaMaps();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
