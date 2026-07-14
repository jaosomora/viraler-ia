---
name: No usar español argentino — nunca
description: Prohibido voseo y formas argentinas en TODO output (chat, UI, prompts, copy, docs). Usar español neutro/colombiano (tú, tienes, haces, sabes)
type: feedback
originSessionId: 6292e38e-9b58-4326-ae43-c422a72fc739
---
Nunca usar español argentino. Esto aplica a:
- **Respuestas en chat al usuario** (lo más obvio).
- **UI / copy de la app** — botones, placeholders, mensajes de error, headers, descripciones de tools, panels de admin. CUALQUIER texto que el usuario o un cliente vea en pantalla.
- **Prompts del sistema** que se mandan a LLMs — porque el LLM imita el registro y el output al usuario final hereda el voseo.
- **Comentarios de código** (no es lo más importante pero sé consistente).
- **Documentación** (README, MCP.md, CHANGELOG).

Formas prohibidas y su reemplazo neutro:

| Argentino | Neutro/colombiano |
|---|---|
| vos | tú |
| hacés, tenés, querés, sabés, podés, decís, escribís | haces, tienes, quieres, sabes, puedes, dices, escribes |
| hacé, mirá, fijate, decime, contame, dejá, andá, escuchá | haz, mira, fíjate, dime, cuéntame, deja, ve, escucha |
| está bueno, te late, qué onda, dale | está bien, te gusta, qué tal, vale/ok |
| acá, allá | aquí, allí |
| pibe, boludo, che | (no usar) |

**Why:** Julián es de Colombia, su audiencia es de Colombia, el copy en español argentino suena fuera de lugar y rompe la voz de la marca. Pasó dos veces en sesiones distintas (en placeholders de UI y en system prompts del Generador de Ideas), suficiente para ser un patrón.

**How to apply:** Antes de generar cualquier texto en español, hacer un pass mental por voseo. Antes de commitear texto en español, grep mental por "vos|hacés|querés|tenés|podés|decís|sabés|escribís|fijate|contame|decime|mirá|dale|acá|allá". Si aparece, reescribir.
