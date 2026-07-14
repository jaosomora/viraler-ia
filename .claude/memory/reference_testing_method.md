---
name: testing-method
description: "Método de pruebas de AS Tools — usuarios de prueba, login por token, regla de navegador"
metadata: 
  node_type: memory
  type: reference
  originSessionId: fd50bf71-e49f-4a6e-8bea-7c7d1460bcfc
---

Julián quiere **siempre** tener usuarios de prueba listos y un método de pruebas claro,
documentado, incluyendo cómo ingresar vía herramientas de navegación para verificar bugs.
Todo vive en `docs/TESTING.md` del repo. Resumen operativo:

- `npm run seed:test` — siembra 3 fixtures deterministas (solo dev, aborta en prod).
  Contraseña común `Prueba1234`. Usuarios: `test.owner@algosentido.dev` (owner),
  `test.cliente@algosentido.dev` (member activo), `test.expirado@algosentido.dev`
  (acceso vencido a propósito, para probar ese camino).
- `npm run test:token <email>` — obtiene un JWT pidiéndoselo al backend (POST login), e
  imprime el snippet `localStorage.setItem('token',…);location.reload()` para pegar en la
  consola del navegador → login SIN teclear contraseña. Es el método por defecto para que
  Claude verifique con el navegador.
- **Gotcha JWT**: en dev el backend usa el secreto de fallback (importa auth.js antes de
  cargar dotenv), así que NO firmar tokens localmente asumiendo `.env`; siempre usar
  `test:token`. En prod Render inyecta JWT_SECRET real y no pasa.
- **Regla de navegador**: QA de la app (localhost) → navegador automatizado (Browser pane /
  agent-browser CLI), no toca el Chrome personal. Claude in Chrome solo para sesiones reales
  de Julián (dashboard Render, prod tras SSO). Ver también su regla global en ~/.claude/CLAUDE.md.
- Dev server: dos configs en `.claude/launch.json` (backend 3000 + frontend 5173) para
  evitar la colisión de PORT. Frontend en dev llama a localhost:3000.

Relacionado: [[rebrand-sala-edicion]] (el bucle de verificación se usa para validar la UI).
