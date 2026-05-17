// api/mcp/server.js
// Factory: arma un McpServer fresco para un request, ligado al usuario autenticado.
// Stateless: no compartimos instancia entre requests (cero estado en memoria).
// Filtra tools según los scopes OAuth concedidos al token actual.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as listMyTranscriptions from './tools/listMyTranscriptions.js';
import * as transcribeVideoUrl from './tools/transcribeVideoUrl.js';
import * as getTranscription from './tools/getTranscription.js';
import * as analyzeIdeas from './tools/analyzeIdeas.js';
import * as buildIdeaMap from './tools/buildIdeaMap.js';
import { checkQuota, logToolCall } from './audit.js';

// Catálogo de tools. requiredScope opcional: si no está, la tool aparece siempre
// (asumimos read-only y sin efectos). Si está, solo se registra cuando el token
// tiene ese scope concedido.
const TOOLS = {
  list_my_transcriptions: { ...listMyTranscriptions, requiredScope: listMyTranscriptions.requiredScope || 'transcribe:read' },
  transcribe_video_url:   { ...transcribeVideoUrl },
  get_transcription:      { ...getTranscription },
  analyze_ideas:          { ...analyzeIdeas },
  build_idea_map:         { ...buildIdeaMap },
};

// Wrappea el handler de una tool con:
// 1) Chequeo de cuota (para tools que cuestan dinero) → 429-like error si excede.
// 2) Audit log: registra cada call (exitoso o no) en mcp_audit_log.
// 3) Extrae cost_usd del structuredContent si la tool lo expone para sumarlo al log.
function wrapHandler(toolName, user, clientId, rawHandler) {
  return async (args, extra) => {
    // 1) Quota
    try {
      const q = await checkQuota(user, toolName);
      if (!q.allowed) {
        logToolCall({
          userId: user.id, clientId, toolName, args,
          success: false, errorMessage: `quota_exceeded: ${q.reason}`,
          durationMs: 0, costUsd: 0,
        });
        return {
          content: [{ type: 'text', text: q.reason }],
          isError: true,
        };
      }
    } catch (e) {
      console.error(`[mcp] quota check failed for ${toolName}:`, e.message);
      // No bloqueamos al usuario por un error de cuota — solo logueamos.
    }

    // 2) Ejecutar + medir
    const start = Date.now();
    let result;
    let success = true;
    let errorMessage = null;
    try {
      result = await rawHandler(args, extra);
      if (result?.isError) {
        success = false;
        // Extraer texto del primer content item como mensaje de error.
        const errText = result.content?.[0]?.text;
        if (typeof errText === 'string') errorMessage = errText.slice(0, 300);
      }
    } catch (e) {
      success = false;
      errorMessage = e.message?.slice(0, 300) || 'unknown error';
      // Re-throw para que el transport responda con JSON-RPC error.
      logToolCall({ userId: user.id, clientId, toolName, args, success: false, errorMessage, durationMs: Date.now() - start, costUsd: 0 });
      throw e;
    }

    const costUsd = result?.structuredContent?.cost_usd || 0;
    logToolCall({
      userId: user.id, clientId, toolName, args,
      success, errorMessage,
      durationMs: Date.now() - start, costUsd,
    });

    return result;
  };
}

export function buildServerForUser(user, grantedScopes = [], clientId = null) {
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
        'Flujo típico: 1) transcribe_video_url(url) → devuelve id; 2) get_transcription(id) para leer; 3) analyze_ideas(id) para extraer estructura replicable. ' +
        'build_idea_map permite al usuario generar ideas propias desde un mapa de contraste (compuerta + cruces).',
    }
  );

  const granted = new Set(grantedScopes);

  for (const [name, tool] of Object.entries(TOOLS)) {
    if (tool.requiredScope && !granted.has(tool.requiredScope)) {
      continue; // tool oculta si el token no tiene el scope necesario
    }
    const rawHandler = tool.makeHandler(user);
    const wrapped = wrapHandler(name, user, clientId, rawHandler);
    server.registerTool(name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }, wrapped);
  }

  return server;
}
