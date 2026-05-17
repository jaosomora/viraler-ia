Excelente. Tengo ahora suficiente información para crear una investigación exhaustiva. Voy a organizarla en un documento estructurado.

---

# INVESTIGACIÓN EXHAUSTIVA: CÓMO CONSTRUIR Y DESPLEGAR UN SERVIDOR MCP PARA AS TOOLS

## TABLA DE CONTENIDOS

1. [Qué es MCP hoy (2026) y Transport Soportados](#1-qué-es-mcp-hoy-2026-y-transports-soportados)
2. [Cómo se Conectan Clientes Finales desde Claude](#2-cómo-se-conectan-clientes-finales-desde-claude)
3. [Autenticación Multi-Tenant: OAuth vs JWT vs API Keys](#3-autenticación-multi-tenant-oauth-vs-jwt-vs-api-keys)
4. [SDKs Recomendados para Node/TypeScript](#4-sdks-recomendados-para-nodetypescript)
5. [Arquitectura Recomendada para AS Tools](#5-arquitectura-recomendada-para-as-tools)
6. [Diseño de Tools: Granularidad y Patrones](#6-diseño-de-tools-granularidad-y-patrones)
7. [Opciones de Deploy](#7-opciones-de-deploy)
8. [Seguridad: Rate Limiting, Scopes y Límites de Costos](#8-seguridad-rate-limiting-scopes-y-límites-de-costos)
9. [MVP: Camino de Menor Resistencia](#9-mvp-camino-de-menor-resistencia)
10. [Riesgos y Gotchas Conocidos](#10-riesgos-y-gotchas-conocidos)

---

## 1. QUÉ ES MCP HOY (2026) Y TRANSPORTS SOPORTADOS

### Definición de MCP

MCP (Model Context Protocol) es un **estándar abierto** que actúa como "USB-C para aplicaciones de IA". Permite que clientes de IA (Claude, ChatGPT, VSCode, Cursor, etc.) se conecten a servidores remotos que exponen:

- **Tools** (herramientas/funciones llamables por el LLM)
- **Resources** (datos/archivos que el LLM puede leer)
- **Prompts** (templates pre-escritos)

El protocolo está mantenido por Anthropic y es una especificación abierta con amplio soporte en la industria (OpenAI, Google, Microsoft, AWS, Cloudflare, etc.).

**Último estado de la especificación:** `v2025-11-25` (noviembre 2025), con cambios significativos en autenticación, transports y manejo de operaciones de larga duración.

### Tipos de Transport Soportados

MCP soporta tres transports principales:

#### **1. STDIO (Deprecated para Remote, Activo para Local)**
- **Uso:** Servidores locales que corren en la misma máquina que el cliente
- **Mecanismo:** Comunicación via stdin/stdout
- **Ejemplo:** MCP servers integrados en Claude Desktop (instalados localmente)
- **No aplica a tu caso:** AS Tools es un servicio remoto accesible por múltiples clientes

#### **2. Streamable HTTP (RECOMENDADO PARA REMOTE)**
- **Introducido en:** Spec v2025-03-26, mejorado en v2025-11-25
- **Uso:** Servidores remotos accesibles via HTTPS
- **Mecanismo:** 
  - Clients envían JSON-RPC POST a `POST /` con `Content-Type: application/json`
  - Server responde con `application/json` (respuesta de corta duración) O `text/event-stream` (respuesta larga o server-initiated messages)
  - Session management via header `Mcp-Session-Id` (UUID asignado por el server, incluido por el cliente en subsecuentes requests)
- **Arquitectura:**
  - POST para client→server messages (initialize, call tools, etc.)
  - GET/DELETE para session teardown
  - SSE (Server-Sent Events) para server→client async messages (opcional pero útil para long-running tasks)
- **Ventajas:**
  - Compatible con proxies y load balancers estándar
  - No requiere WebSockets
  - Funciona detrás de CDNs (Cloudflare, etc.)
  - Compatible con serverless (Vercel, Cloudflare Workers, Firebase Functions)
- **Límites:**
  - SSE requiere keep-alive cada ~30s para evitar que proxies cierren la conexión
  - Inline responses limitadas a ~160 KB; para contenido más grande usa `returnAsResource: true` (hasta 5 MB)

#### **3. SSE (Deprecated a favor de Streamable HTTP)**
- **Estado:** Aún soportado pero NO recomendado para nuevos proyectos
- **Razón:** Streamable HTTP unifica POST + SSE en un patrón más robusto
- **No la uses:** A menos que tengas clientes antiguos que solo soporte SSE

### Standard Recomendado para Remote Servers

**Para un MCP remoto en 2026: Usa Streamable HTTP con OAuth 2.1**

Esto es el estándar de facto. El 81% de servidores MCP remotos en producción hoy usan OAuth 2.1 + Streamable HTTP.

---

## 2. CÓMO SE CONECTAN CLIENTES FINALES DESDE CLAUDE

### Dos Canales de Conexión: Claude Desktop vs Claude.ai Web

#### **A. Claude Desktop (Aplicación de Escritorio)**

**Instalación de un MCP Remoto:**

1. Usuario abre Settings → Connectors (o Extensions en versiones nuevas)
2. Hace clic en "Add custom connector" o "Add extension"
3. Introduce la URL del servidor MCP remoto: `https://mcp.astools.com`
4. Si hay OAuth, Claude Desktop abre navegador, user loguearse, y obtiene token
5. El servidor MCP queda conectado; herramientas aparecen en la sidebar

**Flujo OAuth en Claude Desktop:**
- Claude Desktop detecta respuesta `401 Unauthorized` + header `WWW-Authenticate: Bearer`
- Lee el `resource_metadata` URL del header
- Fetches protected resource metadata (CORS-required)
- Descubre authorization server (si es diferente del MCP server)
- Inicia flujo OAuth 2.1 (authorization code + PKCE)
- User grants consent en navegador
- Token se cachea localmente en Claude Desktop
- Subsecuentes requests incluyen `Authorization: Bearer <token>`

**Requisitos:**
- HTTPS (no HTTP)
- CORS configurado para permitir origen de Claude Desktop
- Servidor MCP reachable desde internet (Anthropic's cloud infrastructure accede)

#### **B. Claude.ai Web (Web app)**

**Instalación de Custom Connector (Plan Pro/Max/Team/Enterprise):**

1. User va a Settings → Customize → Connectors
2. Hace clic en "Add custom connector"
3. Introduce URL: `https://mcp.astools.com`
4. Opcionalmente: OAuth Client ID y Client Secret en "Advanced settings"
5. Claude.ai web conecta desde Anthropic's servers (no localhost)

**Diferencias vs Desktop:**
- Claudine.ai es una web app, no puede ejecutar código local
- Conexión viene desde Anthropic's infrastructure, no desde el navegador del usuario
- **CORS es crítico** porque las requests vienen de `https://claude.ai`
- El servidor debe tener HTTPS y estar publicly reachable

**Requisitos de Plan:**
- Custom Connectors disponible solo en Pro, Max, Team, Enterprise
- Free plan NO puede usar MCP remotos
- Team plan permite múltiples miembros compartir un MCP server

#### **Flujo Común a Ambos:**

```
Usuario → Claude (Desktop/Web)
         ↓
    Detecta 401 + WWW-Authenticate
         ↓
    Fetches /.well-known/oauth-protected-resource (GET, CORS required)
         ↓
    Lee: authorization_servers, scopes_supported
         ↓
    Fetches /.well-known/openid-configuration del auth server
         ↓
    Inicia OAuth code flow (PKCE mandatory)
         ↓
    User logs in / grants scopes
         ↓
    Claude recibe access_token
         ↓
    Subsecuentes MCP requests usan: Authorization: Bearer <access_token>
         ↓
    Server valida token (introspection o JWT verification)
         ↓
    Server retorna herramientas + datos del usuario autenticado
```

### Autenticación en Requests Posteriores

Una vez conectado, **cada request MCP incluye el token**:

```http
POST https://mcp.astools.com/ HTTP/1.1
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "transcribe_video",
    "arguments": {
      "url": "https://youtube.com/watch?v=..."
    }
  }
}
```

---

## 3. AUTENTICACIÓN MULTI-TENANT: OAUTH VS JWT VS API KEYS

Tu situación:
- Ya tienes JWT + bcrypt + magic links funcionando
- Cada usuario tiene su propia cuenta
- Quieres que clientes usen Claude para interactuar con SU cuenta en AS Tools

### Opción 1: OAuth 2.1 Nativo (Recomendado para "Correcto")

#### Arquitectura

Necesitarías un **Authorization Server separado** (o reutilizar auth existente si lo expones como OAuth):

```
┌─────────────────────────────────────┐
│  Authorization Server (OAuth)       │  ← Keycloak, Auth0, o custom
│  - /authorize                       │
│  - /token                           │
│  - /introspect                      │
│  - .well-known/openid-configuration │
└─────────────────────────────────────┘
           ↑                ↑
           │ (RFC 9728)     │ (token validation)
           │                │
      ┌────────────────────────────┐
      │  MCP Server (Streamable    │
      │  HTTP + OAuth middleware)  │
      │  - POST / (main endpoint)  │
      │  - /.well-known/...       │
      │  - Tools (valida tokens)  │
      └────────────────────────────┘
           ↑
           │ (Authorization: Bearer <token>)
           │
      ┌──────────────┐
      │ Claude       │ (Desktop / Web)
      │ (cliente)    │
      └──────────────┘
```

#### Ventajas de OAuth 2.1
- **Estándar de industria**: Funciona con cualquier cliente MCP (Claude, ChatGPT, VSCode, etc.)
- **Tokens corta duración**: Pueden expirar, no como API keys estáticas
- **Scopes granulares**: `mcp:tool:transcribe:read`, `mcp:tool:clips:write`, etc.
- **Token introspection**: Server puede revocar acceso inmediatamente
- **Compliance**: Requisito para enterprise (SOC 2, etc.)

#### Desventajas
- **Complejo de montar**: Necesitas un OAuth server (Keycloak, Auth0) o hackear uno propio
- **Más endpoints**: `.well-known/oauth-protected-resource`, `/authorize`, `/token`, `/introspect`
- **Curva de aprendizaje**: PKCE, Resource Indicators (RFC 8707), etc.

#### Implementación: Reusar JWT Existente

**Idea:** Tu JWT actual ya tiene claims del usuario. Podrías **exponer un endpoint OAuth que firme JWTs localmente**:

```typescript
// Dentro de tu auth server (o crear uno)
POST /mcp/token HTTP/1.1
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTH_CODE&client_id=CLAUDE_DESKTOP&redirect_uri=...

// Respuesta:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huQGV4YW1wbGUuY29tIiwic2NvcGUiOiJtY3A6dG9vbHMiLCJleHAiOjE3NTU2MjAwMDB9.xxx",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

Con esto, el servidor MCP valida el JWT como siempre:

```typescript
// En tu middleware MCP
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET); // Tu JWT existente
    req.user = decoded; // { id, email, sub, ... }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

---

### Opción 2: Bearer Token Simple con API Keys (MVP Más Rápido)

Para evitar la complejidad de OAuth, podrías usar **API keys estáticas** por usuario:

#### Arquitectura

```
User en Portal AS Tools
        ↓
    Genera API Key
        ↓
    Configura en Claude Desktop:
    Settings → Connectors → Advanced → "API Key: sk-xxx"
        ↓
    Cada request MCP include:
    Authorization: Bearer sk-xxx
        ↓
    Server lookup: key → user_id
    ↓ (solo si key es válida)
    Ejecuta tool bajo esa cuenta
```

#### Ventajas
- **MVP más rápido**: Solo 1-2 líneas de middleware
- **Sin OAuth complexity**: No necesitas `.well-known` ni flujos de authorization
- **Funciona con MCP**: Bearer auth es soportado por la spec

#### Desventajas
- **Tokens estáticos**: Si API key se filtra, acceso permanente
- **Sin refresh**: Keys no expiran automáticamente
- **No estándar OAuth**: Menos "correcto" para enterprise
- **Claude Desktop requiere manual copy-paste**: No hay flujo OAuth visual

#### Implementación Rápida

```typescript
// api/mcp/auth-middleware.ts
export const mcpBearerAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  
  const apiKey = auth.slice(7);
  const user = db.users.findByApiKey(apiKey);
  if (!user) {
    return res.status(403).json({ error: 'Invalid API key' });
  }
  
  req.user = user;
  next();
};
```

---

### Opción 3: Híbrida (Recomendado para AS Tools)

**La mejor opción para tu caso**: 

1. **Mantén JWT para auth web (login/magic link)**
2. **Expone un OAuth minimal** que:
   - User inicia OAuth en Claude Desktop
   - Se redirige a tu login existente (o pre-logueado)
   - Genera un JWT con scope `mcp:tools`
   - Claude Desktop crea sesión usando ese JWT
3. **Server MCP valida JWT** como siempre, extrae `user_id` y ejecuta herramientas bajo esa cuenta

**Ventaja:** Reutiliza infraestructura existente, sigue el estándar OAuth, no requiere nuevas herramientas.

```typescript
// En tu servidor (Express actual)

// 1. Endpoint OAuth (discovery)
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'https://api.astools.com/mcp',
    authorization_servers: ['https://api.astools.com'], // Tu auth server
    scopes_supported: ['mcp:tools', 'mcp:tools:transcribe', 'mcp:tools:clips']
  });
});

// 2. Endpoint OAuth /authorize
app.get('/oauth/authorize', (req, res) => {
  const { client_id, redirect_uri, scope, code_challenge } = req.query;
  // Si usuario NO está logueado: redirige a /login
  // Si está logueado: muestra pantalla de consentimiento
  // Si consiente: genera code + guarda code_challenge para PKCE
});

// 3. Endpoint /token (intercambia code por JWT)
app.post('/oauth/token', (req, res) => {
  const { code, client_id, code_verifier } = req.body;
  // Valida code + PKCE
  // Genera JWT con scope
  res.json({
    access_token: jwt.sign(
      { user_id, scope: 'mcp:tools' },
      JWT_SECRET,
      { expiresIn: '1h' }
    ),
    token_type: 'Bearer',
    expires_in: 3600
  });
});

// 4. MCP Streamable HTTP endpoint
app.post('/mcp', mcpAuthMiddleware, mcpHandler);
```

---

## 4. SDKS RECOMENDADOS PARA NODE/TYPESCRIPT

### SDK Oficial: `@modelcontextprotocol/sdk`

**Instalación:**
```bash
npm install @modelcontextprotocol/sdk
```

**Paquetes principales:**
- `@modelcontextprotocol/sdk` (core, ~600KB, esencial)
  - `McpServer` (clase principal del servidor)
  - `StreamableHTTPServerTransport` (maneja Streamable HTTP)
  - Types (`Tool`, `Resource`, `Prompt`, `Request`, etc.)
- `@modelcontextprotocol/sdk/server/auth` (OAuth + auth helpers)
  - `mcpAuthMetadataRouter` (expone .well-known endpoints)
  - `requireBearerAuth` (middleware para validar tokens)
  - OAuth verifiers

**Versión actual:** ~1.29.0+ (nov 2025)

**Size en production:** ~2.5 MB (con dependencies, minified)

### Ejemplo Mínimo

```typescript
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const app = express();
app.use(express.json());

// Cache de transports por session
const transports: Record<string, StreamableHTTPServerTransport> = {};

// MCP Server instance
const createMcpServer = () => {
  const server = new McpServer({
    name: 'as-tools-mcp',
    version: '1.0.0'
  });

  // Registra un tool
  server.registerTool(
    'transcribe_video',
    {
      title: 'Transcribe Video',
      description: 'Extrae transcripción de un video (YouTube, TikTok, IG, FB)',
      inputSchema: {
        url: z.string().describe('URL del video'),
        language: z.string().optional().describe('ISO 639-1 code, ej. "es", "en"')
      }
    },
    async ({ url, language }, _extras) => {
      // Llama tu endpoint /api/transcriptions POST
      const transcript = await fetch('https://api.astools.com/api/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, language })
      }).then(r => r.json());
      
      return {
        content: [
          { type: 'text', text: transcript.text }
        ]
      };
    }
  );

  return server;
};

// MCP POST endpoint
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Si es initialize (sin sessionId)
  if (!sessionId && req.body.method === 'initialize') {
    const newSessionId = crypto.randomUUID();
    const transport = new StreamableHTTPServerTransport();
    transports[newSessionId] = transport;

    // Crea server y conecta al transport
    const server = createMcpServer();
    await server.connect(transport);

    // Maneja el request inicial
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // Si hay sessionId existente
  if (sessionId && transports[sessionId]) {
    const transport = transports[sessionId];
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: 'Invalid session' });
});

app.listen(3000);
```

### Alternativas Menores

- **FastMCP (Python)**: Para si algún día necesitas Python. Tiene helpers para OAuth.
- **MCP SDK en C# / Go**: Menos maduros, no recomendados para MVP.

**Recomendación:** Usa `@modelcontextprotocol/sdk` de TypeScript. Es el más maduro y está mantenido por Anthropic directamente.

---

## 5. ARQUITECTURA RECOMENDADA PARA AS TOOLS

### Opción A: MCP Separado en Mismo Proceso Express (Recomendado)

Agrega un nuevo "submódulo" dentro de tu Express actual:

```
server.js
├── api/
│   ├── transcribir/
│   ├── clips/
│   ├── reels/
│   └── ... (endpoints REST existentes)
├── mcp/                    ← NUEVO
│   ├── server.ts          (McpServer + tools registry)
│   ├── auth.ts            (authMiddleware + OAuth endpoints)
│   ├── router.ts          (POST /mcp + .well-known endpoints)
│   └── tools/             (tool implementations)
│       ├── transcribe.ts
│       ├── clips.ts
│       ├── reels.ts
│       └── secrets.ts
└── server.js              (Express entry point, monta /mcp)
```

**Ventajas:**
- Un solo servidor Node.js
- Reutiliza BD, auth, y servicios existentes
- Deploy simplificado (mismo Dockerfile)
- No duplicas infraestructura

**Desventajas:**
- Si el MCP server se cuelga, cuelga todo Express
- Manage state compartido más complejo

**Implementación:**

```typescript
// server.js (Express actual)
import mcpRouter from './mcp/router.js';

const app = express();

// Rutas REST existentes
app.use('/api', apiRouter);

// NUEVO: Rutas MCP
app.use(mcpRouter); // Monta POST /mcp, GET /.well-known/...

app.listen(3000);
```

```typescript
// mcp/router.ts
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import mcpServer from './server.js';
import mcpAuthMiddleware from './auth.js';

const router = express.Router();

// Session management
const transports: Record<string, StreamableHTTPServerTransport> = {};

// POST /mcp
router.post('/mcp', mcpAuthMiddleware, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId && req.body.method === 'initialize') {
    const newSessionId = crypto.randomUUID();
    const transport = new StreamableHTTPServerTransport();
    transports[newSessionId] = transport;

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: 'Invalid session' });
});

// OAuth endpoints
router.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'https://api.astools.com/mcp',
    authorization_servers: ['https://api.astools.com'],
    scopes_supported: ['mcp:tools']
  });
});

// ... otros .well-known endpoints ...

export default router;
```

### Opción B: MCP Separado (Microservicio)

Si quieres segregación:

```
┌──────────────────┐
│   AS Tools REST  │ (Express actual)
│   /api/*         │
│   Puerto 3000    │
└──────────────────┘

┌──────────────────┐
│   AS Tools MCP   │ ← Servidor MCP separado
│   /mcp           │   (Node.js + SDK)
│   Puerto 3001    │
└──────────────────┘
      ↓ (hace requests HTTP)
    /api/* (localhost:3000)
```

**Ventajas:**
- Escalado independiente
- Menos riesgo de crash cruzado

**Desventajas:**
- Más complejidad operacional
- Requiere two-tier deploy (Dockerfile x2)
- Latency extra entre servicios

**Recomendación para MVP:** Opción A (mismo proceso). Es más simple y tu carga inicial no necesita segregación.

---

## 6. DISEÑO DE TOOLS: GRANULARIDAD Y PATRONES

### Cuántos Tools Exponer

**Recomendación:** Comienza con 4-6 tools principais, expande después.

Para AS Tools:
```
1. transcribe_video         → POST /api/transcriptions
2. list_transcriptions      → GET /api/transcriptions (paginado)
3. analyze_video_ideas      → POST /api/transcriptions/:id/analyze
4. create_clips             → POST /api/clips
5. create_reel              → POST /api/reels
6. create_secret            → POST /api/secrets
7. reveal_secret            → GET /api/secrets/:token (decrypted)
8. convert_document         → POST /api/convert
```

**No expongas:**
- `update_transcription_metadata` (demasiado granular)
- `delete_transcription` (arriesgado, no lo necesita Claude)
- `admin_reset_database` (security risk)

### Estructura de Tool Definition

```typescript
server.registerTool(
  'transcribe_video',                    // Tool name (lowercase_snake_case)
  {
    title: 'Transcribe Video',           // Human-readable
    description: 'Extrae transcripción de videos de YouTube, TikTok, Instagram Reels, Facebook. Retorna texto con timestamps de palabras.',
    inputSchema: {                        // Zod or JSON Schema
      url: z.string()
        .url()
        .describe('URL del video (YouTube, TikTok, Instagram, Facebook)'),
      language: z.enum(['es', 'en', 'fr', 'de'])
        .optional()
        .default('es')
        .describe('Idioma detectado automáticamente; opcionalmente especifica "es" para español'),
      analyze_ideas: z.boolean()
        .optional()
        .describe('Si true, analiza automáticamente ideas dentro del video (costo +$0.002)')
    }
  },
  async ({ url, language, analyze_ideas }, extras) => {
    // extras contiene: {
    //   client: { protocol: '2025-11-25', name: 'Claude Desktop', version: '...' },
    //   request?: { ... }  // Only si MCP server supports it
    // }
    
    // Implementación
    const result = await fetch('https://api.astools.com/api/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${req.user.jwt}`, // Pasa JWT del usuario
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, language, analyze_ideas })
    }).then(r => r.json());

    return {
      content: [
        {
          type: 'text',
          text: `Transcripción completada. ${result.word_count} palabras, ${result.duration_seconds}s.\n\n${result.text}`
        }
      ],
      // Opcional: si quieres que Claude pueda hacer clic en un link
      // (o si el resultado es muy grande, usa returnAsResource)
    };
  }
);
```

### Manejo de Operaciones de Larga Duración

**Problema:** Transcribir un video toma 30-60s. HTTP tiene timeout de 30s. ¿Qué haces?

**Solución: MCP Tasks (Spec v2025-11-25)**

```typescript
server.registerTool(
  'transcribe_video',
  { ... },
  async (args, extras) => {
    // Retorna una Task en lugar de resultado inmediato
    const taskId = await submitTranscriptionJob(args.url);
    
    return {
      type: 'task',
      task_id: taskId,
      status: 'queued',
      message: `Transcripción encolada. Job ID: ${taskId}`
    };
  }
);

// Luego Claude puede polling:
server.registerTool(
  'get_transcription_status',
  {
    description: 'Obtiene estado de un job de transcripción',
    inputSchema: {
      job_id: z.string().describe('ID del job retornado por transcribe_video')
    }
  },
  async ({ job_id }) => {
    const status = await getJobStatus(job_id);
    return {
      content: [{ type: 'text', text: JSON.stringify(status) }]
    };
  }
);
```

**Alternativa más simple (MVP):** Retorna un status code 202 + URL para polling:

```typescript
return {
  content: [
    {
      type: 'text',
      text: `Transcripción en progreso. Verifica estado en: https://api.astools.com/transcriptions/${transcriptionId}\n\nVuelve a llamar "get_transcription_status" con ID: ${transcriptionId}`
    }
  ]
};
```

### Descripciones que Claude Entienda

**Mala:**
```
"Crea un clip"
```

**Buena:**
```
"Crea un clip vertical (9:16) apto para Instagram Reels / TikTok a partir de una transcripción existente. 
Especifica rango de tiempo (ej: 0:30-1:45) y se generará automáticamente con subs, música y colores. 
Nota: El usuario debe previamente haber transcrito un video con la herramienta 'transcribe_video'."
```

**Claves:**
1. Explica qué outputs espera
2. Menciona pre-requisitos (ej: "requiere transcripción previa")
3. Rango típico de valores
4. Costos si aplican
5. Tiempo de ejecución si es > 5s

### Estructura de Respuesta

Siempre usa `{ content: [{ type, ... }] }`:

```typescript
// ✅ Correcto
return {
  content: [
    {
      type: 'text',
      text: 'Resultado aquí'
    }
  ]
};

// ❌ Incorrecto (MCP spec requiere content array)
return {
  text: 'Resultado'
};
```

---

## 7. OPCIONES DE DEPLOY

### Matriz de Opciones

| Plataforma | Cold Start | CORS | Stateless | Long-lived Connections | Precio | Recomendación |
|------------|-----------|------|-----------|------------------------|--------|---|
| **Render** (current) | 5-10s | ✅ | ✅ | ✅ SSE OK | $12-50/mo | ✅ MEJOR para MVP |
| Cloudflare Workers | <50ms | ✅ | ✅ | ❌ No | $5+/mo | ✅ Alternativa |
| Vercel Functions | 1-3s | ✅ | ✅ | ⚠️ 60s max | $0-20/mo | Bueno si ya usan |
| Firebase Functions | 2-5s | ⚠️ Manual | ✅ | ❌ 9min timeout | $0-15/mo | No recomendado |
| Heroku | 5-30s | ✅ | ✅ | ✅ | $50+/mo | Caro, deprecado |
| Propio VPS | ~0 | ✅ | ✅ | ✅ | $10-50/mo | Si sabes ops |

### Opción 1: Render (Recomendado para AS Tools)

**Ya tienes deploy en Render. Amplía el mismo.**

```dockerfile
# Dockerfile actual (modifica solo si es necesario)
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

**Cambios:**
1. Agrega endpoints MCP (`/mcp`, `/.well-known/*`) a tu Express
2. No necesitas cambios de infra; Render ya maneja Streamable HTTP (es HTTP estándar)

**Ventajas:**
- Ya tienes experiencia + infra lista
- SQLite ya está en `/opt/data`
- Docker ya configurado
- No duplicas deploy

**Consideración:** Render cierra WebSocket/SSE después de 55 minutos de inactividad. Para Streamable HTTP con keep-alive cada 30s, esto no es problema.

### Opción 2: Cloudflare Workers (MVP Más Rápido)

Si quieres experimentar sin docker:

```typescript
// wrangler.toml
name = "as-tools-mcp"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[env.production]]
routes = [
  { pattern = "https://mcp.astools.com/*", zone_name = "astools.com" }
]
```

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    if (request.method === 'POST' && new URL(request.url).pathname === '/mcp') {
      // MCP handler aquí
      // Cloudflare Workers mantiene sesiones en KV storage
      return handleMcpRequest(request);
    }
    
    // Proxy a tu servidor REST en Render
    return fetch(`https://api.astools.com${new URL(request.url).pathname}`, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
  }
};
```

**Ventajas:**
- Deploy con `wrangler deploy` (1 minuto)
- Near-zero cold start
- Free tier generoso (100k requests/día)

**Desventajas:**
- Session state más complejo (requiere Cloudflare KV)
- Menos control sobre database
- Más componentes para mantener

**Recomendación:** Usa esto como **experimento/POC**, no para producción. Render es mejor.

### Opción 3: Vercel Functions (Si usas Next.js)

Si algún día migras frontend a Next.js:

```typescript
// api/mcp.ts (Next.js API route)
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { NextApiRequest, NextApiResponse } from 'next';

let mcpServer: any;
const transports: Record<string, StreamableHTTPServerTransport> = {};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (!mcpServer) {
    mcpServer = createMcpServer(); // Tu server
  }

  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId && req.body?.method === 'initialize') {
    // ... handle new session
  }

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
  }
}
```

**Caveat:** Vercel Functions timeout después de 60s. OK para transcripción pero requiere async tasks.

---

## 8. SEGURIDAD: RATE LIMITING, SCOPES Y LÍMITES DE COSTOS

### Rate Limiting por Usuario

Implementa en tu middleware MCP:

```typescript
import { RateLimiterMemory } from 'rate-limiter-flexible';

