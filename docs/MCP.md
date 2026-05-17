# AS Tools — MCP Server

Documentación viva del servidor MCP (Model Context Protocol) integrado en AS Tools.
Esta doc cubre arquitectura, operación, y cómo extenderlo.

> **Regla de oro**: si tocaste código del MCP (`api/mcp/*`, `api/oauth/*`) y no estás actualizando este doc + `docs/CHANGELOG.md`, lo más probable es que estés sembrando deuda. El hook PostToolUse te recordará.

---

## Índice

1. [Qué es y por qué](#1-qué-es-y-por-qué)
2. [Arquitectura](#2-arquitectura)
3. [Flujo OAuth completo](#3-flujo-oauth-completo)
4. [Cómo agregar una tool nueva](#4-cómo-agregar-una-tool-nueva-receta) ← **lo que más vas a hacer**
5. [Cómo modificar OAuth (scopes, TTLs, etc.)](#5-cómo-modificar-oauth)
6. [Cómo operar en prod](#6-cómo-operar-en-prod)
7. [Decisiones de diseño](#7-decisiones-de-diseño)
8. [Roadmap — lo que NO está hecho](#8-roadmap--lo-que-no-está-hecho)

---

## 1. Qué es y por qué

AS Tools expone sus funcionalidades vía **MCP (Model Context Protocol)** para que clientes como **Claude.ai** se conecten y usen las herramientas desde un chat de IA — sin tocar la UI web.

**Caso de uso real**: un cliente conecta su Claude.ai a `https://as-tools.algosentido.com/mcp`, autoriza con su cuenta, y desde su chat le pide *"transcribe este Reel y analiza las ideas"*. Su Claude llama los tools del MCP en su nombre, todo bajo su cuenta de AS Tools (mismas cuotas, mismo historial).

Equivalente conceptual: lo que cal.com, Linear, Sentry, Notion ya ofrecen vía sus propios MCP servers. Para más contexto sobre la decisión técnica inicial, ver `docs/MCP_RESEARCH_NOTES.md`.

---

## 2. Arquitectura

### Diagrama mental

```
┌─────────────────────┐     POST /mcp     ┌─────────────────────────┐
│   Claude.ai (web)   │ ────────────────► │  Express en Render      │
│   (cliente OAuth)   │                   │  as-tools.algosentido   │
└─────────────────────┘                   │  .com                   │
         │ ▲                              │                         │
         │ │                              │  ┌─── api/oauth/ ───┐   │
         │ │ OAuth 2.1 flow               │  │  metadata.js     │   │
         │ │ (DCR + PKCE + refresh)       │  │  register.js     │   │
         │ ▼                              │  │  authorize.js    │   │
┌─────────────────────┐                   │  │  token.js        │   │
│  Usuario humano     │                   │  │  validator.js    │   │
│  (autoriza una vez) │                   │  │  views.js (HTML) │   │
└─────────────────────┘                   │  │  session.js      │   │
                                          │  │  storage.js (DB) │   │
                                          │  └──────────────────┘   │
                                          │                         │
                                          │  ┌─── api/mcp/ ─────┐   │
                                          │  │  routes.js       │   │
                                          │  │  server.js       │   │
                                          │  │  audit.js        │   │
                                          │  │  adminRoutes.js  │   │
                                          │  │  tools/          │   │
                                          │  │   ├ list_my…     │   │
                                          │  │   ├ transcribe_… │   │
                                          │  │   ├ get_…        │   │
                                          │  │   ├ analyze_…    │   │
                                          │  │   └ build_idea…  │   │
                                          │  └──────────────────┘   │
                                          │                         │
                                          │  SQLite (/opt/data/)    │
                                          │  ─ oauth_clients        │
                                          │  ─ oauth_*_tokens       │
                                          │  ─ oauth_auth_codes     │
                                          │  ─ mcp_audit_log        │
                                          │  ─ transcriptions       │
                                          │  ─ users (+ quotas)     │
                                          └─────────────────────────┘
```

### Layout de archivos

| Archivo | Propósito |
|---|---|
| `api/oauth/metadata.js` | `.well-known/oauth-protected-resource` + `oauth-authorization-server` (RFC 9728 + 8414) |
| `api/oauth/register.js` | `POST /oauth/register` — Dynamic Client Registration (RFC 7591) |
| `api/oauth/authorize.js` | `GET /oauth/authorize`, `POST /oauth/login`, `POST /oauth/decision` |
| `api/oauth/token.js` | `POST /oauth/token` — code↔access exchange + refresh rotation, PKCE S256 |
| `api/oauth/validator.js` | Middleware Bearer para `/mcp` (responde 401 + `WWW-Authenticate`) |
| `api/oauth/views.js` | HTML server-rendered (login + consent + error). Sin React. |
| `api/oauth/session.js` | Cookie HMAC de 10 min durante el flujo OAuth. Sin tabla. |
| `api/oauth/storage.js` | Helpers DB para clients/codes/tokens. Tokens hasheados SHA-256. |
| `api/mcp/routes.js` | `POST /mcp` — Streamable HTTP stateless. Chequea toggles antes de armar el server. |
| `api/mcp/server.js` | Factory `buildServerForUser()` + wrapper de audit/quota por tool call. |
| `api/mcp/audit.js` | `logToolCall`, `checkQuota`, toggle global, disable per-user. |
| `api/mcp/adminRoutes.js` | 9 endpoints REST para el tab `/admin → 🔌 MCP`. ownerOnly. |
| `api/mcp/tools/*.js` | Una tool por archivo. Cada una exporta `description`, `inputSchema`, `annotations`, `makeHandler(user)`, opcional `requiredScope`. |
| `src/components/MCPAdmin.jsx` | Tab del AdminPanel: overview, clients, tokens, cuotas, audit. |

---

## 3. Flujo OAuth completo

Pasos cronológicos cuando un usuario nuevo conecta su Claude.ai al MCP:

```
1. Usuario pega URL en claude.ai → Settings → Connectors:
   https://as-tools.algosentido.com/mcp

2. Claude.ai hace POST /mcp sin token
   ↓
   Server responde 401 + header:
   WWW-Authenticate: Bearer resource_metadata="…/.well-known/oauth-protected-resource"

3. Claude.ai fetch a /.well-known/oauth-protected-resource
   ↓
   Server responde JSON con authorization_servers=[base]

4. Claude.ai fetch a /.well-known/oauth-authorization-server
   ↓
   Server responde endpoints: authorize, token, register

5. Claude.ai POST /oauth/register (sin auth, body con redirect_uris)
   ↓
   Server crea row en oauth_clients, devuelve client_id

6. Claude.ai abre browser del usuario a:
   GET /oauth/authorize?response_type=code&client_id=…&code_challenge=…&state=…

7. Usuario ve pantalla de LOGIN (views.renderLogin)
   ↓ ingresa credenciales
   POST /oauth/login → server valida con loginUser(), set cookie oauth_session
   ↓ 303 redirect a GET /oauth/authorize

8. Usuario ve pantalla de CONSENT (views.renderConsent) con scopes solicitados
   ↓ click "Autorizar"
   POST /oauth/decision → server genera code, redirect 302 a redirect_uri?code=…&state=…

9. Claude.ai recibe el code, hace POST /oauth/token con PKCE verifier
   ↓
   Server valida PKCE, emite access_token (1h) + refresh_token (30d)
   Tokens hasheados (SHA-256) en oauth_access_tokens y oauth_refresh_tokens

10. Claude.ai guarda los tokens, hace POST /mcp con Bearer
    ↓
    mcpAuthMiddleware valida → resuelve user_id → buildServerForUser → tools disponibles
```

### Datos persistidos

- **`oauth_clients`** (permanente hasta que el admin lo borre)
- **`oauth_auth_codes`** (10 min, single-use, hash SHA-256)
- **`oauth_access_tokens`** (1h, hash SHA-256)
- **`oauth_refresh_tokens`** (30d, rotación: cada refresh revoca el anterior y emite uno nuevo)

---

## 4. Cómo agregar una tool nueva (receta)

**Patrón**: copiar un tool existente, ajustar, registrar en el factory.

### Paso 1 — Crea el archivo

`api/mcp/tools/miToolNueva.js`:

```js
import { z } from 'zod';
// importa los services/helpers que ya existan en el codebase
import { miServicio } from '../../services/miServicio.js';

// Opcional. Si lo defines, el tool solo se registra para tokens con ese scope.
// Scopes válidos hoy: 'transcribe:read', 'transcribe:write', 'analyze:write'.
// Si necesitas uno nuevo, ver sección 5.
export const requiredScope = 'transcribe:write';

// La descripción es el "prompt" que ve Claude para decidir cuándo usar la tool.
// Escribe en segunda persona, incluye CUÁNDO usar y CUÁNDO NO, formato de inputs,
// y cómo presentar el resultado al usuario (literal vs sintetizar).
export const description =
  'Hace X cosa concreta. Devuelve Y. ' +
  'CÓMO PRESENTAR EL RESULTADO: 1) ..., 2) ..., 3) ofrecer próximos pasos sin ejecutar. ' +
  'Usa cuando el usuario pida "Z". NO uses cuando ...';

export const annotations = {
  title: 'Nombre legible (aparece en el UI de Claude.ai)',
  readOnlyHint: false,        // true si no muta nada (afecta categorización en Claude.ai)
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,         // true si toca internet (URLs, APIs externas)
};

// Inputs con validación zod. Cada campo .describe() explica para qué sirve.
// Mantener el schema PEQUEÑO y CLARO — menos opciones = mejor uso por Claude.
export const inputSchema = {
  algo: z.string().describe('Descripción concreta para que Claude sepa qué pasar.'),
  limite: z.number().int().min(1).max(50).optional().describe('Opcional, default 20.'),
};

export function makeHandler(user) {
  return async (args) => {
    try {
      const result = await miServicio(args.algo, user.id);

      return {
        content: [{
          type: 'text',
          text: `✓ Hecho.\n\n${result.contenido}`,
        }],
        structuredContent: {
          // Si la tool consume API externa, expón cost_usd para que quede en audit log.
          cost_usd: result.costo || 0,
          // Datos estructurados que otros tools de Claude pueden encadenar.
          some_id: result.id,
        },
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  };
}
```

### Paso 2 — Regístrala en el factory

`api/mcp/server.js`:

```js
import * as miToolNueva from './tools/miToolNueva.js';

const TOOLS = {
  list_my_transcriptions: { ... },
  // ...
  mi_tool_nueva: { ...miToolNueva },  // ← agregar aquí
};
```

El factory automáticamente:
- Filtra la tool si el token no tiene `requiredScope`
- La envuelve con `wrapHandler` que mide duración + costo + escribe en `mcp_audit_log`
- Aplica quota check si la tool aparece en `TRANSCRIPTION_TOOLS` (ver `api/mcp/audit.js`)

### Paso 3 — Si tu tool cuesta dinero y debe contar contra cuota

Editar `api/mcp/audit.js`:

```js
const TRANSCRIPTION_TOOLS = new Set(['transcribe_video_url', 'mi_tool_nueva']);
```

O crear un nuevo set y nueva columna de cuota en `users` si es otro tipo de límite.

### Paso 4 — Actualizar la admin

Si tu tool tiene presupuesto/costo, agrégala al filtro del audit log en
`src/components/MCPAdmin.jsx`:

```jsx
<option value="mi_tool_nueva">mi_tool_nueva</option>
```

### Paso 5 — Smoke test

```bash
# Local con tu cuenta
TOKEN="$(...obtener via curl OAuth flow, ver docs/CHANGELOG sprint inicial...)"
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"mi_tool_nueva","arguments":{"algo":"x"}}}' \
  | sed -n 's/^data: //p' | python3 -m json.tool
```

### Paso 6 — Commit + actualizar docs

- Entrada en `docs/CHANGELOG.md`
- Si cambió la arquitectura, actualizar este doc
- Push a `main` + merge a `develop` (el patrón que usa el repo)

---

## 5. Cómo modificar OAuth

### Agregar un scope nuevo

1. En `api/oauth/metadata.js` → agregar al array `scopes_supported`
2. En `api/oauth/views.js` → agregar al map `SCOPE_LABELS` la descripción que verá el usuario en consent
3. En `api/oauth/authorize.js` → agregar al `SUPPORTED_SCOPES` y opcionalmente al `DEFAULT_SCOPES`
4. En el tool que lo requiera → `export const requiredScope = 'mi:scope:nuevo'`

Los tokens emitidos con el nuevo scope solo verán las tools que lo declaran.

### Cambiar TTLs

- Access token TTL: `ACCESS_TTL_SECONDS` en `api/oauth/token.js` (default 1h)
- Refresh token TTL: `REFRESH_TTL_SECONDS` en `api/oauth/token.js` (default 30d)
- Authorization code TTL: param `ttlSeconds` en `createAuthCode()` (default 10min)
- Cookie de sesión OAuth: `TTL_MS` en `api/oauth/session.js` (default 10min)

### Soporte para auth distinto a email+password

Hoy `authorizeLogin()` solo soporta credenciales tradicionales. Para agregar
magic link al flujo OAuth, ver "Magic link en OAuth" en sección Roadmap.

---

## 6. Cómo operar en prod

### Testing

El proyecto tiene **2 niveles de tests** para el MCP:

**Tier 1 — smoke test end-to-end** (`scripts/smoke-mcp.sh`)
- Ejercita: discovery → DCR → login → consent → token → initialize → tools/list → tool/call
- Corre con: `npm run smoke:mcp`
- Default contra `http://localhost:3000` con usuario `oauth-test@example.com`
- Contra prod: `BASE=https://as-tools.algosentido.com EMAIL=tu@email.com PASS=xxx npm run smoke:mcp`
- Sale 0 si todo OK, 1 si algo falla. Usar después de cada deploy importante.

**Tier 2 — unit tests** (Vitest)
- `npm test` corre todos los tests (incluyendo los de Reels).
- Cobertura crítica del MCP:
  - `api/oauth/session.test.js` — HMAC de cookies de sesión (rotación de secret, tampering, expiration)
  - `api/oauth/token.test.js` — PKCE S256 (verifier válido, inválido, longitud mínima/máxima)
  - `api/mcp/audit.test.js` — `checkQuota` (owner unlimited, sin cuota, en límite, excedido) + `isQuotaApplicable`
- ~40 tests para MCP, corren en <1s.

**Lo que NO está cubierto** (roadmap):
- Integration tests con `supertest` (Express in-process + hit real a `/oauth/*` y `/mcp`)
- CI en GitHub Actions (corre tests automáticamente en cada PR)
- Tests del MCP transport (Streamable HTTP) — depende del SDK upstream

### URLs de producción

### URLs de producción

- App + UI web: `https://as-tools.algosentido.com`
- MCP endpoint: `https://as-tools.algosentido.com/mcp`
- Discovery: `https://as-tools.algosentido.com/.well-known/oauth-protected-resource`

### Variables de entorno críticas (Render)

| Variable | Valor en prod | Para qué |
|---|---|---|
| `MCP_BASE_URL` | `https://as-tools.algosentido.com` | URL pública en metadata + WWW-Authenticate. Si no se setea, se infiere del request (frágil con proxies). |
| `APP_BASE_URL` | `https://as-tools.algosentido.com` | Magic links y otras URLs que la app construye |
| `OAUTH_SESSION_SECRET` | (autogenerado por Render) | Firma HMAC de la cookie de 10min del flujo OAuth |
| `OPENAI_API_KEY` | (set en Render) | Whisper (transcribe) + gpt-4o-mini (analyze en UI web — el MCP ya no lo usa) |
| `JWT_SECRET` | (set en Render) | Firma de JWTs de la auth principal (UI web). El OAuth de MCP usa otra cookie. |

### Admin panel

`https://as-tools.algosentido.com/admin → 🔌 MCP`

Casos de uso reales, ver `MCPAdmin.jsx` o reservar para esta doc:

- **Cliente reporta error**: filtrar audit log por su email → diagnóstico inmediato
- **Costos OpenAI suben**: overview muestra costo 24h → si se sale, cuota al usuario
- **Cortar acceso a un cliente**: cuotas → desactivar MCP de ese usuario
- **Emergencia**: toggle rojo "Apagar MCP" → 503 a todos, UI web sigue funcionando

### Troubleshooting frecuente

| Síntoma | Probable causa | Cómo verificar |
|---|---|---|
| Claude.ai no detecta el connector | `MCP_BASE_URL` mal seteada → metadata devuelve URL incorrecta | `curl https://as-tools.algosentido.com/.well-known/oauth-protected-resource` y verificar que `resource` y `authorization_servers` sean el dominio correcto |
| Cliente autoriza pero recibe 401 al usar | Token expiró (1h) y refresh falló | Audit log → buscar errores `invalid_token` |
| Tool falla con "demasiado corto" | Transcript vacío (video sin audio o con error de Whisper) | Ver fila en `transcriptions` y campo `transcript` |
| `transcribe_video_url` tarda mucho y Claude.ai timeout | Video largo (>10 min) o yt-dlp lento | No hay solución hoy — ver Roadmap, async jobs |

### Deploy

Cada push a `main` dispara deploy automático en Render (`render.yaml`).
Tiempo típico: ~6 min (build Docker + update). El user habitual hace:

```bash
git checkout main && git merge --ff-only <feature-branch> && git push origin main
# Luego mergear main → develop también (convención del repo)
git -C <main-worktree> merge origin/main --no-ff -m "Merge main (X) into develop"
git -C <main-worktree> push origin develop
```

---

## 7. Decisiones de diseño

Lista corta de "por qué X, no Y" para evitar re-deliberar:

### Stateless por request (no sesión MCP persistente)
Cada `POST /mcp` crea un `McpServer` + `StreamableHTTPServerTransport` nuevos. Escala horizontal trivial, cero estado en memoria, robusto detrás de proxies. El cliente no puede asumir continuidad entre requests.

### OAuth 2.1 (no API keys)
Aunque API keys serían más simples, OAuth con DCR es lo que Claude.ai exige como Custom Connector. Sin DCR, no aparece la UX limpia de "pega URL → autoriza". Vale la complejidad porque desbloquea distribución a clientes finales.

### Tokens hasheados (SHA-256), nunca en claro en DB
Si la DB se compromete, los tokens activos no son inmediatamente usables. El token raw solo existe en la respuesta HTTP al cliente.

### Refresh token rotation
Cada refresh emite nuevo refresh + revoca el anterior. Si un atacante roba un refresh y lo usa antes que el legítimo, el legítimo recibe `invalid_grant` y sabe que algo pasó. Trade-off: ligera fragilidad en clientes con concurrencia (no es problema con Claude.ai).

### Consent UI server-rendered en HTML puro (no React)
El authorize endpoint es donde se decide a quién dar acceso a una cuenta. Menos JavaScript = menos superficie XSS, menos dependencias que auditar. También no requiere que el bundle React esté cargado para autorizar.

### `analyze_ideas` en MCP NO llama gpt-4o-mini
Cuando el cliente está en Claude.ai, ya está pagando Claude (más capaz). Hacer una llamada a OpenAI desde el server es dejar calidad sobre la mesa y agregar costo innecesario. El tool devuelve transcript + lente y deja que Claude del chat haga la síntesis. La UI web SÍ sigue usando gpt-4o-mini porque ahí no hay un LLM disponible.

### `build_idea_map` lleva ese patrón un paso más allá: la compuerta vive en el LENS
El Generador de Ideas no devuelve "el transcript + el lente" (no hay video). Devuelve **las dos columnas crudas del usuario + el LENS completo con las tres reglas de rechazo (Fallo 1/2/3) + el copy exacto de las repreguntas + los límites operativos (máx 2 repreguntas/filtro, 5 turnos)**. Claude-en-chat aplica todo. El servidor es stateless: el cliente Claude pasa `prior_attempts` en cada call para que la tool sepa cuántos turnos lleva y cuándo cortar. La UI web sí persiste estado y ejecuta tres prompts dedicados en backend (gate + fuga + generate). Ver `api/services/ideaMapService.js` para el LENS canónico — fuente única de verdad compartida por web y MCP.

### Audit log con `args_summary` truncado a 500 chars
Por privacidad. No queremos guardar URLs completas, transcripts, o cualquier cosa que pudiera filtrar info sensible si alguien accede a la DB.

### Cuotas solo cuentan tools costosos (`TRANSCRIPTION_TOOLS`)
`list_my_transcriptions` y `get_transcription` son lectura gratis — no tiene sentido limitarlas. Solo limitamos lo que cuesta dinero externo.

---

## 8. Roadmap — lo que NO está hecho

Si en el futuro necesitas alguna de estas, no estás empezando de cero — ya está pensado:

### Magic link en el flujo OAuth
Hoy solo email+password. Para soporte de magic link en authorize:
- Agregar botón en `views.renderLogin()`
- Nuevo endpoint `POST /oauth/magic-link` que reusa `requestMagicLink()` con un `return_to` que apunta al `/oauth/authorize` con los mismos params codificados
- Endpoint `GET /oauth/magic/:token` que valida el link y setea la cookie de sesión OAuth
- Pasar los params OAuth a través del email (token contiene return_to firmado)

### Tools de Convert + Secretos
Triviales de agregar siguiendo la receta de sección 4:
- `convert_document` (reusa `api/convertDocument.js`)
- `create_secret`, `list_my_secrets`, `revoke_secret` (reusa `api/secrets.js`)

### Tools de Clips + Reels
Complejos por sus flujos multi-paso interactivos. Necesitan diseño aparte:
- ¿Sync con polling de status? ¿Async con jobs?
- ¿Cómo manejar la edición visual de chunks/cortes desde un chat?
- Probablemente: 1 tool para arrancar (devuelve job_id), 1 para status, 1 para finalizar. La edición fina probablemente requiere volver a la UI web.

### Vista cliente-final de "Mis conexiones MCP"
Hoy solo el owner ve el admin. Sería útil que cada usuario vea en su perfil:
- Sus access tokens activos (qué cliente OAuth, cuándo expira)
- Botón "revocar este connector"
- Su uso del día / cuota restante

Path: nueva ruta `/mis-conexiones`, reusa endpoints admin pero filtrados por `user_id = req.user.id`.

### Alertas automáticas
Cuando costo 24h supera $X, o errores 24h superan Y, mandar email al owner.
Hoy hay que entrar al admin manualmente.

### Jobs async para transcripciones largas
Hoy `transcribe_video_url` es sync y videos largos pueden chocar con timeouts de Claude.ai. Para soporte de videos >15min:
- Crear tabla `transcribe_jobs` con status
- `transcribe_video_url` queue job, devuelve job_id
- Nueva tool `get_transcribe_job_status(job_id)` para polling
- Worker que procesa la queue (Render no soporta background workers en free tier — sería un cron o un servicio separado)

### MCP en subdominio dedicado
Si en el futuro se justifica `mcp.algosentido.com`:
- Agregar custom domain en Render (cuesta $0.25/mes extra — plan Hobby permite 2 incluidos)
- DNS CNAME a `viraler-ia.onrender.com.`
- Cambiar `MCP_BASE_URL` a la nueva URL
- (Opcional) `as-tools.algosentido.com/mcp` puede quedar como redirect

---

## Recursos externos

- [MCP spec](https://modelcontextprotocol.io)
- [@modelcontextprotocol/sdk (Node)](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [OAuth 2.1 + DCR](https://datatracker.ietf.org/doc/html/rfc7591)
- `docs/MCP_RESEARCH_NOTES.md` — la investigación inicial (55KB), referencia histórica
