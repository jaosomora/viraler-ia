// api/mcp/adminRoutes.js
// Endpoints admin para el tab MCP del AdminPanel. Solo owner (montado con ownerOnly en server.js).
//
// GET    /api/admin/mcp/overview          → contadores agregados (clientes, sesiones, calls hoy)
// GET    /api/admin/mcp/clients           → lista clientes OAuth registrados
// DELETE /api/admin/mcp/clients/:id       → borra cliente + revoca sus tokens
// GET    /api/admin/mcp/tokens            → access tokens activos (con email del user)
// DELETE /api/admin/mcp/tokens/:hash      → revoca token específico
// GET    /api/admin/mcp/audit             → audit log paginado, filtrable por user/tool/success
// GET    /api/admin/mcp/settings          → mcp_disabled global
// PATCH  /api/admin/mcp/settings          → toggle mcp_disabled
// GET    /api/admin/mcp/quotas            → cuotas por usuario
// PATCH  /api/admin/mcp/users/:id/quota   → set cuota o disable de un user

import db from '../database/schema.js';
import { getMcpGloballyDisabled, setMcpGloballyDisabled } from './audit.js';

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err); else resolve({ changes: this.changes });
    });
  });
}

// ── Overview ─────────────────────────────────────────────────────────────
export async function overview(req, res) {
  try {
    const [clients, activeTokens, callsToday, costToday, errorsToday] = await Promise.all([
      dbGet(`SELECT COUNT(*) AS n FROM oauth_clients`),
      dbGet(`SELECT COUNT(*) AS n FROM oauth_access_tokens WHERE revoked_at IS NULL AND expires_at > datetime('now')`),
      dbGet(`SELECT COUNT(*) AS n FROM mcp_audit_log WHERE created_at >= datetime('now', '-24 hours')`),
      dbGet(`SELECT COALESCE(SUM(cost_usd), 0) AS s FROM mcp_audit_log WHERE created_at >= datetime('now', '-24 hours')`),
      dbGet(`SELECT COUNT(*) AS n FROM mcp_audit_log WHERE success = 0 AND created_at >= datetime('now', '-24 hours')`),
    ]);
    const disabled = await getMcpGloballyDisabled();
    res.json({
      clients: clients.n,
      activeTokens: activeTokens.n,
      callsLast24h: callsToday.n,
      costLast24hUsd: +(costToday.s || 0).toFixed(4),
      errorsLast24h: errorsToday.n,
      mcpDisabled: disabled,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// ── Clients ──────────────────────────────────────────────────────────────
export async function listClients(req, res) {
  try {
    const rows = await dbAll(`
      SELECT c.client_id, c.client_name, c.redirect_uris, c.token_endpoint_auth_method,
             c.created_at, c.last_used_at,
             (SELECT COUNT(*) FROM oauth_access_tokens t
              WHERE t.client_id = c.client_id AND t.revoked_at IS NULL AND t.expires_at > datetime('now')
             ) AS active_tokens
      FROM oauth_clients c
      ORDER BY COALESCE(c.last_used_at, c.created_at) DESC
    `);
    res.json(rows.map(r => ({
      ...r,
      redirect_uris: JSON.parse(r.redirect_uris || '[]'),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function deleteClient(req, res) {
  try {
    const id = req.params.id;
    // Revocar tokens del cliente y borrarlo.
    await dbRun(`UPDATE oauth_access_tokens SET revoked_at = datetime('now') WHERE client_id = ? AND revoked_at IS NULL`, [id]);
    await dbRun(`UPDATE oauth_refresh_tokens SET revoked_at = datetime('now') WHERE client_id = ? AND revoked_at IS NULL`, [id]);
    const r = await dbRun(`DELETE FROM oauth_clients WHERE client_id = ?`, [id]);
    if (r.changes === 0) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Tokens activos ──────────────────────────────────────────────────────
export async function listTokens(req, res) {
  try {
    const rows = await dbAll(`
      SELECT t.token_hash, t.client_id, t.user_id, t.scope, t.expires_at, t.last_used_at, t.created_at,
             u.email AS user_email, u.name AS user_name,
             c.client_name
      FROM oauth_access_tokens t
      LEFT JOIN users u ON u.id = t.user_id
      LEFT JOIN oauth_clients c ON c.client_id = t.client_id
      WHERE t.revoked_at IS NULL AND t.expires_at > datetime('now')
      ORDER BY COALESCE(t.last_used_at, t.created_at) DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function revokeToken(req, res) {
  try {
    const r = await dbRun(`UPDATE oauth_access_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`, [req.params.hash]);
    if (r.changes === 0) return res.status(404).json({ error: 'Token no encontrado' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Audit log ────────────────────────────────────────────────────────────
export async function listAudit(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const userId = req.query.user_id ? parseInt(req.query.user_id, 10) : null;
    const tool = req.query.tool || null;
    const onlyErrors = req.query.only_errors === 'true' || req.query.only_errors === '1';

    const where = [];
    const params = [];
    if (userId) { where.push('a.user_id = ?'); params.push(userId); }
    if (tool) { where.push('a.tool_name = ?'); params.push(tool); }
    if (onlyErrors) where.push('a.success = 0');
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(limit);

    const rows = await dbAll(`
      SELECT a.id, a.user_id, a.client_id, a.tool_name, a.args_summary,
             a.success, a.error_message, a.duration_ms, a.cost_usd, a.created_at,
             u.email AS user_email, c.client_name
      FROM mcp_audit_log a
      LEFT JOIN users u ON u.id = a.user_id
      LEFT JOIN oauth_clients c ON c.client_id = a.client_id
      ${whereSql}
      ORDER BY a.id DESC
      LIMIT ?
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Settings (toggle global) ─────────────────────────────────────────────
export async function getSettings(req, res) {
  try {
    const disabled = await getMcpGloballyDisabled();
    res.json({ mcp_disabled: disabled });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function updateSettings(req, res) {
  try {
    const { mcp_disabled } = req.body || {};
    if (typeof mcp_disabled !== 'boolean') return res.status(400).json({ error: 'mcp_disabled debe ser boolean' });
    await setMcpGloballyDisabled(mcp_disabled);
    res.json({ success: true, mcp_disabled });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ── Cuotas por usuario ───────────────────────────────────────────────────
export async function listQuotas(req, res) {
  try {
    const rows = await dbAll(`
      SELECT u.id, u.email, u.name, u.role,
             u.mcp_quota_transcriptions_per_day AS quota,
             u.mcp_disabled,
             (SELECT COUNT(*) FROM mcp_audit_log a
              WHERE a.user_id = u.id AND a.tool_name = 'transcribe_video_url'
                AND a.success = 1 AND a.created_at >= datetime('now', '-24 hours')
             ) AS used_today
      FROM users u
      ORDER BY u.created_at ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
}

export async function updateUserQuota(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);
    const { quota, mcp_disabled } = req.body || {};

    // quota: int positivo o null (sin límite). mcp_disabled: bool.
    if (quota !== undefined && quota !== null && (!Number.isInteger(quota) || quota < 0)) {
      return res.status(400).json({ error: 'quota debe ser entero positivo o null' });
    }
    const sets = [];
    const params = [];
    if (quota !== undefined) { sets.push('mcp_quota_transcriptions_per_day = ?'); params.push(quota); }
    if (mcp_disabled !== undefined) { sets.push('mcp_disabled = ?'); params.push(mcp_disabled ? 1 : 0); }
    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(userId);
    const r = await dbRun(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
    if (r.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