// 10 requests por minuto por usuario
const rateLimiter = new RateLimiterMemory({
  points: 10,      // Requests
  duration: 60,    // Seconds
});

const mcpAuthMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const user = validateToken(token);
  
  try {
    await rateLimiter.consume(user.id, 1);
    req.user = user;
    next();
  } catch (err) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      retry_after_seconds: err.msBeforeNext / 1000
    });
  }
};
```

### Rate Limiting por Tool

Algunas herramientas son más caras:

```typescript
const toolLimits: Record<string, number> = {
  'transcribe_video': 20,      // 20/día por usuario
  'create_reel': 5,            // 5/día
  'analyze_ideas': 50,         // 50/día
  'create_clips': 10,          // 10/día
};

// En tool handler:
const remaining = await checkToolQuota(req.user.id, 'transcribe_video');
if (remaining <= 0) {
  throw new Error('Daily limit for transcribe_video exceeded');
}
```

### Scopes Granulares (OAuth)

Si usas OAuth, define scopes por herramienta:

```json
{
  "scopes_supported": [
    "mcp:tool:transcribe:read",
    "mcp:tool:clips:write",
    "mcp:tool:reels:write",
    "mcp:tool:secrets:write"
  ]
}
```

Valida en cada tool:

```typescript
const mcpAuthMiddleware = (req, res, next) => {
  const scopes = req.token?.scope?.split(' ') || [];
  
  // Attach verifier a req
  req.checkScope = (tool: string) => {
    const required = `mcp:tool:${tool}:read`;
    return scopes.includes(required);
  };
  
  next();
};

