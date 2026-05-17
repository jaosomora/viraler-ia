// api/mcp/audit.js
// Helpers para el audit log + cuotas + toggle global del MCP.
// Mantenemos esto separado de routes.js para que la lógica de telemetría sea testeable.

import db from '../database/schema.js';

// ─── Audit log ───────────────────────────────────────────────────────────
function summarizeArgs(args) {
  if (!args || typeof args !== 'object') return null;
  try {
    const s = JSON.stringify(args);
    return s.length > 500 ? s.slice(0, 497) + '…' : s;
  } catch { return null; }
}

export function logToolCall({ userId, clientId, toolName, args, success, errorMessage, durationMs, costUsd }) {
  db.run(
    `INSERT INTO mcp_audit_log (user_id, client_id, tool_name, args_summary, success, error_message, duration_ms, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, clientId || null, toolName, summarizeArgs(args), success ? 1 : 0, errorMessage || null, durationMs || null, costUsd || 0],
    (err) => { if (err) console.error('[mcp-audit] insert failed:', err.message); }
  );
}

// ─── Cuotas ──────────────────────────────────────────────────────────────
// Tools que cuentan contra la cuota diaria de transcripciones.
const TRANSCRIPTION_TOOLS = new Set(['transcribe_video_url']);

export function isQuotaApplicable(toolName) {
  return TRANSCRIPTION_TOOLS.has(toolName);
}

// Devuelve { allowed: true } o { allowed: false, reason: "...", quota, used }.
// Owner (role) y usuarios sin cuota (NULL) son siempre allowed.
export function checkQuota(user, toolName) {
  return new Promise((resolve, reject) => {
    if (!isQuotaApplicable(toolName)) return resolve({ allowed: true });
    if (user.role === 'owner') return resolve({ allowed: true });

    db.get('SELECT mcp_quota_transcriptions_per_day FROM users WHERE id = ?', [user.id], (err, row) => {
      if (err) return reject(err);
      const quota = row?.mcp_quota_transcriptions_per_day;
      if (quota === null || quota === undefined) return resolve({ allowed: true });

      // Contar transcripciones exitosas vía MCP en las últimas 24h.
      db.get(
        `SELECT COUNT(*) AS used FROM mcp_audit_log
         WHERE user_id = ? AND tool_name = 'transcribe_video_url' AND success = 1
           AND created_at >= datetime('now', '-24 hours')`,
        [user.id],
        (err2, countRow) => {
          if (err2) return reject(err2);
          const used = countRow?.used || 0;
          if (used >= quota) {
            return resolve({
              allowed: false,
              reason: `Cuota diaria excedida (${used}/${quota} transcripciones en las últimas 24h). Pídele al administrador que la aumente o espera.`,
              quota,
              used,
            });
          }
          resolve({ allowed: true, quota, used });
        }
      );
    });
  });
}

// ─── Toggle global / por-usuario ──────────────────────────────────────────
export function getMcpGloballyDisabled() {
  return new Promise((resolve, reject) => {
    db.get(`SELECT value FROM settings WHERE key = 'mcp_disabled'`, (err, row) => {
      if (err) return reject(err);
      resolve(row?.value === '1');
    });
  });
}

export function setMcpGloballyDisabled(disabled) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES ('mcp_disabled', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [disabled ? '1' : '0'],
      (err) => err ? reject(err) : resolve()
    );
  });
}

export function isUserMcpDisabled(user) {
  return new Promise((resolve, reject) => {
    if (user.role === 'owner') return resolve(false);
    db.get('SELECT mcp_disabled FROM users WHERE id = ?', [user.id], (err, row) => {
      if (err) return reject(err);
      resolve(!!row?.mcp_disabled);
    });
  });
}
