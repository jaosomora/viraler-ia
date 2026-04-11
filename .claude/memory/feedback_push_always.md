---
name: Siempre push a main y develop
description: Al terminar cambios, push a main y develop para sincronizar entre dispositivos
type: feedback
---

Siempre hacer push a main Y develop después de cada commit. Julian cambia de máquina constantemente y necesita todo arriba.

**Why:** Julian trabaja desde múltiples computadores y necesita que el código esté siempre actualizado en el remoto.
**How to apply:** Después de cada commit, ejecutar `git push origin main && git push origin main:develop`.
