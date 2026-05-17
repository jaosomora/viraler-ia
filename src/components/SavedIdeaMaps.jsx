import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const STATUS_BADGE = {
  awaiting_correction: { label: 'En proceso', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  success: { label: 'Ideas listas', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  exhausted: { label: 'Sin desbloquear', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

export default function SavedIdeaMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/idea-maps`);
      if (!res.ok) throw new Error('No se pudieron cargar los mapas');
      setMaps(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (!confirm('¿Borrar este mapa?')) return;
    const res = await authFetch(`${API_BASE}/idea-maps/${id}`, { method: 'DELETE' });
    if (res.ok) setMaps(maps.filter(m => m.id !== id));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">Cargando…</div>;
  if (error) return <div className="text-red-600 dark:text-red-400 text-center py-6">{error}</div>;
  if (maps.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        Todavía no hiciste ningún mapa. <Link to="/mapa-de-ideas" className="text-violet-600 dark:text-violet-400 underline">Empezar uno</Link>.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {maps.map(m => {
        const badge = STATUS_BADGE[m.status] || { label: m.status, cls: 'bg-gray-100 text-gray-600' };
        return (
          <Link
            key={m.id} to={`/mapa-de-ideas/${m.id}`}
            className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-violet-300 dark:hover:border-violet-700 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${badge.cls}`}>{badge.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">turno {m.turn}</span>
                  {m.axis_mode && <span className="text-xs text-gray-500 dark:text-gray-400">· {m.axis_mode}</span>}
                  <span className="text-xs text-gray-400 ml-auto">{new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1">
                  <span className="text-rose-600 dark:text-rose-400 font-medium">No:</span> {m.preview_no}…
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 line-clamp-1 mt-1">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Sí:</span> {m.preview_si}…
                </div>
              </div>
              <button
                onClick={e => { e.preventDefault(); remove(m.id); }}
                className="text-xs text-gray-400 hover:text-red-500 px-2 py-1"
                title="Borrar"
              >🗑</button>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
