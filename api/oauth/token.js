// api/oauth/token.js
// POST /oauth/token — intercambia authorization_code por access_token (+ refresh_token),
// y soporta grant_type=refresh_token con rotación.
// PKCE S256 obligatorio. Accept x-www-form-urlencoded (estándar OAuth) y JSON (fallback).

import crypto from 'crypto';
import {
  randomToken,
  getClient,
  consumeAuthCode,
  createAccessToken,
  createRefreshToken,
  getRefreshToken,
  rotateRefreshToken,
} from './storage.js';

const ACCESS_TTL_SECONDS = 60 * 60;            // 1h
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30d

function bad(res, error, description, status = 400) {
  return res.status(status).json({ error, error_description: description });
}

function verifyPkceS256(verifier, challenge) {
  if (typeof verifier !== 'string' || verifier.length < 43 || verifier.length > 128) return false;
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url');
  // Comparación constant-time.
  if (computed.length !== challenge.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
}

export async function tokenEndpoint(req, res) {
  // Express parsea x-www-form-urlencoded si se monta el middleware; si llega JSON también vale.
  const p = req.body || {};
  const grantType = p.grant_type;

  if (grantType === 'authorization_code') {
    return handleAuthorizationCode(req, res, p);
  }
  if (grantType === 'refresh_token') {
    return handleRefresh(req, res, p);
  }
  return bad(res, 'unsupported_grant_type', `grant_type "${grantType}" no soportado`);
}

async function handleAuthorizationCode(req, res, p) {
  const { code, redirect_uri, client_id, code_verifier } = p;
  if (!code || !redirect_uri || !client_id || !code_verifier) {
    return bad(res, 'invalid_request', 'code, redirect_uri, client_id y code_verifier son requeridos');
  }

  const client = await getClient(client_id);
  if (!client) return bad(res, 'invalid_client', 'client_id desconocido', 401);

  const row = await consumeAuthCode(code);
  if (!row) return bad(res, 'invalid_grant', 'authorization_code inválido, expirado o ya usado');

  if (row.client_id !== client_id) return bad(res, 'invalid_grant', 'client_id no coincide con el code');
  if (row.redirect_uri !== redirect_uri) return bad(res, 'invalid_grant', 'redirect_uri no coincide');
  if (row.code_challenge_method !== 'S256') return bad(res, 'invalid_grant', 'PKCE S256 requerido');
  if (!verifyPkceS256(code_verifier, row.code_challenge)) return bad(res, 'invalid_grant', 'code_verifier no coincide con code_challenge');

  // Emisión.
  const accessRaw = randomToken(32);
  const refreshRaw = randomToken(32);
  const { expiresIn } = await createAccessToken({
    token: accessRaw, clientId: client_id, userId: row.user_id,
    scope: row.scope, resource: row.resource, ttlSeconds: ACCESS_TTL_SECONDS,
  });
  await createRefreshToken({
    token: refreshRaw, clientId: client_id, userId: row.user_id,
    scope: row.scope, resource: row.resource, ttlSeconds: REFRESH_TTL_SECONDS,
  });

  console.log(`[oauth] token issued grant=code client=${client_id} user=${row.user_id} scope=${row.scope || '-'}`);

  res.json({
    access_token: accessRaw,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: refreshRaw,
    scope: row.scope || undefined,
  });
}

async function handleRefresh(req, res, p) {
  const { refresh_token, client_id } = p;
  if (!refresh_token || !client_id) return bad(res, 'invalid_request', 'refresh_token y client_id son requeridos');

  const client = await getClient(client_id);
  if (!client) return bad(res, 'invalid_client', 'client_id desconocido', 401);

  const row = await getRefreshToken(refresh_token);
  if (!row) return bad(res, 'invalid_grant', 'refresh_token desconocido');
  if (row.client_id !== client_id) return bad(res, 'invalid_grant', 'client_id no coincide');
  if (row.revoked_at) return bad(res, 'invalid_grant', 'refresh_token revocado');
  if (new Date(row.expires_at) < new Date()) return bad(res, 'invalid_grant', 'refresh_token expirado');

  // Rotación: emitir nuevos y revocar el viejo.
  const accessRaw = randomToken(32);
  const newRefreshRaw = randomToken(32);
  const { expiresIn } = await createAccessToken({
    token: accessRaw, clientId: client_id, userId: row.user_id,
    scope: row.scope, resource: row.resource, ttlSeconds: ACCESS_TTL_SECONDS,
  });
  await createRefreshToken({
    token: newRefreshRaw, clientId: client_id, userId: row.user_id,
    scope: row.scope, resource: row.resource, ttlSeconds: REFRESH_TTL_SECONDS,
  });
  await rotateRefreshToken(refresh_token, newRefreshRaw);

  console.log(`[oauth] token refreshed client=${client_id} user=${row.user_id}`);

  res.json({
    access_token: accessRaw,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token: newRefreshRaw,
    scope: row.scope || undefined,
  });
}
