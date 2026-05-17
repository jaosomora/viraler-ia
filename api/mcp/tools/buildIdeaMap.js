// api/mcp/tools/buildIdeaMap.js
// Cuando este tool se llama desde el MCP (cliente = Claude.ai), NO ejecutamos gpt-4o-mini.
// Devolvemos el LENS completo + las dos columnas crudas + el historial de intentos previos,
// para que el propio Claude del chat aplique la compuerta y, si pasa, genere las ideas.
//
// La REST API /api/idea-maps (UI web) sí ejecuta gpt-4o-mini en backend con prompts dedicados
// y persiste el estado en DB. Esto es solo para el cliente MCP.

import { z } from 'zod';
import {
  LENS, MAX_ATTEMPTS_PER_FILTER, MAX_TOTAL_TURNS, MIN_INPUT_CHARS, EXHAUSTED_MESSAGE,
} from '../../services/ideaMapService.js';

export const requiredScope = 'ideas:write';

export const description =
  'Generador de ideas para creadores de contenido. Recibe dos columnas crudas en escenas concretas ' +
  '(vida que NO quiere y vida que SÍ quiere) y devuelve un LENTE de trabajo que TÚ (Claude) aplicas en este chat.\n\n' +

  'NO ejecuta ningún LLM en el servidor — el razonamiento (extraer territorios, aplicar la compuerta de 3 fallos, ' +
  'generar las 4-5 ideas con torsión) lo haces tú mismo siguiendo el LENTE. Sin costo OpenAI.\n\n' +

  'CÓMO USAR EL RESULTADO (importante):\n' +
  '1. Lee el bloque "LENTE" → es el método completo + las 3 reglas de la compuerta + el formato de salida.\n' +
  '2. Lee "INPUTS" → las dos columnas crudas + historial de intentos previos en este mismo mapa.\n' +
  '3. Aplica el LENTE: intenta extraer territorios del texto. Si tropiezas con Fallo 1 (sentimiento en vez de escena) o Fallo 2 (eje único disfrazado), NO generes ideas — devuélvele al usuario el repregunta exacto que pide el LENTE. Si el último turno fue una respuesta a Fallo 2, verifica Fallo 3 (la fuga) antes de avanzar.\n' +
  '4. Solo si el insumo pasa los tres filtros, genera 4-5 ideas crudas con torsión.\n' +
  '5. Respeta los límites: máximo ' + MAX_ATTEMPTS_PER_FILTER + ' repreguntas por filtro, máximo ' + MAX_TOTAL_TURNS + ' turnos totales. Si se agota, corta con: "' + EXHAUSTED_MESSAGE + '"\n' +
  '6. La compuerta es el producto, no un caso de error. Negarse a generar cuando el insumo está roto es la feature principal.\n\n' +

  'PARA SEGUIR LA CONVERSACIÓN: si el usuario responde a tu repregunta, vuelve a llamar este tool con el array prior_attempts actualizado (agregando el filtro que rechazaste, tu repregunta literal y la respuesta nueva del usuario). El servidor es stateless — TÚ mantienes el hilo.\n\n' +

  'Usa este tool cuando el usuario pida: "ayúdame a generar ideas para mis videos", "tengo bloqueo creativo", ' +
  '"quiero hacer mi mapa de ideas", "ideas que suenen a mí". NO uses para analizar videos ajenos (eso es analyze_ideas).';

