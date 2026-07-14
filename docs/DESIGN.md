# Sistema de diseño — "Sala de edición" (rebrand 2026)

Identidad visual de AS Tools / **AlgoSentido · Estudio**. Dirección aprobada: la marca de
algosentido.com en negativo permanente — la app vive en oscuro como una suite de edición,
con el azul de marca como luz de señal. El modo claro existe y se cuida, pero el oscuro es
el modo por defecto.

**Regla de oro: esto es SOLO capa visual.** Prohibido tocar lógica, handlers, contexts,
endpoints, props funcionales o estados. Si un cambio visual exige tocar lógica, se anota y
se pregunta.

## Marca

- Wordmark: `AlgoSentido` (sin espacio visual real: "Algo" en tinta + "Sentido" en azul) +
  sufijo `ESTUDIO` pequeño en tracking amplio. Componente: `src/components/Wordmark.jsx`.
  Nunca recrear el wordmark a mano: importar el componente.
- Dispositivo de kicker/eyebrow: texto corto uppercase con línea azul a la izquierda
  (clase `.eyebrow`). Se usa para rotular secciones y pasos ("PASO 1 DE 3", "TUS RESULTADOS").
- Flecha `→` en CTAs de avance ("Continuar →", "Abrir →"). Literal en el texto, no un SVG.
- Un solo acento: el azul. Los gradientes por herramienta (purple→indigo, pink→orange,
  amber→rose, violet→fuchsia, emerald→teal, rose→pink) desaparecen. El color restante en
  pantalla es semántico (ok/warn/danger) o es contenido (video, thumbnails, captions).

## Tokens (definidos en tailwind.config.js)

Neutrales tinta (cálidos, NO gray de Tailwind):

| Token | Hex | Uso |
|---|---|---|
| `ink-950` | #0D0B0C | Fondo dark base · texto principal light |
| `ink-900` | #131011 | Fondo dark alterno (inputs, wells) |
| `ink-850` | #161314 | Superficie card dark |
| `ink-800` | #1C1819 | Superficie elevada dark (hover, modal) |
| `ink-700` | #2A2526 | Hairline/bordes dark |
| `ink-600` | #3A3436 | Borde hover / disabled dark |
| `ink-500` | #6E6668 | Texto muted (light mode) |
| `ink-400` | #9C9396 | Texto secundario (dark mode) |
| `ink-300` | #C9C3BE | Texto deshabilitado light |
| `ink-200` | #E4E0DC | Hairline/bordes light |
| `ink-100` | #EFECE8 | Superficie sutil light (wells) |
| `ink-50`  | #F5F3F0 | Fondo light base |
| `paper`   | #F2EFEA | Texto principal en dark (blanco roto) |

Acento y semánticos (cada uno con par claro/oscuro):

| Token | Hex | Uso |
|---|---|---|
| `accent` | #1B60D4 | Azul marca — modo claro |
| `accent-bright` | #5B95FF | Azul marca — modo oscuro |
| `accent-soft` | #EAF1FC | Fondo chip azul light |
| `accent-deep` | #16233F | Fondo chip azul dark |
| `ok` / `ok-bright` | #3D7A4E / #93B889 | Éxito |
| `ok-soft` / `ok-deep` | #EAF3EC / #16251B | Fondos chip éxito |
| `warn` / `warn-bright` | #A2701F / #E3B86A | Proceso/aviso |
| `warn-soft` / `warn-deep` | #FDF3E3 / #2B2110 | Fondos chip aviso |
| `danger` / `danger-bright` | #B0473B / #E08D82 | Error/destructivo |
| `danger-soft` / `danger-deep` | #FBECEA / #331B18 | Fondos chip error |

Patrón de uso: `text-accent dark:text-accent-bright`, `bg-accent-soft dark:bg-accent-deep`.

## Tipografía

- `font-sans` (Inter) — cuerpo, formularios, tablas.
- `font-display` (Archivo, ya self-hosteada) — titulares h1-h3, wordmark, números grandes.
  Siempre con `font-semibold` (o `font-bold` en h1) y `tracking-tight`.
- `font-mono` — timecodes, costos, IDs, contadores. Siempre con `tabular-nums`
  (la clase `.timecode` ya lo incluye).
- Jerarquía de página: eyebrow arriba, h1 `font-display text-2xl md:text-3xl font-bold
  tracking-tight`, subtítulo `text-ink-500 dark:text-ink-400`. Los títulos NO llevan
  gradiente ni `bg-clip-text` nunca.

