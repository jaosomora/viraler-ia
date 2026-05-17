// api/oauth/storage.js
// Helpers de DB para OAuth. Promisificados y enfocados a un solo propósito.
// Tokens se guardan SIEMPRE como hash SHA-256 — el valor raw solo vive en la respuesta HTTP.
import crypto from 'crypto';
import db from '../database/schema.js';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

// ─── Clients ──────────────────────────────────────────────────────────────
export function createClient({ clientId, clientSecretHash, clientName, redirectUris, tokenEndpointAuthMethod }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO oauth_clients (client_id, client_secret_hash, client_name, redirect_uris, token_endpoint_auth_method)
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, clientSecretHash || null, clientName || null, JSON.stringify(redirectUris), tokenEndpointAuthMethod || 'none'],
      (err) => err ? reject(err) : resolve()
    );
  });
}

export function getClient(clientId) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM oauth_clients WHERE client_id = ?', [clientId], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      row.redirect_uris = JSON.parse(row.redirect_uris);
      resolve(row);
    });
  });
}

export function touchClient(clientId) {
  db.run(`UPDATE oauth_clients SET last_used_at = datetime('now') WHERE client_id = ?`, [clientId], () => {});
}

// ─── Authorization codes ──────────────────────────────────────────────────
export function createAuthCode({ code, clientId, userId, redirectUri, codeChallenge, codeChallengeMethod, scope, resource, ttlSeconds = 600 }) {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    db.run(
      `INSERT INTO oauth_auth_codes (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sha256(code), clientId, userId, redirectUri, codeChallenge, codeChallengeMethod || 'S256', scope || null, resource || null, expiresAt],
      (err) => err ? reject(err) : resolve()
    );
  });
}

// Consume el code (single-use): lo retorna y lo marca como usado en la misma transacción lógica.
// Si ya fue usado o expiró → resuelve null.
export function consumeAuthCode(rawCode) {
  return new Promise((resolve, reject) => {
    const codeHash = sha256(rawCode);
    db.get('SELECT * FROM oauth_auth_codes WHERE code_hash = ?', [codeHash], (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      if (row.used_at) return resolve(null);
      if (new Date(row.expires_at) < new Date()) return resolve(null);
      db.run(`UPDATE oauth_auth_codes SET used_at = datetime('now') WHERE code_hash = ?`, [codeHash], (updErr) => {
        if (updErr) return reject(updErr);
        resolve(row);
      });
    });
  });
}

// ─── Access tokens ────────────────────────────────────────────────────────
export function createAccessToken({ token, clientId, userId, scope, resource, ttlSeconds = 3600 }) {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    db.run(
      `INSERT INTO oauth_access_tokens (token_hash, client_id, user_id, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sha256(token), clientId, userId, scope || null, resource || null, expiresAt],
      (err) => err ? reject(err) : resolve({ expiresAt, expiresIn: ttlSeconds })
    );
  });
}

export function getAccessToken(rawToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM oauth_access_tokens WHERE token_hash = ?', [sha256(rawToken)], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

export function touchAccessToken(rawToken) {
  db.run(`UPDATE oauth_access_tokens SET last_used_at = datetime('now') WHERE token_hash = ?`, [sha256(rawToken)], () => {});
}

export function revokeAccessToken(rawToken) {
  return new Promise((resolve) => {
    db.run(`UPDATE oauth_access_tokens SET revoked_at = datetime('now') WHERE token_hash = ?`, [sha256(rawToken)], () => resolve());
  });
}

// ─── Refresh tokens ───────────────────────────────────────────────────────
export function createRefreshToken({ token, clientId, userId, scope, resource, ttlSeconds = 30 * 24 * 3600 }) {
  return new Promise((resolve, reject) => {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    db.run(
      `INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, scope, resource, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sha256(token), clientId, userId, scope || null, resource || null, expiresAt],
      (err) => err ? reject(err) : resolve()
    );
  });
}

export function getRefreshToken(rawToken) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM oauth_refresh_tokens WHERE token_hash = ?', [sha256(rawToken)], (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

// Rotación: marca el viejo como revocado y apunta al nuevo. Mismo en una sola op.
export function rotateRefreshToken(oldRaw, newRaw) {
  return new Promise((resolve) => {
    db.run(
      `UPDATE oauth_refresh_tokens SET revoked_at = datetime('now'), replaced_by = ? WHERE token_hash = ?`,
      [sha256(newRaw), sha256(oldRaw)],
      () => resolve()
    );
  });
}
