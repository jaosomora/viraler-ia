// api/services/ideaMapService.test.js
// 10 casos: 6 compuerta (testean que la tool SE NIEGA), 3 generación (testean
// que cuando pasa, genera bien), 1 edge. Mockeamos global fetch — el service
// llama a OpenAI directo, así que interceptamos en esa capa.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  runGate, runGenerate, canStillRepregunta,
  MAX_ATTEMPTS_PER_FILTER, MAX_TOTAL_TURNS,
} from './ideaMapService.js';

// Helper: construye una respuesta OpenAI sintética con el JSON ya armado.
function mockOpenAIResponse(jsonObj, { promptTokens = 800, completionTokens = 200 } = {}) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(jsonObj) } }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    }),
    text: async () => '',
  };
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = vi.fn();
});

// ─── COMPUERTA — 6 casos ─────────────────────────────────────────────────

describe('runGate — compuerta', () => {
  it('E1 Fallo 1 hard: input puro sentimiento → rechazo fallo_1', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      fallo_1: { detected: true, evidence: '"me siento angustiado"', repregunta: 'Esa frase "me siento angustiado", ¿cuándo te pasó exactamente? Escribe ese momento en vez del sentimiento.' },
      fallo_2: { detected: false, axis_candidate: '', evidence: '', repregunta: '' },
      extracted_territorios: [],
      axis_mode: 'multi',
      caras: [],
    }));
    const r = await runGate({
      vida_no_quiero: 'me siento angustiado, sin libertad, atrapado, sin paz, sin sentido y no me reconozco en mi propia vida.',
      vida_si_quiero: 'quiero sentirme libre, en paz, plena, conectada conmigo, sin presión y con espacio para respirar.',
    });
    expect(r.kind).toBe('reject');
    expect(r.failed_filter).toBe('fallo_1');
    expect(r.repregunta).toMatch(/cuándo|momento/i);
  });

  it('E2 Fallo 1 subtle: escena con sentimiento incrustado → rechazo fallo_1', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      fallo_1: { detected: true, evidence: '"los lunes me siento mal"', repregunta: '¿Qué pasa exactamente el lunes? Escribe qué haces, con quién, dónde — no cómo te sentís.' },
      fallo_2: { detected: false, axis_candidate: '', evidence: '', repregunta: '' },
      extracted_territorios: [],
      axis_mode: 'multi',
      caras: [],
    }));
    const r = await runGate({
      vida_no_quiero: 'los lunes me siento mal, los martes no quiero levantarme, me cuesta arrancar la semana, me invade desánimo.',
      vida_si_quiero: 'quiero arrancar la semana con ganas, con motivación, con claridad y con espacio para crear sin presión.',
    });
    expect(r.kind).toBe('reject');
    expect(r.failed_filter).toBe('fallo_1');
  });

  it('E3 Fallo 2 hard: tres territorios colapsan a dinero → rechazo fallo_2 con desacople', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      fallo_1: { detected: false, evidence: '', repregunta: '' },
      fallo_2: {
        detected: true, axis_candidate: 'dinero',
        evidence: 'Trabajo, casa y tiempo libre — los tres colapsan en escasez económica.',
        repregunta: 'Si el dinero estuviera resuelto, fuera de la ecuación para siempre, ¿qué de la vida que NO querés seguiría exactamente igual? Tu cabeza va a querer irse a lo bueno — no la dejes. Quedate en el martes con todo resuelto y buscá una sola cosa que igual te incomode.',
      },
      extracted_territorios: [],
      axis_mode: 'single_pending_desacople',
      caras: [],
    }));
    const r = await runGate({
      vida_no_quiero: 'el martes hago trabajos que no me gustan porque pagan poco, vivo en un barrio que no elegí porque alquilo barato, no salgo a cenar porque no me alcanza.',
      vida_si_quiero: 'el martes hago trabajos que me gusten aunque paguen menos, vivo en un barrio que elegí, salgo a cenar con amigas sin pensar en la cuenta.',
    });
    expect(r.kind).toBe('reject');
    expect(r.failed_filter).toBe('fallo_2');
    expect(r.axis_candidate).toBe('dinero');
    expect(r.repregunta).toMatch(/desacople|resuelto|fuera de la ecuación/i);
  });

  it('E4 Fallo 2 subtle: tres ejes que colapsan a escasez de tiempo → rechazo fallo_2', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      fallo_1: { detected: false, evidence: '', repregunta: '' },
      fallo_2: {
        detected: true, axis_candidate: 'tiempo',
        evidence: 'Salud, vida social y proyectos personales — los tres colapsan en falta de horas.',
        repregunta: 'Si tuvieras todo el tiempo del mundo, ¿qué de la vida que NO querés seguiría igual?',
      },
      extracted_territorios: [],
      axis_mode: 'single_pending_desacople',
      caras: [],
    }));
    const r = await runGate({
      vida_no_quiero: 'no entreno porque no tengo tiempo, no veo a mis amigos porque no me da el día, mi proyecto personal lleva 2 años parado por falta de horas.',
      vida_si_quiero: 'entreno tres veces por semana, ceno con amigos los jueves, tengo cuatro horas semanales para mi proyecto.',
    });
    expect(r.kind).toBe('reject');
    expect(r.failed_filter).toBe('fallo_2');
    expect(r.axis_candidate).toBe('tiempo');
  });

  it('E5 Fallo 3 hard: tras Fallo 2, respuesta utópica → rechazo fallo_3 con repregunta dura', async () => {
    // El runGate hace 2 llamadas en este caso: primero la compuerta normal, luego el detector de fuga.
    globalThis.fetch
      .mockResolvedValueOnce(mockOpenAIResponse({
        fallo_1: { detected: false, evidence: '', repregunta: '' },
        fallo_2: { detected: false, axis_candidate: '', evidence: '', repregunta: '' },
        extracted_territorios: [{ nombre: 'placeholder', subtemas: ['a'], punto_a: 'x', punto_b: 'y' }],
        axis_mode: 'multi',
        caras: [],
      }))
      .mockResolvedValueOnce(mockOpenAIResponse({
        es_fuga: true,
        evidence: 'Respuesta: "viajaría, crearía, fluiría" — lenguaje de vida buena, no de incomodidad residual.',
        repregunta_dura: 'Eso es la vida buena. La pregunta era al revés — con todo eso ya pasando, ¿qué te sigue picando? Una sola cosa, aunque sea minúscula.',
      }));
    const r = await runGate({
      vida_no_quiero: 'trabajo full time en algo que no elijo, vivo en una ciudad que no me gusta, no veo casi a mi familia.',
      vida_si_quiero: 'trabajo medio tiempo en lo mío, vivo en el sur, voy a ver a mi familia cada dos meses.',
      prior_attempts: [{
        filter: 'fallo_2',
        repregunta: 'Si el dinero estuviera resuelto, ¿qué de la vida que NO querés seguiría igual?',
        user_response: 'Entonces todo estaría bien, viajaría por el mundo, crearía sin parar, fluiría.',
      }],
    });
    expect(r.kind).toBe('reject');
    expect(r.failed_filter).toBe('fallo_3');
    expect(r.repregunta).toMatch(/vida buena|te sigue|incomod/i);
  });

  it('E6 Fallo 3 honesto: tras Fallo 2 y 2 repreguntas, respuesta "no queda nada" → canStillRepregunta detecta agotamiento', () => {
    // canStillRepregunta es puro, no necesita mock.
    const room = canStillRepregunta({
      attempts_per_filter: { fallo_2: 2 },
      failed_filter: 'fallo_2',
      turn: 3,
    });
    expect(room.ok).toBe(false);
    expect(room.reason).toBe('max_attempts_per_filter');

    // También chequeamos el límite de turnos totales.
    const room2 = canStillRepregunta({
      attempts_per_filter: { fallo_1: 1 },
      failed_filter: 'fallo_1',
      turn: MAX_TOTAL_TURNS,
    });
    expect(room2.ok).toBe(false);
    expect(room2.reason).toBe('max_turns_reached');

    // Caso positivo: hay margen.
    const room3 = canStillRepregunta({
      attempts_per_filter: { fallo_1: 0 },
      failed_filter: 'fallo_1',
      turn: 1,
    });
    expect(room3.ok).toBe(true);
  });
});