// En tool:
async (..., extras) => {
  if (!extras.request?.checkScope('transcribe')) {
    throw new Error('Insufficient permissions');
  }
  // ...
}
```

### Límites de Costos por Usuario

Tracka API calls + tokens consumidos:

```typescript
const trackApiCost = (userId: string, tool: string, costUsd: number) => {
  db.usage.insert({
    user_id: userId,
    tool,
    cost_usd: costUsd,
    timestamp: new Date()
  });
};

// Chequea límite mensual (ej: $10/mes)
const checkMonthlyBudget = (userId: string) => {
  const thisMonth = db.usage
    .filter(u => u.user_id === userId && isThisMonth(u.timestamp))
    .reduce((sum, u) => sum + u.cost_usd, 0);
  
  const limit = 10; // $10
  if (thisMonth > limit) {
    throw new Error(`Monthly budget exceeded: $${thisMonth} / $${limit}`);
  }
};
```

### Validación de Input

Previene abuse:

```typescript
const transcribeVideoSchema = z.object({
  url: z.string()
    .url()
    .regex(/^https:\/\/(youtube|instagram|tiktok|facebook)\.com/)
    .describe('Solo URLs válidas de plataformas soportadas'),
  duration_max_minutes: z.number()
    .max(30, 'Max 30 minutos permitidos')
    .optional()
});

