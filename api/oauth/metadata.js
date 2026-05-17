// api/oauth/metadata.js
// Discovery endpoints que Claude.ai usa para encontrar nuestro authorization server
// y saber qué endpoints invocar. Spec: RFC 9728 + RFC 8414.
//
// El cliente MCP descubre así:
//   1. POST /mcp sin token → 401 con WWW-Authenticate: Bearer resource_metadata="<url PR>"
//   2. GET  /.well-known/oauth-protected-resource → encuentra el authorization_server
//   3. GET  /.well-known/oauth-authorization-server → endpoints (authorize, token, register)
//   4. Inicia flujo PKCE.

// Base pública del servicio. Cuando esté el subdominio: MCP_BASE_URL=https://tools.algosentido.com
// En dev: http://localhost:3000.
function baseUrl(req) {
  const fromEnv = process.env.MCP_BASE_URL || process.env.APP_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Fallback: derivar del request (útil en dev). Honra X-Forwarded-* si está detrás de proxy.
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

// RFC 9728 — Protected Resource Metadata.
// Le dice al cliente "yo soy el recurso (/mcp), y mi authorization server vive en X".
export function protectedResourceMetadata(req, res) {
  const base = baseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ['transcribe:read', 'transcribe:write', 'analyze:write'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${base}/`,
  });
}

// RFC 8414 — Authorization Server Metadata.
export function authorizationServerMetadata(req, res) {
  const base = baseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
    scopes_supported: ['transcribe:read', 'transcribe:write', 'analyze:write'],
    service_documentation: `${base}/`,
  });
}
