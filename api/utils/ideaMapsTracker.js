// api/utils/ideaMapsTracker.js
// DB helpers para idea_maps. Separado de usageTrackerSQLite.js porque la herramienta
// tiene su propia tabla y máquina de estados.

import db from '../database/schema.js';

function rowToObject(row) {
  if (!row) return null;
  return {
    ...row,
    attempts_per_filter: safeParse(row.attempts_per_filter, {}),
    history: safeParse(row.history, []),
    structure: safeParse(row.structure, null),
    ideas: safeParse(row.ideas, null),
  };
}

function safeParse(s, fallback) {
  if (!s) return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch { return fallback; }
}

export function createIdeaMap({ userId, tema, vida_no_quiero, vida_si_quiero }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO idea_maps (user_id, tema, vida_no_quiero, vida_si_quiero, status, turn, attempts_per_filter, history)
       VALUES (?, ?, ?, ?, 'awaiting_correction', 1, '{}', '[]')`,
      [userId, tema || null, vida_no_quiero, vida_si_quiero],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

export function getIdeaMap(id, userId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM idea_maps WHERE id = ? AND user_id = ?`,
      [id, userId],
      (err, row) => err ? reject(err) : resolve(rowToObject(row))
    );
  });
}

export function listIdeaMaps(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT id, tema, status, turn, failed_filter, axis_mode, cost_usd, created_at, updated_at,
              substr(vida_no_quiero, 1, 120) AS preview_no,
              substr(vida_si_quiero, 1, 120) AS preview_si
       FROM idea_maps WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
      [userId],
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });
}

export function listAllIdeaMaps() {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT m.id, m.user_id, m.tema, m.status, m.turn, m.failed_filter, m.axis_mode, m.cost_usd,
              m.created_at, m.updated_at, u.email AS user_email
       FROM idea_maps m
       LEFT JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC LIMIT 500`,
      [],
      (err, rows) => err ? reject(err) : resolve(rows || [])
    );
  });
}

export function updateIdeaMap(id, fields) {
  return new Promise((resolve, reject) => {
    const cols = [];
    const vals = [];
    for (const [k, v] of Object.entries(fields)) {
      cols.push(`${k} = ?`);
      if (k === 'attempts_per_filter' || k === 'history' || k === 'structure' || k === 'ideas') {
        vals.push(v === null || v === undefined ? null : JSON.stringify(v));
      } else {
        vals.push(v);
      }
    }
    cols.push(`updated_at = CURRENT_TIMESTAMP`);
    vals.push(id);
    db.run(
      `UPDATE idea_maps SET ${cols.join(', ')} WHERE id = ?`,
      vals,
      function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      }
    );
  });
}

export function deleteIdeaMap(id, userId) {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM idea_maps WHERE id = ? AND user_id = ?`,
      [id, userId],
      function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return resolve({ success: false, message: 'Mapa no encontrado' });
        resolve({ success: true });
      }
    );
  });
}

/**
 * Suma 1 mapa exitoso al contador diario de usage_stats. Solo se llama cuando el mapa
 * llega a status='success'; rechazos no cuentan (pueden ser N intentos por mapa).
 * costUsd agrega validate + generate.
 */
export function trackIdeaMap({ costUsd }) {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT id FROM usage_stats WHERE date = ?`, [today], (err, row) => {
      if (err) { console.error('trackIdeaMap:', err); return resolve(); }
      if (row) {
        db.run(
          `UPDATE usage_stats SET idea_maps = COALESCE(idea_maps,0) + 1,
                                  idea_maps_cost = COALESCE(idea_maps_cost,0) + ?
           WHERE id = ?`,
          [costUsd || 0, row.id],
          () => resolve()
        );
      } else {
        db.run(
          `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost, idea_maps, idea_maps_cost)
           VALUES (?, 0, 0, 0, 1, ?)`,
          [today, costUsd || 0],
          () => resolve()
        );
      }
    });
  });
}