// ─── GENERACIÓN — 3 casos ────────────────────────────────────────────────

describe('runGate + runGenerate — cuando pasa', () => {
  it('E7 Multi-eje legítimo: tres territorios distintos → pass, axis_mode=multi', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      fallo_1: { detected: false, evidence: '', repregunta: '' },
      fallo_2: { detected: false, axis_candidate: '', evidence: '', repregunta: '' },
      extracted_territorios: [
        { nombre: 'trabajo', subtemas: ['horario', 'autonomía'], punto_a: 'oficina 9-18', punto_b: 'remoto por proyectos' },
        { nombre: 'cuerpo', subtemas: ['descanso', 'movimiento'], punto_a: 'duermo 5h', punto_b: 'duermo 7h y entreno' },
        { nombre: 'vínculos', subtemas: ['pareja', 'amigos'], punto_a: 'casi no veo a nadie', punto_b: 'cena semanal con amigos' },
      ],
      axis_mode: 'multi',
      caras: [],
    }));
    const r = await runGate({
      vida_no_quiero: 'trabajo en oficina de 9 a 18, duermo 5 horas, no veo a mis amigos hace meses, los fines de semana me caigo agotado.',
      vida_si_quiero: 'trabajo remoto por proyectos, duermo 7 horas y entreno, ceno con amigos los jueves, los sábados estoy con energía.',
    });
    expect(r.kind).toBe('pass');
    expect(r.axis_mode).toBe('multi');
    expect(r.structure.extracted_territorios).toHaveLength(3);
  });

  it('E8 Eje único legítimo con caras: dinero confirmado → pass, axis_mode=single_with_caras', async () => {
    // 2 llamadas: 1) gate (devuelve pass con caras), 2) fuga detector (es_fuga=false porque la respuesta fue honesta).
    globalThis.fetch
      .mockResolvedValueOnce(mockOpenAIResponse({
        fallo_1: { detected: false, evidence: '', repregunta: '' },
        fallo_2: { detected: false, axis_candidate: '', evidence: '', repregunta: '' },
        extracted_territorios: [],
        axis_mode: 'single_with_caras',
        caras: [
          { nombre: 'sostener', subtemas: ['no fallarle a la familia', 'no quedarme sin red'] },
          { nombre: 'elegir', subtemas: ['decirle no a clientes que pagan mal', 'tomar pausas'] },
          { nombre: 'desear', subtemas: ['comprar algo sin justificar', 'ahorrar para algo que no es urgencia'] },
        ],
      }))
      .mockResolvedValueOnce(mockOpenAIResponse({
        es_fuga: false, evidence: 'El usuario reconoce que es dinero pero nombra caras distintas — búsqueda honesta.', repregunta_dura: '',
      }));
    const r = await runGate({
      vida_no_quiero: 'tomo trabajos que no quiero porque pagan, no me permito vacaciones, todo lo que gasto lo justifico contra una emergencia futura.',
      vida_si_quiero: 'elijo trabajos por interés, me tomo dos semanas en febrero, compro un libro sin abrir Excel.',
      prior_attempts: [{
        filter: 'fallo_2',
        repregunta: 'Si el dinero estuviera resuelto, ¿qué seguiría igual?',
        user_response: 'Honestamente, casi nada. Es todo dinero. Pero tiene caras distintas: sostener a mi vieja, poder decir no, y permitirme querer cosas.',
      }],
    });
    expect(r.kind).toBe('pass');
    expect(r.axis_mode).toBe('single_with_caras');
    expect(r.structure.caras).toHaveLength(3);
  });

  it('E9 runGenerate produce 4-5 ideas con torsión sin jerga prohibida', async () => {
    globalThis.fetch.mockResolvedValueOnce(mockOpenAIResponse({
      ideas: [
        { texto: 'Te enseñaron a ganarte el descanso. Nadie te dijo que el descanso es lo que te hace ganable.', nota_uso: 'Cruza trabajo:horario con cuerpo:descanso.' },
        { texto: 'No es que no tengas tiempo para tus amigos. Es que pediste un trabajo que te lo come.', nota_uso: 'Cruza trabajo:autonomía con vínculos:amigos.' },
        { texto: 'Dormís 5 horas para producir más y producís menos. El cuerpo te factura antes que el cliente.', nota_uso: 'Cruza cuerpo:descanso con trabajo:autonomía.' },
        { texto: 'No es que tu pareja te reclame tiempo. Es que tu oficina ya se lo cobró por adelantado.', nota_uso: 'Cruza vínculos:pareja con trabajo:horario.' },
      ],
    }));
    const r = await runGenerate({
      axis_mode: 'multi',
      structure: {
        extracted_territorios: [
          { nombre: 'trabajo', subtemas: ['horario', 'autonomía'] },
          { nombre: 'cuerpo', subtemas: ['descanso'] },
          { nombre: 'vínculos', subtemas: ['pareja', 'amigos'] },
        ],
        caras: [],
      },
    });
    expect(r.ideas.length).toBeGreaterThanOrEqual(4);
    expect(r.ideas.length).toBeLessThanOrEqual(5);
    for (const idea of r.ideas) {
      expect(idea.texto).toBeTruthy();
      // Sin jerga de marketing prohibida.
      expect(idea.texto).not.toMatch(/engagement|viralidad|audiencia|espectador/i);
    }
  });
});

// ─── EDGE — 1 caso ───────────────────────────────────────────────────────

describe('canStillRepregunta — edge', () => {
  it('E10 calcula límites correctamente sin tocar OpenAI', () => {
    // 0 intentos, turno 1 → puede.
    expect(canStillRepregunta({ attempts_per_filter: {}, failed_filter: 'fallo_1', turn: 1 }).ok).toBe(true);

    // 1 intento previo, turno 2 → puede 1 más.
    expect(canStillRepregunta({ attempts_per_filter: { fallo_1: 1 }, failed_filter: 'fallo_1', turn: 2 }).ok).toBe(true);

    // 2 intentos previos en el filtro → no puede.
    expect(canStillRepregunta({ attempts_per_filter: { fallo_1: MAX_ATTEMPTS_PER_FILTER }, failed_filter: 'fallo_1', turn: 3 }).ok).toBe(false);
  });
});
