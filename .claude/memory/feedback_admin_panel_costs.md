---
name: AdminPanel siempre refleja costos reales
description: Toda herramienta nueva con costo externo (LLM, API) debe enchufarse en el AdminPanel — Resumen (card de costo total + tarjeta propia + Modelos de IA + tabla de historial) + tab propio si aplica
type: feedback
originSessionId: 6292e38e-9b58-4326-ae43-c422a72fc739
---
Cada vez que se agregue una herramienta nueva que consuma API externa (OpenAI, Anthropic, Whisper, etc.), el AdminPanel debe quedar actualizado en el mismo commit, no como afterthought. Específicamente:

1. **Tabla `usage_stats`**: agregar columnas `<tool>` (contador) y `<tool>_cost` (costo agregado).
2. **`generateUsageReport()` en `api/utils/usageTrackerSQLite.js`**: incluir las nuevas columnas en el SELECT total + en el SELECT de historial reciente.
3. **AdminPanel.jsx — tab Resumen**:
   - Card "Costo total acumulado": sumar `totalXxxCost` al `formatPrice(...)` y agregar mini-card en la grid de breakdown.
   - Grid "Tarjetas de resumen": agregar una tarjeta con contador + costo.
   - Sección "Modelos de IA en uso": agregar card con modelo, precio y nota de costo por unidad.
   - Tabla "Historial de uso reciente": agregar columna nueva en el header, sumar al `empty()`, agregar al forEach, mostrar la celda, sumar al costo total de fila.
4. **AdminPanel.jsx — tabs**: agregar tab propio con icono apropiado si la herramienta tiene jobs/resultados navegables (ej. 💡 Mapas, 🎬 Clips). Crear componente `<X>Admin.jsx` con stats + tabla.
5. **MyResults.jsx**: agregar tab con componente `Saved<X>.jsx` para que el usuario final vea sus propios resultados.

**Why:** El owner mide costos reales en una sola pantalla. Si una herramienta nueva queda fuera del AdminPanel, los costos se pierden y la app aparenta gastar menos de lo que gasta — el peor tipo de bug (silencioso, contable). Pasó en la primera entrega de build_idea_map: agregué tab propio pero olvidé enchufar costos en el card unificado.

**How to apply:** Antes de marcar una herramienta como "lista", correr este checklist mental: ¿se ve el contador en Resumen? ¿se ve el costo en la card unificada? ¿la columna está en el historial reciente? ¿hay tab propio para ver jobs? Si la respuesta a alguna es "no", no está lista.
