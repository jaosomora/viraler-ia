// api/mcp/server.js
// Factory: arma un McpServer fresco para un request, ligado al usuario autenticado.
// Stateless: no compartimos instancia entre requests (cero estado en memoria).
// Filtra tools según los scopes OAuth concedidos al token actual.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as listMyTranscriptions from './tools/listMyTranscriptions.js';
import * as transcribeVideoUrl from './tools/transcribeVideoUrl.js';
import * as getTranscription from './tools/getTranscription.js';
import * as analyzeIdeas from './tools/analyzeIdeas.js';

// Catálogo de tools. requiredScope opcional: si no está, la tool aparece siempre
// (asumimos read-only y sin efectos). Si está, solo se registra cuando el token
// tiene ese scope concedido.
const TOOLS = {
  list_my_transcriptions: { ...listMyTranscriptions, requiredScope: listMyTranscriptions.requiredScope || 'transcribe:read' },
  transcribe_video_url:   { ...transcribeVideoUrl },
  get_transcription:      { ...getTranscription },
  analyze_ideas:          { ...analyzeIdeas },
};

export function buildServerForUser(user, grantedScopes = []) {
  const server = new McpServer(
    {
      name: 'as-tools',
      version: '0.1.0',
      title: 'Algo Sentido Tools',
    },
    {
      capabilities: { tools: {} },
      instructions:
        'AS Tools expone herramientas de transcripción de video y análisis de ideas. ' +
        'Las herramientas operan bajo la cuenta del usuario autenticado vía OAuth — todos los ids ' +
        'devueltos pertenecen al usuario y solo él puede leerlos. ' +
        'Flujo típico: 1) transcribe_video_url(url) → devuelve id; 2) get_transcription(id) para leer; 3) analyze_ideas(id) para extraer estructura replicable.',
    }
  );

  const granted = new Set(grantedScopes);

  for (const [name, tool] of Object.entries(TOOLS)) {
    if (tool.requiredScope && !granted.has(tool.requiredScope)) {
      continue; // tool oculta si el token no tiene el scope necesario
    }
    server.registerTool(name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }, tool.makeHandler(user));
  }

  return server;
}
