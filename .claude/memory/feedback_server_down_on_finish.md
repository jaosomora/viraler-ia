---
name: server-down-on-finish
description: "Al terminar cualquier trabajo, dejar el dev server APAGADO"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fd50bf71-e49f-4a6e-8bea-7c7d1460bcfc
---

Siempre que se termina un trabajo, se deja el servidor **abajo** (apagado). No dejar dev
servers corriendo al cerrar una tarea.

**Why:** Julián no quiere procesos colgados consumiendo puertos/recursos entre sesiones;
prefiere levantar el entorno a demanda cuando va a probar.

**How to apply:** Como último paso de cada trabajo, cerrar los servidores levantados
(`preview_stop` de los serverId, o matar los procesos de `:3000`/`:5173`). Verificar que
los puertos quedaron libres. Levantar de nuevo solo cuando haga falta verificar algo.

Relacionado: [[testing-method]] (el server se levanta para el bucle de verificación y se
baja al cerrar).
