import React, { useEffect, useState, useMemo } from 'react';
import { authFetch } from '../context/AuthContext';
import { useToast, useConfirm } from './ui/feedback';

const API_BASE = '/api';

const fmt = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ClipsAdmin = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const toast = useToast();
  const confirmDialog = useConfirm();

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
    if (!(await confirmDialog({ title: '¿Eliminar este job y todos sus archivos?', message: 'No se puede deshacer.', danger: true }))) return;
    const res = await authFetch(`${API_BASE}/clips/jobs/${id}`, { method: 'DELETE' });
    if (res.ok) load();
    else toast('Error al eliminar', { type: 'danger' });
  };

  if (loading) return <div className="text-center py-8 text-ink-500 dark:text-ink-400">Cargando…</div>;
  if (error) return <div className="bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright p-4 rounded-xl text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Jobs totales</div>
          <div className="font-display text-2xl font-bold tabular-nums mt-1">{stats.jobs}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Clips generados</div>
          <div className="font-display text-2xl font-bold tabular-nums mt-1">{stats.clips}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Minutos procesados</div>
          <div className="font-display text-2xl font-bold tabular-nums mt-1">{stats.minutes.toFixed(0)}</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Costo total</div>
          <div className="font-mono text-2xl font-bold tabular-nums mt-1 text-accent dark:text-accent-bright">{fmt(stats.cost)}</div>
          <div className="text-[11px] font-mono tabular-nums text-ink-500 dark:text-ink-400 mt-1">
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === f.id ? 'bg-accent-soft text-accent dark:bg-accent-deep dark:text-accent-bright' : 'text-ink-500 dark:text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800'}`}>
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 text-xs text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper transition-colors">
          ↻ Refrescar
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-700">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Usuario</th>
                <th className="px-4 py-3 text-left font-semibold">Título / Fuente</th>
                <th className="px-4 py-3 text-right font-semibold">Duración</th>
                <th className="px-4 py-3 text-right font-semibold">Clips</th>
                <th className="px-4 py-3 text-right font-semibold">Whisper</th>
                <th className="px-4 py-3 text-right font-semibold">LLM</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 text-left font-semibold">Estado</th>
                <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {filtered.map(j => (
                <tr key={j.id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{j.user_name || '—'}</div>
                    <div className="text-xs text-ink-500 dark:text-ink-400">{j.user_email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <div className="truncate">{j.title || 'Sin título'}</div>
                    {j.source_url && <div className="text-xs text-ink-500 dark:text-ink-400 truncate">{j.source_url}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {j.duration_seconds ? `${Math.round(j.duration_seconds / 60)} min` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{j.clip_count || 0}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-500 dark:text-ink-400">{fmt(j.whisper_cost_usd)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-ink-500 dark:text-ink-400">{fmt(j.llm_cost_usd)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-accent dark:text-accent-bright">{fmt(j.total_cost_usd)}</td>
                  <td className="px-4 py-3">
                    <span className={`chip ${
                      j.status === 'done' ? 'chip-ok'
                      : j.status === 'error' ? 'chip-danger'
                      : 'chip-warn'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{fmtDate(j.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDelete(j.id)} className="text-danger dark:text-danger-bright hover:bg-danger-soft dark:hover:bg-danger-deep p-1 rounded-full text-xs transition-colors">✕</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="10" className="px-4 py-8 text-center text-ink-500 dark:text-ink-400">Sin jobs.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClipsAdmin;
