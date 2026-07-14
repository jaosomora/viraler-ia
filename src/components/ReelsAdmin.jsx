import React, { useEffect, useState, useMemo } from 'react';
import { authFetch } from '../context/AuthContext';

const fmt$ = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const fmtMin = s => `${((s || 0) / 60).toFixed(1)}min`;
const fmtDate = iso => new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const STATUSES = [
  { id: 'all', label: 'Todos' },
  { id: 'done', label: 'Completados' },
  { id: 'awaiting_review', label: 'Revisión silencios' },
  { id: 'awaiting_style_review', label: 'Revisión estilo' },
  { id: 'awaiting_music_review', label: 'Revisión música' },
  { id: 'error', label: 'Con error' },
];

const ReelsAdmin = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/admin/reels');
      if (!res.ok) throw new Error('Error cargando reels');
      setJobs(await res.json());
      setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = useMemo(() => jobs.reduce((acc, j) => ({
    jobs: acc.jobs + 1,
    done: acc.done + (j.status === 'done' ? 1 : 0),
    cost: acc.cost + (j.total_cost_usd || 0),
    whisper: acc.whisper + (j.whisper_cost_usd || 0),
    suggest: acc.suggest + (j.llm_cost_suggest_usd || 0),
    minutes: acc.minutes + ((j.duration_seconds || 0) / 60),
    minutesFinal: acc.minutesFinal + ((j.output_duration_seconds || 0) / 60),
  }), { jobs: 0, done: 0, cost: 0, whisper: 0, suggest: 0, minutes: 0, minutesFinal: 0 }), [jobs]);

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  if (loading) return <div className="text-center py-8 text-ink-500 dark:text-ink-400">Cargando…</div>;
  if (error) return <div className="bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright p-4 rounded-xl text-sm">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Reels totales" value={stats.jobs} sub={`${stats.done} completados`} />
        <Card label="Minutos procesados" value={stats.minutes.toFixed(1)} sub={`${stats.minutesFinal.toFixed(1)} min entregados`} />
        <Card label="Whisper · IA" value={`${fmt$(stats.whisper)} · ${fmt$(stats.suggest)}`} mono sub="transcripción · sugerencias musicales" />
        <Card label="Costo total" value={fmt$(stats.cost)} highlight sub="acumulado del mes" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map(f => (
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
                <th className="px-4 py-3 text-left font-semibold">Título</th>
                <th className="px-4 py-3 text-right font-semibold">Original → Final</th>
                <th className="px-4 py-3 text-right font-semibold">Estado</th>
                <th className="px-4 py-3 text-right font-semibold">Costo</th>
                <th className="px-4 py-3 text-right font-semibold">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {filtered.map(j => (
                <tr key={j.id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-xs">{j.user_name || '—'}</div>
                    <div className="text-[10px] text-ink-500 dark:text-ink-400 truncate max-w-[140px]">{j.user_email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="text-xs truncate">{j.title || j.source_filename || 'Sin título'}</div>
                    <div className="text-[10px] text-ink-400 dark:text-ink-500 font-mono">{j.id.slice(0, 12)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono tabular-nums">
                    {fmtMin(j.duration_seconds)} → {fmtMin(j.output_duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-xs">{fmt$(j.total_cost_usd)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-[10px] text-ink-500 dark:text-ink-400 whitespace-nowrap">{fmtDate(j.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-ink-500 dark:text-ink-400 text-sm">Sin reels con ese filtro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Card = ({ label, value, sub, highlight, mono }) => (
  <div className="card p-5">
    <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">{label}</div>
    <div className={`text-2xl font-bold tabular-nums mt-1 ${mono || highlight ? 'font-mono' : 'font-display'} ${highlight ? 'text-accent dark:text-accent-bright' : ''}`}>{value}</div>
    {sub && <div className="text-[11px] text-ink-500 dark:text-ink-400 mt-1">{sub}</div>}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    done: ['chip-ok', '✓ Listo'],
    error: ['chip-danger', '✕ Error'],
    awaiting_review: ['chip-warn', '👀 Silencios'],
    awaiting_style_review: ['chip-warn', '🎨 Estilo'],
    awaiting_music_review: ['chip-warn', '🎵 Música'],
  };
  const [cls, label] = map[status] || ['chip-neutral', status];
  return <span className={`chip ${cls}`}>{label}</span>;
};

export default ReelsAdmin;
