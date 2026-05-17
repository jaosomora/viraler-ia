// api/oauth/validator.js
// Middleware Bearer para el endpoint /mcp. Resuelve token → usuario de AS Tools.
// Si falta token o es inválido, responde 401 con WWW-Authenticate apuntando al
// Protected Resource Metadata para que el cliente arranque el flujo OAuth (RFC 9728).

import db from '../database/schema.js';
import { getAccessToken, touchAccessToken, revokeAccessToken } from './storage.js';

function metadataUrl(req) {
  const fromEnv = process.env.MCP_BASE_URL || process.env.APP_BASE_URL;
  if (fromEnv) return `${fromEnv.replace(/\/$/, '')}/.well-known/oauth-protected-resource`;
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/.well-known/oauth-protected-resource`;
}

function challenge(req, error, description) {
  const parts = [`Bearer resource_metadata="${metadataUrl(req)}"`];
  if (error) parts.push(`error="${error}"`);
  if (description) parts.push(`error_description="${description}"`);
  return parts.join(', ');
}

function isAccessExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

export function mcpAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.set('WWW-Authenticate', challenge(req));
    return res.status(401).json({ error: 'invalid_token', error_description: 'Bearer token requerido' });
  }

  const rawToken = header.slice(7).trim();

  getAccessToken(rawToken)
    .then((row) => {
      if (!row) {
        res.set('WWW-Authenticate', challenge(req, 'invalid_token', 'Token desconocido'));
        return res.status(401).json({ error: 'invalid_token' });
      }
      if (row.revoked_at) {
        res.set('WWW-Authenticate', challenge(req, 'invalid_token', 'Token revocado'));
        return res.status(401).json({ error: 'invalid_token' });
      }
      if (new Date(row.expires_at) < new Date()) {
        res.set('WWW-Authenticate', challenge(req, 'invalid_token', 'Token expirado'));
        return res.status(401).json({ error: 'invalid_token' });
      }

      // Resolver usuario y verificar acceso temporal (reusa la regla del authMiddleware existente).
      db.get('SELECT id, name, email, role, access_expires_at FROM users WHERE id = ?', [row.user_id], (err, user) => {
        if (err) return res.status(500).json({ error: 'server_error' });
        if (!user) {
          // Token huérfano (usuario borrado). Revocar y rechazar.
          revokeAccessToken(rawToken);
          res.set('WWW-Authenticate', challenge(req, 'invalid_token', 'Usuario no encontrado'));
          return res.status(401).json({ error: 'invalid_token' });
        }
        if (user.role !== 'owner' && isAccessExpired(user.access_expires_at)) {
          res.set('WWW-Authenticate', challenge(req, 'invalid_token', 'Acceso a la herramienta expirado'));
          return res.status(403).json({ error: 'access_denied', error_description: 'Tu acceso a AS Tools expiró' });
        }

        touchAccessToken(rawToken);
        req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        req.oauth = { clientId: row.client_id, scope: row.scope, resource: row.resource };
        next();
      });
    })
    .catch((err) => {
      console.error('[oauth] validator error', err.message);
      res.status(500).json({ error: 'server_error' });
    });
}