export const annotations = {
  title: 'Generador de Ideas (compuerta + cruces)',
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

export const inputSchema = {
  vida_no_quiero: z.string().min(MIN_INPUT_CHARS).describe(
    'Texto crudo del usuario describiendo la vida que NO quiere, en escenas concretas (qué hace un martes, con quién, qué trabajo, a qué le dijo sí, a qué le dijo no). ' +
    'NO sentimientos ni adjetivos abstractos. Si el usuario te escribe sentimientos, pásalos tal cual — la compuerta del LENTE los rechazará y te dirá qué pedirle.'
  ),
  vida_si_quiero: z.string().min(MIN_INPUT_CHARS).describe(
    'Texto crudo del usuario describiendo la vida que SÍ quiere, mismo criterio que el campo anterior.'
  ),
  prior_attempts: z.array(z.object({
    filter: z.enum(['fallo_1', 'fallo_2', 'fallo_3']).describe('Cuál de los tres fallos detectaste en el turno previo.'),
    repregunta: z.string().describe('Tu repregunta literal del turno previo.'),
    user_response: z.string().describe('Lo que el usuario respondió a esa repregunta.'),
  })).describe(
    'Historial de intentos previos en este mismo mapa. Vacío en el primer call. ' +
    'En cada llamada subsecuente, agrega el filtro que rechazaste, tu repregunta y la respuesta del usuario. ' +
    'Sin esto, no sabrás cuántas repreguntas llevas por filtro ni si el usuario está fugando.'
  ),
};

export function makeHandler(/* user */) {
  return async (args) => {
    const { vida_no_quiero, vida_si_quiero, prior_attempts } = args;

    // Contar intentos por filtro para informar al cliente cuántas le quedan.
    const counts = { fallo_1: 0, fallo_2: 0, fallo_3: 0 };
    for (const a of prior_attempts) counts[a.filter] = (counts[a.filter] || 0) + 1;
    const turn = prior_attempts.length + 1;
    const exhausted = turn > MAX_TOTAL_TURNS
      || Object.values(counts).some(c => c >= MAX_ATTEMPTS_PER_FILTER + 1);

    if (exhausted) {
      return {
        content: [{
          type: 'text',
          text: `Llegaste al límite de intentos para este mapa.\n\n${EXHAUSTED_MESSAGE}\n\nDile al usuario que cierre esta conversación, trabaje el insumo offline (escribir escenas reales en una hoja, sin pantalla) y vuelva con material más concreto.`,
        }],
        structuredContent: {
          status: 'exhausted',
          reason: 'limits_reached',
          message: EXHAUSTED_MESSAGE,
          turn, attempts_per_filter: counts,
          executed_by: 'claude_in_chat',
          cost_usd: 0,
        },
        isError: true,
      };
    }

    const text = [
      'Generador de Ideas — aplica el LENTE sobre los INPUTS y sigue el flujo. No ejecutes otros tools.',
      '',
      '─── LENTE ───',
      LENS,
      '─── FIN LENTE ───',
      '',
      '─── INPUTS ───',
      `VIDA QUE NO QUIERO (lado izquierdo):\n${vida_no_quiero}`,
      '',
      `VIDA QUE SÍ QUIERO (lado derecho):\n${vida_si_quiero}`,
      '',
      `ESTADO DEL MAPA: turno ${turn} de ${MAX_TOTAL_TURNS}. Intentos usados: fallo_1=${counts.fallo_1}, fallo_2=${counts.fallo_2}, fallo_3=${counts.fallo_3}. Quedan ${MAX_ATTEMPTS_PER_FILTER - counts.fallo_1}/${MAX_ATTEMPTS_PER_FILTER - counts.fallo_2}/${MAX_ATTEMPTS_PER_FILTER - counts.fallo_3} repreguntas por filtro.`,
      '',
      prior_attempts.length === 0
        ? 'PRIMER TURNO — no hay intentos previos. Intenta extraer territorios y aplica los filtros.'
        : 'INTENTOS PREVIOS EN ESTE MAPA:',
      ...prior_attempts.map((a, i) =>
        `  [${i + 1}] Filtro ${a.filter} → tu repregunta: "${a.repregunta}" → usuario respondió: "${a.user_response}"`
      ),
      '─── FIN INPUTS ───',
      '',
      'AHORA: razona en silencio aplicando el LENTE. Decide UNA de tres salidas:',
      '  A) Detectaste Fallo 1/2/3 → entrega al usuario solo el repregunta exacto del LENTE, sin generar ideas. Sin coaching, sin suavizar.',
      '  B) Pasó la compuerta → genera 4-5 frases crudas con torsión (cruces de subtemas distintos, o de caras si es eje único). Sin pulir.',
      '  C) Se agotaron los intentos → entrega el mensaje de corte exacto del LENTE.',
      '',
      'Cuando el usuario te responda a tu repregunta, vuelve a llamar build_idea_map con prior_attempts actualizado.',
    ].join('\n');

    return {
      content: [{ type: 'text', text }],
      structuredContent: {
        status: 'pending_application',
        turn,
        attempts_per_filter: counts,
        attempts_remaining_per_filter: {
          fallo_1: MAX_ATTEMPTS_PER_FILTER - counts.fallo_1,
          fallo_2: MAX_ATTEMPTS_PER_FILTER - counts.fallo_2,
          fallo_3: MAX_ATTEMPTS_PER_FILTER - counts.fallo_3,
        },
        turns_remaining: MAX_TOTAL_TURNS - turn,
        inputs: { vida_no_quiero, vida_si_quiero },
        prior_attempts,
        executed_by: 'claude_in_chat',
        cost_usd: 0,
      },
    };
  };
}
