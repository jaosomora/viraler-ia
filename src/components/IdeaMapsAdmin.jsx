import React, { useEffect, useState } from 'react';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const STATUS_TONE = {
  awaiting_correction: 'chip-warn',
  success: 'chip-ok',
  exhausted: 'chip-neutral',
};

export default function IdeaMapsAdmin() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_BASE}/admin/idea-maps`);
        if (!res.ok) throw new Error('No se pudo cargar');
        setMaps(await res.json());
      } catch (err) { setError(err.message); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-center py-12 text-ink-500 dark:text-ink-400">Cargando…</div>;
  if (error) return <div className="text-danger dark:text-danger-bright text-center py-6">{error}</div>;

  const totals = maps.reduce((acc, m) => {
    acc.total++;
    acc.cost += m.cost_usd || 0;
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, { total: 0, cost: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total" value={totals.total} />
        <Stat label="Éxitos" value={totals.success || 0} />
        <Stat label="En proceso" value={totals.awaiting_correction || 0} />
        <Stat label="Sin desbloquear" value={totals.exhausted || 0} />
      </div>
      <div className="text-sm text-ink-500 dark:text-ink-400 text-right font-mono tabular-nums">
        Costo total OpenAI: ${totals.cost.toFixed(4)}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-700">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">Usuario</th>
              <th className="text-left px-3 py-2 font-semibold">Estado</th>
              <th className="text-right px-3 py-2 font-semibold">Turno</th>
              <th className="text-left px-3 py-2 font-semibold">Filtro fallado</th>
              <th className="text-left px-3 py-2 font-semibold">Modo</th>
              <th className="text-right px-3 py-2 font-semibold">Costo</th>
              <th className="text-left px-3 py-2 font-semibold">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
            {maps.map(m => (
              <tr key={m.id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                <td className="px-3 py-2">{m.user_email || `id ${m.user_id}`}</td>
                <td className="px-3 py-2">
                  <span className={`chip ${STATUS_TONE[m.status] || 'chip-neutral'}`}>{m.status}</span>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{m.turn}</td>
                <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{m.failed_filter || '—'}</td>
                <td className="px-3 py-2 text-ink-500 dark:text-ink-400">{m.axis_mode || '—'}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">${(m.cost_usd || 0).toFixed(4)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400">{new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
              </tr>
            ))}
            {maps.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-ink-500 dark:text-ink-400">Todavía no hay mapas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">{label}</div>
      <div className="font-display text-2xl font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
