import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const FILTER_LABEL = {
  fallo_1: 'Sentimiento en vez de escena',
  fallo_2: 'Eje único disfrazado',
  fallo_3: 'La fuga',
};

const PLACEHOLDER_TEMA = 'Ej: mi negocio de café de especialidad · ser papá con dos hijos chicos · mi curso de escritura · vivir con ansiedad sin medicarme';

const PLACEHOLDER_NO = `Escenas concretas, no sentimientos.
Ej (negocio): Los lunes mando una propuesta y el cliente responde "lo pienso" y no vuelve. Mi web tiene 5 menús y un visitante nuevo no sabe a dónde ir. Cobro $200 por sesión, atiendo 8 personas a la semana y termino el viernes vacío.
Ej (vida): El martes me levanto a las 7, voy a una oficina, almuerzo solo frente a la pantalla. Le dije sí al ascenso aunque significa viajar más.`;

const PLACEHOLDER_SI = `Mismas escenas pero en cómo quieres que sea.
Ej (negocio): Mando una propuesta y el cliente responde sí o no en 24 horas. Mi web tiene un solo botón y el visitante hace click en 10 segundos. Cobro $500 por programa de 3 meses, atiendo 3 personas y termino con energía.
Ej (vida): El martes trabajo desde casa, hago una caminata, almuerzo con mi pareja, termino a las 6 y leo dos horas.`;

