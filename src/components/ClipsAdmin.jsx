import React, { useEffect, useState, useMemo } from 'react';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const fmt = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ClipsAdmin = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/clips`);
      if (!res.ok) throw new Error('Error cargando jobs');
      setJobs(await res.json());
      setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const total = jobs.reduce((acc, j) => ({
      jobs: acc.jobs + 1,
      clips: acc.clips + (j.clip_count || 0),
      cost: acc.cost + (j.total_cost_usd || 0),
      whisperCost: acc.whisperCost + (j.whisper_cost_usd || 0),
      llmCost: acc.llmCost + (j.llm_cost_usd || 0),
      minutes: acc.minutes + ((j.duration_seconds || 0) / 60),
    }), { jobs: 0, clips: 0, cost: 0, whisperCost: 0, llmCost: 0, minutes: 0 });
    return total;
  }, [jobs]);

  const filtered = jobs.filter(j => filter === 'all' || j.status === filter);

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este job y todos sus archivos? No se puede deshacer.')) return;
    const res = await authFetch(`${API_BASE}/clips/jobs/${id}`, { method: 'DELETE' });
    if (res.ok) load();
    else alert('Error al eliminar');
  };

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando…</div>;
  if (error) return <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs uppercase tracking-wide text-gray-500">Jobs totales</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.jobs}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs uppercase tracking-wide text-gray-500">Clips generados</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.clips}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-xs uppercase tracking-wide text-gray-500">Minutos procesados</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.minutes.toFixed(0)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-indigo-500 rounded-lg p-4 text-white">
          <div className="text-xs uppercase tracking-wide opacity-80">Costo total</div>
          <div className="text-2xl font-bold mt-1">{fmt(stats.cost)}</div>
          <div className="text-[11px] opacity-80 mt-1">
            Whisper {fmt(stats.whisperCost)} · LLM {fmt(stats.llmCost)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {[
          { id: 'all', label: 'Todos' },
          { id: 'done', label: 'Completados' },
          { id: 'pending', label: 'En proceso' },
          { id: 'error', label: 'Con error' },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.id ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
          ↻ Refrescar
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Usuario</th>
                <th className="px-4 py-3 text-left">Título / Fuente</th>
                <th className="px-4 py-3 text-right">Duración</th>
                <th className="px-4 py-3 text-right">Clips</th>
                <th className="px-4 py-3 text-right">Whisper</th>
                <th className="px-4 py-3 text-right">LLM</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filtered.map(j => (
                <tr key={j.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                  <td className="px-4 py-3">
                    <div className="text-gray-900 dark:text-white font-medium">{j.user_name || '—'}</div>
                    <div className="text-xs text-gray-500">{j.user_email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="text-gray-900 dark:text-white truncate">{j.title || 'Sin título'}</div>
                    {j.source_url && <div className="text-xs text-gray-500 truncate">{j.source_url}</div>}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">
                    {j.duration_seconds ? `${Math.round(j.duration_seconds / 60)} min` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300 tabular-nums">{j.clip_count || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{fmt(j.whisper_cost_usd)}</td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 tabular-nums">{fmt(j.llm_cost_usd)}</td>
                  <td className="px-4 py-3 text-right font-bold text-purple-600 dark:text-purple-400 tabular-nums">{fmt(j.total_cost_usd)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                      j.status === 'done' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : j.status === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(j.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(j.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded text-xs">✕</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-gray-500">Sin jobs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClipsAdmin;
