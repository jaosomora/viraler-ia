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

  if (loading) return <div className="text-center py-8 text-gray-500">Cargando…</div>;
  if (error) return <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Reels totales" value={stats.jobs} sub={`${stats.done} completados`} />
        <Card label="Minutos procesados" value={stats.minutes.toFixed(1)} sub={`${stats.minutesFinal.toFixed(1)} min entregados`} />
        <Card label="Whisper · IA" value={`${fmt$(stats.whisper)} · ${fmt$(stats.suggest)}`} sub="transcripción · sugerencias musicales" />
        <Card label="Costo total" value={fmt$(stats.cost)} highlight sub="acumulado del mes" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUSES.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === f.id ? 'bg-amber-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
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
                <th className="px-4 py-3 text-left">Título</th>
                <th className="px-4 py-3 text-right">Original → Final</th>
                <th className="px-4 py-3 text-right">Estado</th>
                <th className="px-4 py-3 text-right">Costo</th>
                <th className="px-4 py-3 text-right">Creado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filtered.map(j => (
                <tr key={j.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white text-xs">{j.user_name || '—'}</div>
                    <div className="text-[10px] text-gray-500 truncate max-w-[140px]">{j.user_email}</div>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <div className="text-xs text-gray-900 dark:text-white truncate">{j.title || j.source_filename || 'Sin título'}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{j.id.slice(0, 12)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right text-xs font-mono text-gray-700 dark:text-gray-300">
                    {fmtMin(j.duration_seconds)} → {fmtMin(j.output_duration_seconds)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <StatusBadge status={j.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-700 dark:text-gray-300">{fmt$(j.total_cost_usd)}</td>
                  <td className="px-4 py-3 text-right text-[10px] text-gray-500 whitespace-nowrap">{fmtDate(j.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500 text-sm">Sin reels con ese filtro</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Card = ({ label, value, sub, highlight }) => (
  <div className={`rounded-lg p-4 ${highlight
      ? 'bg-gradient-to-br from-amber-500 to-rose-500 text-white'
      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
    <div className={`text-xs uppercase tracking-wide ${highlight ? 'opacity-80' : 'text-gray-500'}`}>{label}</div>
    <div className={`text-2xl font-bold mt-1 ${highlight ? '' : 'text-gray-900 dark:text-white'}`}>{value}</div>
    {sub && <div className={`text-[11px] mt-1 ${highlight ? 'opacity-80' : 'text-gray-500'}`}>{sub}</div>}
  </div>
);

const StatusBadge = ({ status }) => {
  const map = {
    done: ['bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', '✓ Listo'],
    error: ['bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', '✕ Error'],
    awaiting_review: ['bg-amber-100 text-amber-700', '👀 Silencios'],
    awaiting_style_review: ['bg-blue-100 text-blue-700', '🎨 Estilo'],
    awaiting_music_review: ['bg-purple-100 text-purple-700', '🎵 Música'],
  };
  const [cls, label] = map[status] || ['bg-gray-100 text-gray-700', status];
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${cls}`}>{label}</span>;
};

export default ReelsAdmin;
