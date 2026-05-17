import React, { useEffect, useState } from 'react';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const STATUS_TONE = {
  awaiting_correction: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  exhausted: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
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

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando…</div>;
  if (error) return <div className="text-red-600 dark:text-red-400 text-center py-6">{error}</div>;

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
      <div className="text-sm text-gray-600 dark:text-gray-400 text-right tabular-nums">
        Costo total OpenAI: ${totals.cost.toFixed(4)}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/40 text-xs uppercase text-gray-600 dark:text-gray-400">
            <tr>
              <th className="text-left px-3 py-2">Usuario</th>
              <th className="text-left px-3 py-2">Estado</th>
              <th className="text-right px-3 py-2">Turno</th>
              <th className="text-left px-3 py-2">Filtro fallado</th>
              <th className="text-left px-3 py-2">Modo</th>
              <th className="text-right px-3 py-2">Costo</th>
              <th className="text-left px-3 py-2">Creado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {maps.map(m => (
              <tr key={m.id}>
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{m.user_email || `id ${m.user_id}`}</td>
                <td className="px-3 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_TONE[m.status] || ''}`}>{m.status}</span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{m.turn}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.failed_filter || '—'}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{m.axis_mode || '—'}</td>
                <td className="px-3 py-2 text-right tabular-nums">${(m.cost_usd || 0).toFixed(4)}</td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</td>
              </tr>
            ))}
            {maps.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-gray-500">Todavía no hay mapas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">{label}</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums mt-1">{value}</div>
    </div>
  );
}
