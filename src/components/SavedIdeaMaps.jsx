import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { authFetch } from '../context/AuthContext';
import { useConfirm } from './ui/feedback';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const STATUS_BADGE = {
  awaiting_correction: { label: 'En proceso', cls: 'chip chip-warn' },
  success: { label: 'Ideas listas', cls: 'chip chip-ok' },
  exhausted: { label: 'Sin desbloquear', cls: 'chip chip-neutral' },
};

export default function SavedIdeaMaps() {
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const confirmDialog = useConfirm();

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
    if (!(await confirmDialog({ title: '¿Borrar este mapa?', message: 'No se puede deshacer.', danger: true }))) return;
    const res = await authFetch(`${API_BASE}/idea-maps/${id}`, { method: 'DELETE' });
    if (res.ok) setMaps(maps.filter(m => m.id !== id));
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-center py-12 text-ink-500 dark:text-ink-400">Cargando…</div>;
  if (error) return <div className="text-danger dark:text-danger-bright text-center py-6">{error}</div>;
  if (maps.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center gap-3">
        <span className="eyebrow">Mapas de ideas</span>
        <p className="text-ink-500 dark:text-ink-400">Aún no has hecho ningún mapa.</p>
        <Link to="/mapa-de-ideas" className="btn btn-ghost btn-sm">Empezar uno →</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      {maps.map(m => {
        const badge = STATUS_BADGE[m.status] || { label: m.status, cls: 'chip chip-neutral' };
        return (
          <Link
            key={m.id} to={`/mapa-de-ideas/${m.id}`}
            className="block card p-4 hover:border-accent/50 dark:hover:border-accent-bright/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={badge.cls}>{badge.label}</span>
                  <span className="text-xs text-ink-500 dark:text-ink-400 font-mono tabular-nums">turno {m.turn}</span>
                  {m.axis_mode && <span className="text-xs text-ink-500 dark:text-ink-400">· {m.axis_mode}</span>}
                  <span className="text-xs text-ink-400 dark:text-ink-500 ml-auto font-mono tabular-nums">{new Date(m.created_at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</span>
                </div>
                {m.tema && (
                  <div className="text-sm font-medium text-accent dark:text-accent-bright mb-2 line-clamp-1">
                    {m.tema}
                  </div>
                )}
                <div className="text-sm text-ink-500 dark:text-ink-400 line-clamp-1">
                  <span className="chip chip-danger align-middle mr-1.5">No</span>{m.preview_no}…
                </div>
                <div className="text-sm text-ink-500 dark:text-ink-400 line-clamp-1 mt-1.5">
                  <span className="chip chip-ok align-middle mr-1.5">Sí</span>{m.preview_si}…
                </div>
              </div>
              <button
                onClick={e => { e.preventDefault(); remove(m.id); }}
                className="text-xs text-ink-400 hover:text-danger dark:hover:text-danger-bright px-2 py-1 transition-colors"
                title="Borrar"
              >🗑</button>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
