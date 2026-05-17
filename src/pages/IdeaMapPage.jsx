import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const FILTER_LABEL = {
  fallo_1: 'Sentimiento en vez de escena',
  fallo_2: 'Eje único disfrazado',
  fallo_3: 'La fuga',
};

const PLACEHOLDER_NO = `Ej: El martes me levanto a las 7, voy a una oficina en la que paso 9 horas, almuerzo solo frente a la pantalla, vuelvo a las 7 y solo tengo energía para mirar series. Los fines de semana le digo que sí a planes que no me interesan porque no quiero quedarme solo. Le dije sí al ascenso aunque significa viajar más, le dije no a mudarme cerca de mi familia.`;

const PLACEHOLDER_SI = `Ej: El martes trabajo desde casa, hago una caminata al mediodía, almuerzo con mi pareja, termino a las 6 y leo dos horas. Los sábados veo a dos o tres amigos cercanos, no más. Le digo no a clientes que pagan poco aunque sean prestigiosos, le digo sí a proyectos de 3 meses en vez de relaciones de 2 años.`;

export default function IdeaMapPage() {
  const { id: routeId } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState(routeId ? 'loading' : 'form'); // form | loading | turn | success | exhausted
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
        setVidaNo(data.vida_no_quiero);
        setVidaSi(data.vida_si_quiero);
        if (data.status === 'success') {
          setMapState({
            status: 'success', map_id: data.id, axis_mode: data.axis_mode,
            structure: data.structure, ideas: data.ideas, cost_usd: data.cost_usd,
          });
          setStep('success');
        } else if (data.status === 'exhausted') {
          setMapState({ status: 'exhausted', map_id: data.id, message: 'Esto no se desbloquea con repreguntas. Trabajalo offline antes de volver.' });
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
        body: JSON.stringify({ vida_no_quiero: vidaNo, vida_si_quiero: vidaSi }),
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
    setStep('form'); setVidaNo(''); setVidaSi(''); setMapState(null);
    setResponse(''); setError(null);
    navigate('/mapa-de-ideas', { replace: true });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
          Generador de Ideas
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          Mapa de contraste → territorios → cruces → 4-5 frases crudas que suenan a vos. La compuerta se niega a generar si el insumo está roto.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg">
          {error}
        </div>
      )}

      {step === 'loading' && (
        <div className="text-center py-12 text-gray-500">Cargando mapa…</div>
      )}

      {step === 'form' && (
        <form onSubmit={submitInitial} className="space-y-5">
          <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 p-4 rounded-lg text-sm text-violet-900 dark:text-violet-200">
            <strong>Cómo escribir esto:</strong> escenas concretas. Martes a tal hora, qué hacés, con quién, dónde. A qué le dijiste sí, a qué le dijiste no. No sentimientos ("me siento sin libertad"), no adjetivos ("amplitud", "paz"). Si la compuerta detecta sentimientos en vez de escenas, no genera y te pide reescribirlas.
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vida que <strong className="text-rose-600 dark:text-rose-400">NO</strong> quiero
            </label>
            <textarea
              value={vidaNo} onChange={e => setVidaNo(e.target.value)}
              placeholder={PLACEHOLDER_NO}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              required minLength={80}
            />
            <div className="mt-1 text-xs text-gray-500 tabular-nums">{vidaNo.length} caracteres · mínimo 80</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Vida que <strong className="text-emerald-600 dark:text-emerald-400">SÍ</strong> quiero
            </label>
            <textarea
              value={vidaSi} onChange={e => setVidaSi(e.target.value)}
              placeholder={PLACEHOLDER_SI}
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              required minLength={80}
            />
            <div className="mt-1 text-xs text-gray-500 tabular-nums">{vidaSi.length} caracteres · mínimo 80</div>
          </div>

          <button
            type="submit" disabled={submitting || vidaNo.length < 80 || vidaSi.length < 80}
            className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
          >
            {submitting ? 'Procesando…' : 'Empezar el mapa'}
          </button>
        </form>
      )}

      {step === 'turn' && mapState && (
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                {FILTER_LABEL[mapState.failed_filter] || mapState.failed_filter}
              </span>
              <span className="text-xs text-amber-700 dark:text-amber-400 tabular-nums">
                {mapState.attempts_remaining_this_filter} repreguntas más en este filtro · {mapState.turns_remaining} turnos totales
              </span>
            </div>
            {mapState.diagnostic && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 italic">
                {mapState.diagnostic}
              </p>
            )}
            <p className="text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
              {mapState.repregunta}
            </p>
          </div>

          <form onSubmit={submitResponse} className="space-y-3">
            <textarea
              value={response} onChange={e => setResponse(e.target.value)}
              placeholder="Tu respuesta — en escenas, no en sentimientos."
              rows={5} required minLength={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-violet-500"
            />
            <div className="flex gap-2">
              <button
                type="submit" disabled={submitting || response.trim().length < 3}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-medium rounded-lg transition"
              >
                {submitting ? 'Procesando…' : 'Enviar respuesta'}
              </button>
              <button
                type="button" onClick={reset}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Empezar de cero
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'exhausted' && mapState && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 p-6 rounded-lg text-center">
            <div className="text-4xl mb-3">⏸️</div>
            <p className="text-lg text-gray-900 dark:text-gray-100 font-medium">{mapState.message}</p>
          </div>
          <button onClick={reset} className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            Empezar otro mapa
          </button>
        </div>
      )}

      {step === 'success' && mapState && (
        <div className="space-y-5">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4 rounded-lg text-sm text-emerald-900 dark:text-emerald-200">
            <strong>Pasaron los tres filtros.</strong> Modo: {mapState.axis_mode === 'multi' ? 'territorios múltiples' : 'eje único con caras'}.
          </div>

          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Ideas crudas</h2>
            <div className="space-y-3">
              {(mapState.ideas || []).map((idea, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 mt-1 tabular-nums">#{i + 1}</span>
                    <div className="flex-1">
                      <p className="text-base text-gray-900 dark:text-gray-100">{idea.texto}</p>
                      {idea.nota_uso && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 italic">{idea.nota_uso}</p>
                      )}
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(idea.texto)}
                      className="text-xs px-2 py-1 text-gray-500 hover:text-violet-600 dark:hover:text-violet-400"
                      title="Copiar"
                    >📋</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums">
            Costo del mapa: ${(mapState.cost_usd || 0).toFixed(4)}
          </div>

          <button onClick={reset} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition">
            Hacer otro mapa
          </button>
        </div>
      )}
    </div>
  );
}
