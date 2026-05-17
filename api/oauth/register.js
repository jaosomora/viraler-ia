// api/oauth/register.js
// RFC 7591 — Dynamic Client Registration.
// Claude.ai (y cualquier otro cliente MCP) llama esto sin credenciales para auto-registrarse.
// Devolvemos un client_id público (sin secret, PKCE-only). Esto es lo estándar para MCP.

import crypto from 'crypto';
import { createClient } from './storage.js';

function isValidHttpsUrl(u) {
  try {
    const url = new URL(u);
    // Permitir http en localhost para desarrollo local del cliente.
    if (url.protocol === 'https:') return true;
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return true;
    return false;
  } catch { return false; }
}

export async function registerClient(req, res) {
  const body = req.body || {};
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];

  if (redirectUris.length === 0) {
    return res.status(400).json({
      error: 'invalid_redirect_uri',
      error_description: 'redirect_uris es requerido y debe contener al menos una URL'
    });
  }
  for (const u of redirectUris) {
    if (typeof u !== 'string' || !isValidHttpsUrl(u)) {
      return res.status(400).json({
        error: 'invalid_redirect_uri',
        error_description: `redirect_uri inválida: ${u}. Debe ser HTTPS (o http://localhost).`
      });
    }
  }

  // Validación liviana de campos opcionales.
  const clientName = typeof body.client_name === 'string' ? body.client_name.slice(0, 200) : null;
  const authMethod = body.token_endpoint_auth_method === 'client_secret_post' ? 'client_secret_post' : 'none';

  const clientId = `mcp_${crypto.randomBytes(16).toString('hex')}`;

  try {
    await createClient({
      clientId,
      clientSecretHash: null, // Cliente público (PKCE-only). MCP no necesita secret.
      clientName,
      redirectUris,
      tokenEndpointAuthMethod: authMethod,
    });
  } catch (err) {
    console.error('[oauth] register failed', err.message);
    return res.status(500).json({ error: 'server_error', error_description: 'No se pudo registrar el cliente' });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  console.log(`[oauth] client registered client_id=${clientId} name=${clientName || '?'} redirect_uris=${redirectUris.length}`);

  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: issuedAt,
    client_name: clientName,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: authMethod,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  });
}