## Primitivas CSS (definidas en src/index.css — usarlas, no reinventar)

- `.btn` — base pill. Variantes: `.btn-primary` (tinta/papel, máxima jerarquía),
  `.btn-accent` (azul, avance de flujo), `.btn-ghost` (hairline), `.btn-danger`.
  Tamaño compacto: añadir `.btn-sm`. Ejemplo: `className="btn btn-accent"`.
- `.input` — campos de texto/select/textarea. Labels: `.form-label`.
- `.card` — superficie con hairline (blanca en light, ink-850 en dark). Padding NO
  incluido: usar `p-5` o `p-6`.
- `.chip` — pill pequeño de estado + variantes `.chip-accent .chip-ok .chip-warn
  .chip-danger .chip-neutral`.
- `.eyebrow` — kicker uppercase con línea azul.
- `.timecode` — mono + tabular-nums.
- `.link-accent` — enlace azul con hover underline.
- `.hairline` — `border-ink-200 dark:border-ink-700` (para divisores).

Pendiente de construir (usar nativo temporal solo si es imprescindible y anotarlo): `promptDialog`
para pedir texto (hoy queda un único `prompt()` en `ClipEditor.jsx` al nombrar una plantilla).

## Receta: construir una pantalla nueva

El camino feliz para que una pantalla nazca ya en el sistema, sin decisiones sueltas:

```jsx
import { useToast, useConfirm } from '../components/ui/feedback';

function MiHerramienta() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  return (
    <div className="flex flex-col gap-8 max-w-3xl mx-auto py-4">
      {/* 1. Header de página: eyebrow + h1 display + subtítulo muted */}
      <header className="flex flex-col gap-2">
        <span className="eyebrow">De X a Y</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          Título en una frase
        </h1>
        <p className="text-ink-500 dark:text-ink-400">Subtítulo que dice qué hace.</p>
      </header>

      {/* 2. Contenido en cards con primitivas */}
      <section className="card p-6 flex flex-col gap-4">
        <label className="form-label" htmlFor="url">Pega el enlace</label>
        <input id="url" className="input" placeholder="https://…" />
        <div className="flex items-center gap-2">
          <span className="chip chip-warn">Procesando</span>
          <span className="timecode text-ink-500 dark:text-ink-400">00:42 · $0.004</span>
        </div>
        <button className="btn btn-accent self-start" onClick={() => toast('Listo', { type: 'ok' })}>
          Generar →
        </button>
      </section>
    </div>
  );
}
```

Reglas del camino feliz:
- Encabezado de página alineado a la izquierda (el hub centrado es la excepción).
- Toda acción destructiva pasa por `await confirmDialog({ danger: true })`; todo aviso por `toast()`.
- Números (tiempos, costos, contadores) en `.timecode` o `font-mono tabular-nums`.
- Un solo botón de máxima jerarquía por vista (`btn-primary` o `btn-accent`); el resto `btn-ghost`.
- Si la pantalla muestra/edita video, su superficie es `bg-ink-950` en ambos temas.

## Mapeo mecánico antes → después

