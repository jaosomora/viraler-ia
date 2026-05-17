// api/mcp/routes.js
// POST /mcp — endpoint Streamable HTTP. Stateless: server + transport nuevos por request.
// GET/DELETE devuelven 405 en stateless mode (no hay sesión que reanudar/cerrar).

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { buildServerForUser } from './server.js';
import { getMcpGloballyDisabled, isUserMcpDisabled } from './audit.js';

export async function mcpPost(req, res) {
  // req.user lo setea mcpAuthMiddleware (OAuth Bearer validator).
  const user = req.user;
  if (!user) {
    return res.status(500).json({ error: 'server_error', error_description: 'auth no resuelta' });
  }

  // Toggle global de emergencia: el owner puede apagar el MCP entero desde el admin.
  try {
    if (await getMcpGloballyDisabled()) {
      return res.status(503).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'MCP server temporalmente desactivado. Contacta al administrador.' },
        id: null,
      });
    }
  } catch (e) { console.error('[mcp] global toggle check failed:', e.message); }

  // Disable por-usuario: el owner puede apagar el MCP a un cliente específico.
  try {
    if (await isUserMcpDisabled(user)) {
      return res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Tu acceso al MCP está desactivado. Contacta al administrador.' },
        id: null,
      });
    }
  } catch (e) { console.error('[mcp] user disabled check failed:', e.message); }

  let server;
  let transport;
  try {
    const scope = req.oauth?.scope || '';
    const grantedScopes = scope.split(/\s+/).filter(Boolean);
    const clientId = req.oauth?.clientId || null;
    server = buildServerForUser(user, grantedScopes, clientId);
    transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
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