export default function IdeaMapPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(routeId ? 'loading' : 'form'); // form | loading | turn | success | exhausted
  const [tema, setTema] = useState('');
  const [vidaNo, setVidaNo] = useState('');
  const [vidaSi, setVidaSi] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [mapState, setMapState] = useState(null); // último response del backend
  const [response, setResponse] = useState('');

  // Si llegamos con /mapa-de-ideas/:id, cargar el mapa.
  useEffect(() => {
    if (!routeId) return;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/idea-maps/${routeId}`);
        if (!res.ok) throw new Error('No se pudo cargar el mapa');
        const data = await res.json();
        setTema(data.tema || '');
        setVidaNo(data.vida_no_quiero);
        setVidaSi(data.vida_si_quiero);
        if (data.status === 'success') {
          setMapState({
            status: 'success', map_id: data.id, axis_mode: data.axis_mode,
            structure: data.structure, ideas: data.ideas, cost_usd: data.cost_usd,
          });
          setStep('success');
        } else if (data.status === 'exhausted') {
          setMapState({ status: 'exhausted', map_id: data.id, message: 'Esto no se desbloquea con repreguntas. Trabájalo offline antes de volver.' });
          setStep('exhausted');
        } else {
          setMapState({
            status: 'rejected', map_id: data.id, failed_filter: data.failed_filter,
            diagnostic: data.diagnostic, repregunta: data.repregunta,
          });
          setStep('turn');
        }
      } catch (err) {
        setError(err.message);
        setStep('form');
      }
    })();
  }, [routeId]);

  async function submitInitial(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/idea-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, vida_no_quiero: vidaNo, vida_si_quiero: vidaSi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar');
      setMapState(data);
      if (data.status === 'success') setStep('success');
      else if (data.status === 'exhausted') setStep('exhausted');
      else setStep('turn');
      if (data.map_id) navigate(`/mapa-de-ideas/${data.map_id}`, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function submitResponse(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/idea-maps/${mapState.map_id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_response: response }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar respuesta');
      setMapState(data);
      setResponse('');
      if (data.status === 'success') setStep('success');
      else if (data.status === 'exhausted') setStep('exhausted');
      else setStep('turn');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep('form'); setTema(''); setVidaNo(''); setVidaSi(''); setMapState(null);
    setResponse(''); setError(null);
    navigate('/mapa-de-ideas', { replace: true });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <span className="eyebrow">Ideas</span>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
          De tema a frases
        </h1>
        <p className="text-lg text-ink-950 dark:text-paper">
          Ideas para tus publicaciones que suenan a ti, no a cualquier otro creador.
        </p>
        <p className="text-sm text-ink-500 dark:text-ink-400">
          Funciona para lo que quieras comunicar: tu vida, tu negocio, un producto, un servicio. La compuerta se niega a generar si el insumo está roto.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright text-sm">
          {error}
        </div>
      )}

      {step === 'loading' && (
        <div className="text-center py-12 text-ink-500 dark:text-ink-400">Cargando mapa…</div>
      )}

      {step === 'form' && (
        <form onSubmit={submitInitial} className="space-y-5">
          <div className="p-4 rounded-xl bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-sm text-ink-500 dark:text-ink-400">
            <strong className="text-ink-950 dark:text-paper">Cómo escribir esto:</strong> primero el tema sobre el que quieres sacar ideas. Después dos columnas con escenas concretas — qué pasa, con quién, dónde, cuándo, qué se ve. No sentimientos ("me siento sin libertad", "quiero una marca con alma"), no adjetivos abstractos. Si la compuerta detecta sentimientos en vez de escenas, no genera y te pide reescribirlas.
          </div>

          <div>
            <label className="form-label">
              Tema sobre el que quieres sacar ideas
            </label>
            <input
              type="text" value={tema} onChange={e => setTema(e.target.value)}
              placeholder={PLACEHOLDER_TEMA}
              className="input"
              required minLength={5}
            />
            <div className="mt-1.5 text-xs text-ink-400 dark:text-ink-500">
              Puede ser tu vida, tu negocio, un producto, un servicio, una práctica — lo que quieras comunicar.
            </div>
          </div>

          <div>
            <label className="form-label">
              Cómo <span className="chip chip-danger align-middle">NO</span> quieres que sea {tema ? <span className="text-accent dark:text-accent-bright">"{tema}"</span> : 'ese tema'}
            </label>
            <textarea
              value={vidaNo} onChange={e => setVidaNo(e.target.value)}
              placeholder={PLACEHOLDER_NO}
              rows={8}
              className="input"
              required minLength={80}
            />
            <div className="mt-1.5 text-xs text-ink-400 dark:text-ink-500 font-mono tabular-nums">{vidaNo.length} caracteres · mínimo 80</div>
          </div>

          <div>
            <label className="form-label">
              Cómo <span className="chip chip-ok align-middle">SÍ</span> quieres que sea {tema ? <span className="text-accent dark:text-accent-bright">"{tema}"</span> : 'ese tema'}
            </label>
            <textarea
              value={vidaSi} onChange={e => setVidaSi(e.target.value)}
              placeholder={PLACEHOLDER_SI}
              rows={8}
              className="input"
              required minLength={80}
            />
            <div className="mt-1.5 text-xs text-ink-400 dark:text-ink-500 font-mono tabular-nums">{vidaSi.length} caracteres · mínimo 80</div>
          </div>

          <button
            type="submit" disabled={submitting || tema.trim().length < 5 || vidaNo.length < 80 || vidaSi.length < 80}
            className="btn btn-accent w-full"
          >
            {submitting ? 'Procesando…' : 'Empezar el mapa →'}
          </button>
        </form>
      )}

      {step === 'turn' && mapState && (
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-warn-soft dark:bg-warn-deep border border-warn/30 dark:border-warn-bright/30">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wide text-warn dark:text-warn-bright">
                {FILTER_LABEL[mapState.failed_filter] || mapState.failed_filter}
              </span>
              <span className="text-xs text-warn dark:text-warn-bright font-mono tabular-nums">
                {mapState.attempts_remaining_this_filter} repreguntas más en este filtro · {mapState.turns_remaining} turnos totales
              </span>
            </div>
            {mapState.diagnostic && (
              <p className="text-xs text-warn dark:text-warn-bright mb-3 italic">
                {mapState.diagnostic}
              </p>
            )}
            <p className="text-base whitespace-pre-wrap">
              {mapState.repregunta}
            </p>
          </div>

          <form onSubmit={submitResponse} className="space-y-3">
            <textarea
              value={response} onChange={e => setResponse(e.target.value)}
              placeholder="Tu respuesta — en escenas, no en sentimientos."
              rows={5} required minLength={3}
              className="input"
            />
            <div className="flex gap-2">
              <button
                type="submit" disabled={submitting || response.trim().length < 3}
                className="btn btn-accent flex-1"
              >
                {submitting ? 'Procesando…' : 'Enviar respuesta →'}
              </button>
              <button
                type="button" onClick={reset}
                className="btn btn-ghost"
              >
                Empezar de cero
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'exhausted' && mapState && (
        <div className="space-y-4">
          <div className="p-8 rounded-2xl bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 text-center flex flex-col items-center gap-3">
            <span className="eyebrow">En pausa</span>
            <p className="text-lg font-medium">{mapState.message}</p>
          </div>
          <button onClick={reset} className="btn btn-ghost w-full">
            Empezar otro mapa →
          </button>
        </div>
      )}

      {step === 'success' && mapState && (
        <div className="space-y-5">
          <div className="p-4 rounded-xl bg-ok-soft dark:bg-ok-deep border border-ok/30 dark:border-ok-bright/30 text-sm text-ok dark:text-ok-bright">
            <strong>Pasaron los tres filtros.</strong> Modo: {mapState.axis_mode === 'multi' ? 'territorios múltiples' : 'eje único con caras'}.
          </div>

          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight mb-3">Ideas crudas</h2>
            <div className="space-y-3">
              {(mapState.ideas || []).map((idea, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-accent dark:text-accent-bright mt-1 font-mono tabular-nums">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-base">{idea.texto}</p>
                      {idea.nota_uso && (
                        <p className="mt-2 text-xs text-ink-500 dark:text-ink-400 italic">{idea.nota_uso}</p>
                      )}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(idea.texto)}
                      className="text-xs px-2 py-1 text-ink-400 hover:text-accent dark:hover:text-accent-bright transition-colors"
                      title="Copiar"
                    >📋</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-ink-400 dark:text-ink-500 text-right font-mono tabular-nums">
            Costo del mapa: ${(mapState.cost_usd || 0).toFixed(4)}
          </div>

          <button onClick={reset} className="btn btn-ghost w-full">
            Hacer otro mapa →
          </button>
        </div>
      )}
    </div>
  );
}
