// api/secrets.js
// Cualquier usuario logueado crea un secreto. Solo el owner puede leerlo.
import crypto from 'crypto';
import db from './database/schema.js';
import { encrypt, decrypt, isConfigured } from './services/cryptoService.js';

const EXPIRY_DAYS = 30;
const MAX_CONTENT_LEN = 50_000;

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

function ensureCryptoConfigured(res) {
  if (!isConfigured()) {
    res.status(500).json({ error: 'SECRETS_ENCRYPTION_KEY no configurada en el servidor' });
    return false;
  }
  return true;
}

async function purgeExpired() {
  await run(
    `DELETE FROM secrets
     WHERE expires_at < datetime('now')
        OR (deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days'))`
  );
}

// Crear secreto (cualquier usuario autenticado)
export async function createSecret(req, res) {
  try {
    if (!ensureCryptoConfigured(res)) return;
    const { content, title } = req.body || {};
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'El secreto no puede estar vacío' });
    }
    if (content.length > MAX_CONTENT_LEN) {
      return res.status(400).json({ error: `Máximo ${MAX_CONTENT_LEN} caracteres` });
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await run(
      `INSERT INTO secrets (token, title, content_encrypted, user_id, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [token, (title || '').trim().slice(0, 200) || null, encrypt(content), req.user.id, expiresAt]
    );
    res.json({
      id: result.lastID,
      token,
      title: title || null,
      expiresAt,
      createdAt: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Listar todos (solo owner)
export async function listSecrets(req, res) {
  try {
    await purgeExpired();
    const rows = await all(
      `SELECT s.id, s.token, s.title, s.created_at, s.expires_at, s.read_at,
              u.email AS creator_email, u.name AS creator_name
       FROM secrets s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.deleted_at IS NULL
       ORDER BY s.created_at DESC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      token: r.token,
      title: r.title,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      readAt: r.read_at,
      creator: r.creator_email ? { email: r.creator_email, name: r.creator_name } : null
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Revelar contenido por token (solo owner). Marca read_at.
export async function revealSecret(req, res) {
  try {
    if (!ensureCryptoConfigured(res)) return;
    const { token } = req.params;
    const row = await get(
      `SELECT s.*, u.email AS creator_email, u.name AS creator_name
       FROM secrets s LEFT JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.deleted_at IS NULL`,
      [token]
    );
    if (!row) return res.status(404).json({ error: 'Secreto no encontrado' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Secreto expirado' });
    }
    if (!row.read_at) {
      await run(`UPDATE secrets SET read_at = datetime('now') WHERE id = ?`, [row.id]);
    }
    res.json({
      id: row.id,
      token: row.token,
      title: row.title,
      content: decrypt(row.content_encrypted),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      readAt: row.read_at || new Date().toISOString(),
      creator: row.creator_email ? { email: row.creator_email, name: row.creator_name } : null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function deleteSecret(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await run(`UPDATE secrets SET deleted_at = datetime('now') WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