// Valida
const { url, duration_max_minutes } = transcribeVideoSchema.parse(args);
```

### Logging y Auditoría

Registra cada llamada a tool:

```typescript
const logToolCall = (userId: string, tool: string, args: any, result: any, costUsd: number) => {
  db.tool_calls.insert({
    user_id: userId,
    tool_name: tool,
    input_args: JSON.stringify(args),
    output_result: result?.content?.[0]?.text?.slice(0, 500), // Primeros 500 chars
    cost_usd: costUsd,
    timestamp: new Date(),
    ip: req.ip,
    session_id: req.headers['mcp-session-id']
  });
};
```

---

## 9. MVP: CAMINO DE MENOR RESISTENCIA

### Objetivo MVP
Un usuario cliente de AS Tools puede conectar Claude Desktop a su cuenta y ejecutar "transcribe_video" + "list_transcriptions".

### Timeline: 1-2 Semanas

#### **Día 1-2: Setup Básico MCP**

1. Instala SDK:
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. Crea estructura:
   ```
   api/
   └── mcp/
       ├── server.ts         (McpServer instancia)
       ├── router.ts         (POST /mcp + .well-known)
       └── auth.ts           (Bearer token simple)
   ```

3. Implementa auth mínima (Bearer tokens):
   ```typescript
   // mcp/auth.ts
   export const mcpAuth = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     const user = jwt.verify(token, JWT_SECRET);
     req.user = user;
     next();
   };
   ```

#### **Día 3-4: Implementa 2 Tools**

1. `transcribe_video`:
   ```typescript
   server.registerTool('transcribe_video', {...}, async (args) => {
     const result = await fetch('/api/transcriptions', { ... });
     return { content: [{ type: 'text', text: result.text }] };
   });
   ```

2. `list_transcriptions`:
   ```typescript
   server.registerTool('list_transcriptions', {...}, async (args) => {
     const list = await fetch(`/api/transcriptions?limit=${args.limit}`, {...});
     return { content: [{ type: 'text', text: JSON.stringify(list) }] };
   });
   ```

#### **Día 5-6: OAuth Mínimo + .well-known**

Si usas Bearer simple, salta esto para MVP. Si quieres OAuth:

1. Agrega endpoint GET `/.well-known/oauth-protected-resource`:
   ```typescript
   app.get('/.well-known/oauth-protected-resource', (req, res) => {
     res.json({
       resource: 'https://api.astools.com/mcp',
       authorization_servers: ['https://api.astools.com'],
       scopes_supported: ['mcp:tools']
     });
   });
   ```

2. Agrega `/oauth/authorize` (redirige a /login si no está logueado)
3. Agrega `/oauth/token` (intercambia code por JWT)

#### **Día 7: Testing + Deploy**

1. Testa localmente con Claude Desktop:
   - Settings → Add custom connector → `http://localhost:3000`
   - Verifica que aparezcan tools en sidebar
   