| Antes (patrón actual) | Después |
|---|---|
| `bg-white dark:bg-gray-800 rounded-xl shadow-md/lg` | `card` (+ `p-6`) |
| `bg-gray-50 dark:bg-gray-900` (fondos de página) | quitar — el body ya pinta el fondo |
| `bg-gray-100 dark:bg-gray-700` (wells internos) | `bg-ink-100 dark:bg-ink-900` |
| `text-gray-900 dark:text-white` | `text-ink-950 dark:text-paper` (o quitar: es el color base del body) |
| `text-gray-600/500 dark:text-gray-300/400` | `text-ink-500 dark:text-ink-400` |
| `border-gray-200/300 dark:border-gray-600/700` | `border-ink-200 dark:border-ink-700` |
| `bg-purple-600 hover:bg-purple-700 text-white … rounded-lg` (botón CTA) | `btn btn-accent` (avance) o `btn btn-primary` (acción principal única) |
| Botón secundario gris | `btn btn-ghost` |
| Botón rojo destructivo | `btn btn-danger` (o `btn-ghost` + texto danger si es menor) |
| `text-purple-600 dark:text-purple-400` (links/activos) | `text-accent dark:text-accent-bright` |
| `bg-purple-50 dark:bg-purple-900/20` (item activo nav/tab) | `bg-accent-soft dark:bg-accent-deep text-accent dark:text-accent-bright` |
| `focus:ring-purple-500` | ya lo trae `.input`/`.btn`; si es a mano: `focus:ring-accent dark:focus:ring-accent-bright` |
| Gradientes de título `bg-gradient-to-r … bg-clip-text` | `font-display font-bold tracking-tight` color normal |
| Iconos con fondo gradiente por herramienta | fondo `bg-ink-100 dark:bg-ink-800` + icono `text-accent dark:text-accent-bright` |
| Badges de estado ad-hoc (`bg-green-100 text-green-800`…) | `chip chip-ok` / `chip-warn` / `chip-danger` / `chip-neutral` |
| `rounded-lg` en cards/modales | `rounded-2xl` (cards) · botones son pill vía `.btn` |
| `shadow-lg/xl` decorativos | quitar (hairline hace el trabajo); modales: `shadow-2xl` permitido |
| Timestamps/costos/contadores | envolver en `.timecode` o `font-mono tabular-nums` |
| `alert('…')` | `toast('…', { type: 'ok'|'warn'|'danger' })` de `useToast()` |
| `confirm('…')` | `await confirmDialog({ title, message, danger })` de `useConfirm()` |

`useToast`/`useConfirm` viven en `src/components/ui/feedback.jsx`. `confirmDialog`
devuelve `Promise<boolean>` — el call site debe ser `async` (si la función que contiene el
`confirm()` no es async, hacerla async es aceptable: no cambia la semántica de un handler
de evento).

## Patrones de página

- **Header de página**: eyebrow + h1 display + subtítulo muted, alineado a la izquierda
  (el hub centrado es la excepción). Sin iconos decorativos gigantes.
- **Pasos de flujo** (Clips/Reels): eyebrow "PASO N DE M · NOMBRE".
- **Superficies de video** (players, editores, timelines): SIEMPRE fondo oscuro aunque el
  modo sea claro — `bg-ink-950` con controles `text-paper`. El video se edita sobre oscuro.
- **Modales**: overlay `bg-ink-950/80 backdrop-blur-sm`, panel `card` + `rounded-2xl
  shadow-2xl`, título display, acciones en pills a la derecha.
- **Tablas admin**: header `text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400`,
  filas con `divide-y` hairline, números en mono tabular.
- **Estados vacíos**: eyebrow + una frase humana + CTA ghost. Sin ilustraciones genéricas.
- **Progreso**: barra fina (`h-1.5`) `bg-ink-200 dark:bg-ink-700` con fill
  `bg-accent dark:bg-accent-bright`; porcentaje en mono. Sin gradientes animados.

## Copy de interfaz

Español neutro (tú/tienes — jamás voseo), directo y humano, estilo algosentido.com:
frases cortas, cero jerga técnica innecesaria, sin signos de exclamación gratuitos.
Los CTAs dicen lo que hacen: "Transcribir →", "Generar clips →", "Copiar transcripción".
No cambiar textos que describen funcionalidad (tooltips de costos, avisos legales).

## Intocables (NO modificar bajo ninguna circunstancia)

1. `src/components/LiveCaptionOverlay.jsx` — el interior del overlay WYSIWYG (calibrado
   1:1 con libass). Solo puede cambiar el chrome EXTERNO alrededor del player.
2. `src/templates/captionTemplates.js`, `FONT_CATALOG` y las paletas de tonos/colores que
   se ofrecen como opciones de subtítulo en ClipEditor/Reels: son CONTENIDO del video del
   usuario, no UI. Los swatches muestran esos colores tal cual; solo se restyliza el chrome
   del picker (bordes, labels, layout).
3. El bloque `@font-face` de `src/index.css`.
4. Cualquier `style={}` inline que posicione/dimensione captions, crops, timelines o
   previews de video (son cálculos funcionales).
5. Lógica: imports no visuales, hooks, handlers, fetch, contexts, rutas.

## Verificación por archivo

Tras restylizar un archivo: (1) cero ocurrencias de `purple|indigo|violet|fuchsia` y de
gradientes de marca viejos; (2) los `gray-*` restantes solo si son deliberados (raro);
(3) ambos modos revisados mentalmente contra los tokens; (4) `npm test` no se rompe
(los tests no tocan UI, pero un import roto sí los rompe).
