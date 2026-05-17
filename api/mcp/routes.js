// api/mcp/routes.js
// POST /mcp — endpoint Streamable HTTP. Stateless: server + transport nuevos por request.
// GET/DELETE devuelven 405 en stateless mode (no hay sesión que reanudar/cerrar).

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServerForUser } from './server.js';

export async function mcpPost(req, res) {
  // req.user lo setea mcpAuthMiddleware (OAuth Bearer validator).
  const user = req.user;
  if (!user) {
    return res.status(500).json({ error: 'server_error', error_description: 'auth no resuelta' });
  }

  let server;
  let transport;
  try {
    const scope = req.oauth?.scope || '';
    const grantedScopes = scope.split(/\s+/).filter(Boolean);
    server = buildServerForUser(user, grantedScopes);
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    // Cleanup cuando el response cierre — evita leaks aunque el SDK ya hace lo suyo.
    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error('[mcp] handleRequest error', err.message);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

export function mcpMethodNotAllowed(req, res) {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed (stateless transport: solo POST)' },
    id: null,
  });
}