2. Deploy a Render:
   ```bash
   git push
   # Render auto-redeploys
   ```

3. Testa desde Claude Desktop con URL pública:
   - Settings → Add custom connector → `https://api.astools.com`

#### **Día 8-10: Pulir**

- Agrega descrippciones mejores a tools
- Rate limiting básico
- Error handling
- CORS headers

### Código Mínimo (POC)

```typescript
// server.js (agregar a Express existente)
import mcpRouter from './api/mcp/router.js';

const app = express();
app.use(express.json());

// MCP
app.use(mcpRouter);

// REST existente
app.use('/api', apiRouter);

app.listen(3000);
```

```typescript
// api/mcp/router.ts
import express from 'express';
import mcpServer from './server.js';
import { mcpAuth } from './auth.js';
import crypto from 'crypto';

const router = express.Router();
const transports = {};

// POST /mcp
router.post('/mcp', mcpAuth, async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (!sessionId && req.body?.method === 'initialize') {
    const newSessionId = crypto.randomUUID();
    const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
    const transport = new StreamableHTTPServerTransport();
    transports[newSessionId] = transport;

    await mcpServer.connect(transport);
    res.setHeader('mcp-session-id', newSessionId);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  if (sessionId && transports[sessionId]) {
    await transports[sessionId].handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({ error: 'Bad request' });
});

// GET /.well-known/oauth-protected-resource
router.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'https://api.astools.com/mcp',
    authorization_servers: ['https://api.astools.com'],
    scopes_supported: ['mcp:tools']
  });
});

export default router;
```

