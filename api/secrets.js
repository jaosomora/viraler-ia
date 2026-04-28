// api/secrets.js
// Endpoints para "Sobres de credenciales": el admin crea un sobre con un token,
// el cliente entra al link público y envía sus credenciales (cifradas), el admin las revela luego.
import crypto from 'crypto';
import db from './database/schema.js';
import { encrypt, decrypt, isConfigured } from './services/cryptoService.js';

const EXPIRY_DAYS = 30;

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

// Purga sobres expirados o con deleted_at antiguo. Se llama bajo demanda.
async function purgeExpired() {
  await run(
    `DELETE FROM secret_deliveries
     WHERE (expires_at < datetime('now') AND submitted_at IS NULL)
        OR (deleted_at IS NOT NULL AND deleted_at < datetime('now', '-7 days'))`
  );
}

// === ADMIN ===

// Crear sobre. Devuelve token (id en URL pública).
export async function createDelivery(req, res) {
  try {
    if (!ensureCryptoConfigured(res)) return;
    const { clientName, description } = req.body || {};
    if (!clientName || !clientName.trim()) {
      return res.status(400).json({ error: 'clientName es requerido' });
    }
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const result = await run(
      `INSERT INTO secret_deliveries (token, client_name, description, created_by, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [token, clientName.trim(), (description || '').trim() || null, req.user.id, expiresAt]
    );
    res.json({
      id: result.lastID,
      token,
      clientName: clientName.trim(),
      description: description || null,
      expiresAt,
      submittedAt: null,
      readAt: null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function listDeliveries(req, res) {
  try {
    await purgeExpired();
    const rows = await all(
      `SELECT id, token, client_name, description, created_at, expires_at,
              submitted_at, read_at
       FROM secret_deliveries
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );
    res.json(rows.map(r => ({
      id: r.id,
      token: r.token,
      clientName: r.client_name,
      description: r.description,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      submittedAt: r.submitted_at,
      readAt: r.read_at
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Revelar contenido (descifra). Marca read_at.
export async function revealDelivery(req, res) {
  try {
    if (!ensureCryptoConfigured(res)) return;
    const id = parseInt(req.params.id, 10);
    const delivery = await get(
      `SELECT * FROM secret_deliveries WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    if (!delivery) return res.status(404).json({ error: 'Sobre no encontrado' });
    if (!delivery.submitted_at) {
      return res.status(400).json({ error: 'El cliente aún no ha enviado contenido' });
    }
    const items = await all(
      `SELECT * FROM secret_items WHERE delivery_id = ? ORDER BY position ASC, id ASC`,
      [id]
    );
    const decryptedItems = items.map(it => ({
      id: it.id,
      serviceName: it.service_name,
      url: decrypt(it.url_encrypted),
      username: decrypt(it.username_encrypted),
      password: decrypt(it.password_encrypted),
      notes: decrypt(it.notes_encrypted)
    }));
    if (!delivery.read_at) {
      await run(`UPDATE secret_deliveries SET read_at = datetime('now') WHERE id = ?`, [id]);
    }
    res.json({
      id: delivery.id,
      token: delivery.token,
      clientName: delivery.client_name,
      description: delivery.description,
      submittedAt: delivery.submitted_at,
      readAt: delivery.read_at || new Date().toISOString(),
      globalNotes: decrypt(delivery.global_notes_encrypted),
      items: decryptedItems
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

export async function deleteDelivery(req, res) {
  try {
    const id = parseInt(req.params.id, 10);
    await run(
      `UPDATE secret_deliveries SET deleted_at = datetime('now') WHERE id = ?`,
      [id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// === PÚBLICO (cliente, sin login) ===

// Metadata del sobre por token. NO devuelve contenido cifrado.
export async function getPublicDelivery(req, res) {
  try {
    const { token } = req.params;
    const delivery = await get(
      `SELECT client_name, description, expires_at, submitted_at, deleted_at
       FROM secret_deliveries WHERE token = ?`,
      [token]
    );
    if (!delivery || delivery.deleted_at) {
      return res.status(404).json({ error: 'Link inválido o expirado' });
    }
    const expired = new Date(delivery.expires_at) < new Date();
    res.json({
      clientName: delivery.client_name,
      description: delivery.description,
      submitted: !!delivery.submitted_at,
      expired,
      expiresAt: delivery.expires_at
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

// Cliente envía credenciales. One-shot: si ya fue submitted, rechaza.
export async function submitDelivery(req, res) {
  try {
    if (!ensureCryptoConfigured(res)) return;
    const { token } = req.params;
    const { items, globalNotes } = req.body || {};

    const delivery = await get(
      `SELECT id, expires_at, submitted_at, deleted_at FROM secret_deliveries WHERE token = ?`,
      [token]
    );
    if (!delivery || delivery.deleted_at) {
      return res.status(404).json({ error: 'Link inválido' });
    }
    if (delivery.submitted_at) {
      return res.status(409).json({ error: 'Este link ya fue utilizado' });
    }
    if (new Date(delivery.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Link expirado' });
    }

    const cleanItems = Array.isArray(items) ? items.filter(it =>
      it && (it.serviceName || it.url || it.username || it.password || it.notes)
    ) : [];

    if (cleanItems.length === 0 && !(globalNotes && globalNotes.trim())) {
      return res.status(400).json({ error: 'Debes enviar al menos una credencial o notas' });
    }

    // Límite defensivo
    if (cleanItems.length > 50) {
      return res.status(400).json({ error: 'Demasiadas credenciales (máx. 50)' });
    }

    for (let i = 0; i < cleanItems.length; i++) {
      const it = cleanItems[i];
      await run(
        `INSERT INTO secret_items
          (delivery_id, service_name, url_encrypted, username_encrypted, password_encrypted, notes_encrypted, position)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          delivery.id,
          it.serviceName ? String(it.serviceName).slice(0, 200) : null,
          encrypt(it.url),
          encrypt(it.username),
          encrypt(it.password),
          encrypt(it.notes),
          i
        ]
      );
    }

    await run(
      `UPDATE secret_deliveries
       SET submitted_at = datetime('now'), global_notes_encrypted = ?
       WHERE id = ?`,
      [encrypt(globalNotes), delivery.id]
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
