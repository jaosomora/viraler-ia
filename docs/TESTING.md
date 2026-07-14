# Método de pruebas — AS Tools

Cómo se prueba y verifica esta app de forma reproducible: usuarios de prueba listos,
login sin fricción para automatización, y la regla de qué herramienta de navegador usar.
Objetivo: que cualquier sesión (humana o de Claude) pueda reproducir un bug o validar un
flujo en minutos, sin adivinar credenciales ni tocar cuentas reales.

## 1. Levantar el entorno local

Dos procesos, en puertos separados (backend 3000, frontend 5173):

```bash
npm run dev        # frontend (vite :5173) + backend (nodemon :3000) juntos
```

O por separado si necesitas aislar uno:

```bash
npm run dev:backend    # Express en :3000
npm run dev:frontend   # Vite en :5173
```

Verifica que el backend responde: `curl -s -o /dev/null -w "%{http_code}\n"
http://localhost:3000/api/health` debe dar `200`. El frontend en dev llama al backend en
`http://localhost:3000` (hardcodeado en `src/services/api.js` para modo development).

> **Nota para herramientas de navegación**: usa `http://localhost:5173`. Si el navegador
> cae a IPv6 y algo se comporta raro, prueba `http://127.0.0.1:5173`. Nunca levantes el
> dev server con una sola config que inyecte `PORT` (colisiona backend/frontend); usa
> `.claude/launch.json`, que ya trae `as-tools-backend` (3000) y `as-tools-frontend` (5173)
> como configs separadas.

## 2. Usuarios de prueba

Deterministas e idempotentes. Se crean/reset con un comando:

```bash
npm run seed:test
```

| Email | Rol | Acceso | Para qué |
|---|---|---|---|
| `test.owner@algosentido.dev` | owner | sin límite | Ver todo, incluido `/admin` |
| `test.cliente@algosentido.dev` | member | activo (+1 año) | Experiencia de cliente normal |
| `test.expirado@algosentido.dev` | member | **vencido a propósito** | Probar el camino "acceso expirado" |

Contraseña común (fixture desechable, solo dev): **`Prueba1234`**.

`seed:test` **aborta si `NODE_ENV=production`** — nunca toca la BD de producción. Los
usuarios viven solo en el SQLite local `./data/as-transcribe.db`.

## 3. Iniciar sesión

### 3a. Por token — método por defecto para automatización (sin teclear contraseña)

Preferido cuando Claude verifica con herramientas de navegación. El token lo **firma el
backend** (login programático), así que siempre valida contra ese backend:

```bash
npm run test:token test.owner@algosentido.dev     # o el email que quieras
```

Imprime un JWT y un snippet listo para pegar en la **consola del navegador** en el origen
de la app (`http://localhost:5173`):

```js
localStorage.setItem('token','<JWT>');location.reload()
```

Al recargar, `AuthContext` toma el token de `localStorage['token']`, lo valida contra
`/api/auth/me` y entra autenticado. Es el único `localStorage` que necesita la sesión.

Contra otro entorno: `BASE=https://as-tools.algosentido.com npm run test:token <email>`
(requiere que ese backend esté vivo y que el usuario exista allí).

### 3b. Por formulario — para un humano o para probar el propio flujo de login

Entra en `http://localhost:5173`, pestaña "Iniciar sesión", con el email y `Prueba1234`.
El **Magic link** también funciona en dev (si hay `RESEND_API_KEY`; si no, el link sale en
la consola del backend).

### 3c. Probar el camino de acceso vencido

Usa `test.expirado@algosentido.dev` en el formulario de login: el backend debe rechazarlo
con el mensaje de expiración. `test:token` sobre ese usuario falla a propósito (login
rechazado) — es la señal de que la protección de expiración funciona.

## 4. El bucle de verificación (cómo se valida un cambio o se caza un bug)

1. `npm run dev` (o levantar backend+frontend con `.claude/launch.json`).
2. `npm run seed:test` una vez (idempotente; repetir si dudas del estado).
3. `npm run test:token <email>` → pegar el snippet en la consola del navegador → sesión lista.
4. Conducir el flujo con las herramientas de navegación (click/escribir), y revisar
   **consola** y **network** para errores. Para cambios de UI, screenshot en claro **y**
   oscuro (toggle sol/luna del header) y en móvil si el layout cambió.
5. Si hay bug: leer el código, arreglar el fuente, y repetir desde el paso 4.
6. Antes de commitear: `npm test` (292+ tests, <1s) y, si tocaste MCP, `npm run smoke:mcp`.

Nunca pedir "revisa tú manualmente": verificar y mostrar la prueba (screenshot / respuesta
de red / log).

## 5. Qué herramienta de navegador usar

Hay dos, y la regla de decisión es:

**Automatización / QA reproducible (por defecto en este proyecto)** — la app corre en
localhost, sin cuentas externas. Usar el **navegador automatizado** (el Browser pane de la
sesión, o `agent-browser` por CLI vía Bash):
- Testing automatizado, QA visual o verificación de deploys
- Screenshots reproducibles (mobile/desktop, full-page)
- Flujos repetitivos sobre múltiples URLs
- No toca el Chrome personal de Julián

**Claude in Chrome** — solo cuando la tarea necesita una cuenta donde Julián ya está
logueado o su navegador real:
- Cuentas con sesión activa (Gmail, cal.com, Vercel, Systeme.io, Notion, Drive, Instagram…)
- Ver el resultado en su navegador real
- Acciones puntuales, exploratorias o manuales
- Ejemplos en este proyecto: revisar el **dashboard de Render**, o producción detrás de su SSO.

Si hay duda entre las dos, preguntar antes de elegir.

## 6. Nota técnica: JWT_SECRET en dev

`server.js` importa `api/auth.js` (que captura `JWT_SECRET` al evaluarse) **antes** de que
`dotenv.config()` cargue el `.env`. Por eso, en **dev local** el backend usa el secreto de
fallback hardcodeado, no el de `.env`. En **producción** no pasa: Render inyecta `JWT_SECRET`
como variable de entorno real, presente antes de arrancar el proceso.

Consecuencia práctica: **no firmes tokens de prueba localmente asumiendo el `.env`** — usa
`npm run test:token`, que pide el token al propio backend vía login y por eso siempre
coincide. (Arreglo opcional pendiente: mover la carga de dotenv al tope de `server.js`
—`import 'dotenv/config'` como primer import— para que dev respete el `JWT_SECRET` del
`.env`. No es bloqueante y cambia el secreto de sesiones dev existentes, por eso se deja
como decisión aparte.)