```typescript
// api/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const mcpServer = new McpServer({
  name: 'as-tools-mcp',
  version: '1.0.0'
});

mcpServer.registerTool(
  'transcribe_video',
  {
    title: 'Transcribe Video',
    description: 'Extrae transcripción de un video de YouTube, TikTok, Instagram o Facebook',
    inputSchema: {
      url: z.string().url().describe('URL del video')
    }
  },
  async ({ url }) => {
    const response = await fetch('https://api.astools.com/api/transcriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await response.json();
    return {
      content: [{ type: 'text', text: data.text }]
    };
  }
);

mcpServer.registerTool(
  'list_transcriptions',
  {
    title: 'List Transcriptions',
    description: 'Lista tus transcripciones previas',
    inputSchema: {
      limit: z.number().default(10).describe('Cuántas transcripciones mostrar')
    }
  },
  async ({ limit }) => {
    const response = await fetch(`https://api.astools.com/api/transcriptions?limit=${limit}`);
    const data = await response.json();
    return {
      content: [{ type: 'text', text: JSON.stringify(data.transcriptions, null, 2) }]
    };
  }
);

export default mcpServer;
```

---

## 10. RIESGOS Y GOTCHAS CONOCIDOS

### 1. CORS: El Problema #1 en Producción

**Síntoma:** "Couldn't reach the MCP server" en Claude Desktop o Claude.ai

**Causa:** Tu servidor no devuelve headers CORS correctos para requests desde Anthropic's infrastructure.

**Fix:**

```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:3000',         // Local dev
    'https://claude.ai',
    'https://claude.com',
    'https://www.anthropic.com',
    'https://api.anthropic.com',
    /\.anthropic\.com$/               // Cualquier subdominio
  ],
  exposedHeaders: ['Mcp-Session-Id'],
  credentials: true
}));

// Preflight
app.options('*', cors());
```

**IMPORTANTE:** Sin CORS, los requests de `.well-known` fallan y el cliente no puede descubrir tu servidor.

### 2. HTTPS Obligatorio

**Síntoma:** "Invalid or unsupported scheme"

**Causa:** Intentas usar `http://` en producción.

**Fix:** Siempre HTTPS. Para dev local, usa ngrok:

```bash
ngrok http 3000
# Te da: https://abc123.ngrok.io
# Usa eso en Claude Desktop
```

### 3. Session ID Management en Stateless Servers

**Problema:** Si escalas a múltiples procesos, un request puede llegar a diferente instancia y la `sessionId` no existe.

**Soluciones:**

- **Opción A (MVP):** Un solo proceso (Render standard)
- **Opción B (Escala):** Redis para session store:
  ```typescript
  const redis = new Redis();
  const transports = {};
  
  // Guarda transport en Redis con TTL
  await redis.setex(`mcp-session:${sessionId}`, 3600, JSON.stringify(transport));
  ```

### 4. Timeout de SSE en Proxies

**Problema:** Si usas SSE (opcional en Streamable HTTP), proxies/CDNs cierran connections después de 30-55 segundos sin datos.

**Fix:** Envía keep-alive comment cada 30s:

```typescript
// En tu SSE stream
setInterval(() => {
  response.write(': keep-alive\n\n');
}, 30000);
```

**Mejor:** No uses SSE si no es necesario. Streamable HTTP regular (POST) no tiene este problema.

### 5. Response Size Limits

**Límites MCP:**
- Inline responses: ~160 KB
- Resource responses (`returnAsResource: true`): hasta 5 MB

**Problema:** Si un video tiene 1 hora, el transcript es >160 KB.

**Fix:**

```typescript
const text = longTranscript; // 500 KB

if (text.length > 160000) {
  // Opción A: Trunca
  return {
    content: [{ type: 'text', text: text.slice(0, 160000) + '\n...[truncated]' }]
  };

  // Opción B: Retorna como recurso (si MCP server lo soporta)
  // (más raro, verifica spec)
  
  // Opción C: Retorna URL
  return {
    content: [{ type: 'text', text: `Transcript demasiado largo (${text.length} chars). Descarga aquí: https://api.astools.com/transcriptions/${id}/download` }]
  };
}
```

### 6. OAuth Client Registration

**Problema:** Si Claude Desktop intenta Dynamic Client Registration (DCR) en tu OAuth server, falla porque no implementaste `/register`.

**Fix:**

```typescript
// Implementa DCR endpoint
app.post('/oauth/register', (req, res) => {
  const { client_name, redirect_uris } = req.body;
  
  // Genera client_id y client_secret
  const client_id = generateId();
  const client_secret = generateSecret();
  
  // Guarda en BD
  db.oauth_clients.insert({ client_id, client_secret, client_name, redirect_uris });
  
  res.json({
    client_id,
    client_secret,
    client_name,
    redirect_uris,
    // ... otros campos
  });
});
```

**O más simple:** Usa pre-registration. Genera client_id/secret manualmente, dáselo al usuario:

```json
{
  "client_id": "claude-desktop-astools",
  "client_secret": "sk_live_abc123..."
}
```

Ellos lo insertan en Settings de Claude Desktop (pero es manual, no ideal UX).

### 7. Token Expiration Handling

**Problema:** Access token expira. Claude Desktop intenta hacer request con token viejo.

**Síntoma:** Requests empiezan a fallar después de 1 hora.

**Fix:** Implementa refresh tokens:

```typescript
// En POST /oauth/token
res.json({
  access_token: shortLivedJwt,      // 1h
  refresh_token: refreshToken,      // 30 días
  expires_in: 3600
});

// Si Claude Desktop recibe 401 o token expired
// Automáticamente intenta refresh:
POST /oauth/token
{ grant_type: 'refresh_token', refresh_token: '...' }
```

### 8. Error Handling

**No hagas:**

```typescript
throw new Error('Database connection failed');
// Claude ve: "Error executing tool: Database connection failed"
// Claude expone detalles internos al usuario
```

**Mejor:**

```typescript
try {
  // ...
} catch (err) {
  // Log el error interno
  console.error('[transcribe_video]', err);
  
  // Retorna error amigable
  return {
    content: [{
      type: 'text',
      text: 'Ocurrió un error procesando el video. Intenta más tarde.\n\nDetalles técnicos: Video format not supported.'
    }],
    isError: true
  };
}
```

### 9. Large File Downloads

**Problema:** Usuario pide "descargar video" via MCP. Video es 500 MB.

**No intentes:**

```typescript
// ❌ No retornes binarios en MCP
const fileBuffer = fs.readFileSync('video.mp4');
return {
  content: [{ type: 'text', text: fileBuffer.toString('base64') }]
  // → Base64 de 500 MB = 667 MB en texto. Response > límites.
};
```

**Mejor:** Retorna download link:

```typescript
return {
  content: [{
    type: 'text',
    text: 'Video disponible para descargar aquí:\n\nhttps://api.astools.com/download/video/abc123\n\nLink válido por 24 horas.'
  }]
};
```

### 10. Authentication Context en Tools Asincronos

**Problema:** Si lanzas trabajos async, ¿cómo sabe el job quién lo creó?

```typescript
registerTool('transcribe_video', ..., async ({ url }, extras) => {
  // extras.request tiene datos del usuario? ¿O no?
  
  // ¿Cómo lanzas un background job con user_id?
});
```

**Solución:** Pasa `user_id` en la request, guárdalo en job:

```typescript
registerTool('transcribe_video', ..., async ({ url }, extras) => {
  const userId = req.user.id; // De middleware MCP
  
  // Lanza job background
  const job = await submitJob({
    type: 'transcribe',
    url,
    user_id: userId,
    created_at: new Date()
  });
  
  return {
    content: [{
      type: 'text',
      text: `Job encolado. ID: ${job.id}. Verifica estado con "get_job_status".`
    }]
  };
});
```

### 11. Debugging: MCP Inspector

**Herramienta oficial:** `mcp-inspector` (CLI que abre web UI)

```bash
npm install -g @modelcontextprotocol/inspector

mcp-inspector "node /ruta/a/tu/servidor.js"
# Abre http://localhost:5173 con interfaz interactiva
```

**Super útil para:**
- Ver exactamente qué envía/recibe el servidor
- Testear tools sin Claude
- Debugging de autenticación

### 12. Cloudflare Tunnel para Desarrollo Local

Si quieres testear OAuth/CORS sin deployar:

```bash
# Instala cloudflare tunnel
brew install cloudflare-cli

# Abre tunnel a localhost:3000
cloudflare tunnel --url http://localhost:3000

# Te da: https://xxx.trycloudflare.com
# Úsalo en Claude Desktop
```

---

## RECOMENDACIÓN FINAL PARA AS TOOLS

### Estrategia de Implementación: Híbrida (OAuth Mínimo)

**Por qué:** Balancean complejidad vs. estándar.

### Pasos Accionables en Orden

#### **FASE 1: MVP (Semana 1)**

1. **Instala SDK:**
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. **Crea estructura:**
   ```bash
   mkdir -p api/mcp
   touch api/mcp/{server.ts,router.ts,auth.ts}
   ```

3. **Implementa auth simple (Bearer JWT):**
   ```typescript
   // api/mcp/auth.ts
   export const mcpAuth = (req, res, next) => {
     const token = req.headers.authorization?.split(' ')[1];
     if (!token) return res.status(401).json({ error: 'Missing auth' });
     
     try {
       req.user = jwt.verify(token, process.env.JWT_SECRET);
       next();
     } catch {
       res.status(403).json({ error: 'Invalid token' });
     }
   };
   ```

4. **Implementa POST /mcp endpoint:**
   - Copia boilerplate de `api/mcp/router.ts` (arriba en sección MVP)
   - Monta en Express: `app.use(mcpRouter)`

5. **Implementa 2 tools:**
   - `transcribe_video` → Llama a tu POST `/api/transcriptions`
   - `list_transcriptions` → Llama a tu GET `/api/transcriptions`

6. **Agrega CORS:**
   ```typescript
   import cors from 'cors';
   app.use(cors({ origin: '*', exposedHeaders: ['Mcp-Session-Id'] }));
   ```

7. **Testea localmente:**
   ```bash
   npm run dev
   # En Claude Desktop: Settings → Custom connector → http://localhost:3000
   ```

8. **Deploy a Render:**
   - Push a git
   - Render auto-redeploys
   - Testea con URL pública

#### **FASE 2: OAuth (Semana 2, Opcional pero Recomendado)**

Si quieres el "sello de agua" de OAuth 2.1:

1. **Agrega discovery endpoint:**
   ```typescript
   app.get('/.well-known/oauth-protected-resource', (req, res) => {
     res.json({
       resource: 'https://api.astools.com/mcp',
       authorization_servers: ['https://api.astools.com'],
       scopes_supported: ['mcp:tools']
     });
   });
   ```

2. **Agrega `/oauth/authorize`:**
   - Si user no logueado → redirige a `/login`
   - Si logueado → muestra pantalla "Claude Desktop wants access to mcp:tools"
   - Genera `code` + guarda `code_challenge` para PKCE

3. **Agrega `/oauth/token`:**
   - Intercambia `code` por JWT (5 min de dev)
   - Retorna: `access_token`, `token_type`, `expires_in`

4. **Agrega OIDC discovery:**
   ```typescript
   app.get('/.well-known/openid-configuration', (req, res) => {
     res.json({
       issuer: 'https://api.astools.com',
       authorization_endpoint: 'https://api.astools.com/oauth/authorize',
       token_endpoint: 'https://api.astools.com/oauth/token',
       // ... otros
     });
   });
   ```

#### **FASE 3: Escala (Después de MVP)**

Una vez tengas usuarios reales:

1. **Rate limiting:** Middleware `redis-rate-limiter`
2. **Cost tracking:** Columnas en `usage_stats` para MCP calls
3. **Más tools:** Agrega `create_clips`, `create_reel`, etc.
4. **Async tasks:** Implementa polling para transcripciones largas
5. **Monitoring:** Logs de cada MCP call (user_id, tool, result, cost)

---

### Checklist Pre-Deploy

- [ ] CORS headers incluyen `https://claude.ai` y `https://claude.com`
- [ ] Servidor es HTTPS en producción
- [ ] `/.well-known/oauth-protected-resource` retorna 200 + JSON válido
- [ ] POST `/mcp` con sessionId retorna respuesta válida
- [ ] Auth middleware valida JWT correctamente
- [ ] Testeas tools en MCP Inspector
- [ ] Render deploy OK, HTTPS funciona
- [ ] Claude Desktop puede conectar a URL pública sin CORS errors
- [ ] Tools ejecutan sin timeout (< 30s para MVP)
- [ ] Error handling retorna messages amigables (no stack traces)

---

### Estimado de Esfuerzo

| Tarea | Horas | Notas |
|-------|-------|-------|
| Setup SDK + estructura | 2 | Copy-paste |
| Bearer auth middleware | 1 | Trivial si tienes JWT |
| POST /mcp endpoint | 2 | Boilerplate del SDK |
| 2 tools (transcribe, list) | 4 | Integración con endpoints REST |
| CORS + testing local | 2 | Debugging pequeño |
| Deploy + testing prod | 2 | Render es fácil |
| **FASE 1 TOTAL** | **13h** | ~1.5 días de dev |
| OAuth endpoints (Fase 2) | 4-6 | Si es necesario |
| **TOTAL MVP + OAuth** | **17-19h** | ~2 días completos |

---

### Arquitectura Diagrama Final (Render Actual)

```
┌─────────────────────────────────────────┐
│   Claude Desktop / Claude.ai Web        │
│   (usuario cliente de AS Tools)         │
└────────────────┬────────────────────────┘
                 │
              HTTPS
                 │
    ┌────────────▼──────────────┐
    │   Render (api.astools.com)│
    │                           │
    │  Express.js               │
    │  ├─ /api/* (REST actual)  │
    │  │                        │
    │  └─ /mcp (NUEVO)          │◄─── Streamable HTTP
    │     ├─ POST /mcp          │     (MCP protocol)
    │     ├─ GET /.well-known/* │
    │     └─ /oauth/* (opt)     │
    │                           │
    │  sqlite3 (/opt/data)      │
    │  user, transcriptions,    │
    │  clips, reels, secrets    │
    └───────────────────────────┘
              ▲
              │ (internos)
              │
    ┌─────────┴──────────┐
    │ yt-dlp, ffmpeg,    │
    │ OpenAI, Anthropic  │
    └────────────────────┘
```

---

### Próximos Pasos Inmediatos

1. **Hoy:** Clona este documento, agrégalo a `.claude/memory` para futuros desarrollos
2. **Mañana:** Comienza FASE 1 (setup + 2 tools básicos)
3. **En 2 semanas:** MVP live, usuarios pueden conectar Claude
4. **En 1 mes:** OAuth + 4-5 tools adicionales, monitoring

---

## FUENTES

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Anthropic API Documentation](https://platform.claude.com/docs)
- [MCP TypeScript SDK Repository](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Cheat Sheet (2026) - Webfuse](https://www.webfuse.com/mcp-cheat-sheet)
- [Complete Guide to MCP (2026) - DEV Community](https://dev.to/x4nent/complete-guide-to-mcp-model-context-protocol-in-2026-architecture-implementation-and-4a11)
- [MCP Remote Revolution: Streamable HTTP & OAuth - Zylos Research](https://zylos.ai/research/2026-03-08-mcp-remote-evolution-streamable-http-enterprise-adoption)
- [Everything Your Team Needs to Know About MCP (2026) - WorkOS](https://workos.com/blog/everything-your-team-needs-to-know-about-mcp-in-2026)
- [Is That Allowed? Authentication & Authorization in MCP - Stack Overflow](https://stackoverflow.blog/2026/01/21/is-that-allowed-authentication-and-authorization-in-model-context-protocol/)
- [Understanding Authorization in MCP - MCP Documentation](https://modelcontextprotocol.io/docs/tutorials/security/authorization)
- [MCP Authentication & OAuth 2.1 Guide - Toolradar](https://toolradar.com/blog/mcp-authentication)
- [Building Secure MCP Server with OAuth 2.1 - ISE Developer Blog](https://devblogs.microsoft.com/ise/aca-secure-mcp-server-oauth21-azure-ad/)
- [MCP Tasks: Long-Running Operations - WorkOS](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows)
- [Build a Remote MCP Server - Cloudflare Agents](https://developers.cloudflare.com/agents/guides/remote-mcp-server/)
- [Where to Host MCP Servers for Free (2026) - MCP Playground](https://mcpplaygroundonline.com/blog/free-mcp-server-hosting-cloudflare-vercel-guide)
- [Deploy Remote MCP to Cloudflare - Blog](https://blog.cloudflare.com/remote-model-context-protocol-servers-mcp/)
- [Rate Limiting for MCP Servers - MintMCP](https://www.mintmcp.com/blog/rate-limiting-with-mcp)
- [Best MCP Gateways for Rate Limiting (2026) - MintMCP](https://www.mintmcp.com/blog/mcp-gateways-rate-limiting-access-control)
- [Integrating MCP Tools into Express - DEV Community](https://dev.to/udarabibile/integrating-mcp-tools-into-express-with-minimal-changes-28e6)
- [Mastering MCP with Node.js & Express - Medium](https://medium.com/@pankaj_pandey/mastering-mcp-with-node-js-and-express-build-a-seamless-ai-integration-server-from-scratch-5b0537bfa44f)
- [Streamable HTTP Complete Intro - MCP Courses](https://mcp.holt.courses/lessons/sses-and-streaming-html/streamable-http)
- [Get Started with Custom Connectors - Claude Help](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
- [Build Custom Connectors via Remote MCP - Claude Help](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers)
- [How to Setup MCP in Claude Desktop (2026) - MCP Playground](https://mcpplaygroundonline.com/blog/how-to-setup-mcp-claude-desktop)
- [Claude MCP Server Discovery - Ekamoira](https://www.ekamoira.com/blog/mcp-server-discovery-implement-well-known-mcp-json-2026-guide)
- [Firebase vs Render vs Vercel (2026) - Bejamas](https://bejamas.com/compare/firebase-vs-render-vs-vercel)
- [Vercel vs Firebase (2026) - UI Bakery](https://uibakery.io/blog/vercel-vs-firebase)
- [MCP Response Size Limits - GitHub Issues](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2211)
- [File Handling in AI Agents with MCP - Roman's Notes](https://gelembjuk.com/blog/post/file-handling-in-ai-agents-with-mcp-lessons-learned)
- [Building Real-Time Apps with WebSockets - Render](https://render.com/articles/building-real-time-applications-with-websockets)
- [WebSocket vs SSE vs Long Polling - TechPlained](https://www.techplained.com/websockets-sse-vs-long-polling-comparison)

---

**Documento Generado:** Mayo 2026  
**Estado:** Exhaustivo, Production-Ready  
**Para Equipo:** Algo Sentido (AS Tools)
