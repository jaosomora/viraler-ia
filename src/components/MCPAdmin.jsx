import React, { useEffect, useState } from 'react';
import { authFetch } from '../context/AuthContext';
import { useConfirm } from './ui/feedback';

const API = '/api/admin/mcp';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (n) => `$${Number(n || 0).toFixed(4)}`;
const fmtMs = (ms) => ms ? `${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}` : '—';

// ── Sección reutilizable ─────────────────────────────────────────────────
const Section = ({ title, action, children }) => (
  <div className="card p-5 mb-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, color = '', mono = false }) => (
  <div className="card p-5">
    <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">{label}</div>
    <div className={`${mono ? 'font-mono' : 'font-display'} text-2xl font-bold tabular-nums mt-1 ${color}`}>{value}</div>
  </div>
);

const MCPAdmin = () => {
  const [overview, setOverview] = useState(null);
  const [clients, setClients] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [audit, setAudit] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditFilter, setAuditFilter] = useState({ tool: '', only_errors: false });
  const [busy, setBusy] = useState(false);
  const confirmDialog = useConfirm();

  const loadAll = async () => {
    setLoading(true);
    try {
      const [ov, cl, tk, au, qu] = await Promise.all([
        authFetch(`${API}/overview`).then(r => r.json()),
        authFetch(`${API}/clients`).then(r => r.json()),
        authFetch(`${API}/tokens`).then(r => r.json()),
        authFetch(`${API}/audit?limit=100${auditFilter.tool ? `&tool=${auditFilter.tool}` : ''}${auditFilter.only_errors ? '&only_errors=true' : ''}`).then(r => r.json()),
        authFetch(`${API}/quotas`).then(r => r.json()),
      ]);
      setOverview(ov);
      setClients(cl);
      setTokens(tk);
      setAudit(au);
      setQuotas(qu);
    } catch (e) {
      console.error('[MCPAdmin] load failed', e);
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    if (!loading) {
      authFetch(`${API}/audit?limit=100${auditFilter.tool ? `&tool=${auditFilter.tool}` : ''}${auditFilter.only_errors ? '&only_errors=true' : ''}`)
        .then(r => r.json()).then(setAudit);
    }
    // eslint-disable-next-line
  }, [auditFilter.tool, auditFilter.only_errors]);

  const toggleMcpGlobal = async () => {
    if (!overview) return;
    setBusy(true);
    await authFetch(`${API}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcp_disabled: !overview.mcpDisabled }),
    });
    await loadAll();
    setBusy(false);
  };

  const deleteClient = async (id, name) => {
    if (!(await confirmDialog({ title: `¿Borrar cliente "${name || id}"?`, message: 'Esto revocará todos sus tokens.', confirmLabel: 'Borrar', danger: true }))) return;
    await authFetch(`${API}/clients/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const revokeToken = async (hash) => {
    if (!(await confirmDialog({ title: '¿Revocar este token?', message: 'El cliente tendrá que volver a autorizar.', confirmLabel: 'Revocar', danger: true }))) return;
    await authFetch(`${API}/tokens/${hash}`, { method: 'DELETE' });
    await loadAll();
  };

  const updateUserQuota = async (userId, patch) => {
    await authFetch(`${API}/users/${userId}/quota`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    await loadAll();
  };

  if (loading) return <div className="text-ink-500 dark:text-ink-400 py-8 text-center">Cargando MCP…</div>;

  return (
    <div>
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Clientes" value={overview?.clients || 0} />
        <Stat label="Sesiones activas" value={overview?.activeTokens || 0} color="text-ok dark:text-ok-bright" />
        <Stat label="Llamadas 24h" value={overview?.callsLast24h || 0} color="text-accent dark:text-accent-bright" />
        <Stat label="Costo 24h" value={fmtMoney(overview?.costLast24hUsd)} mono />
        <Stat label="Errores 24h" value={overview?.errorsLast24h || 0} color={overview?.errorsLast24h ? 'text-danger dark:text-danger-bright' : 'text-ink-400 dark:text-ink-500'} />
      </div>

      {/* Toggle global emergency */}
      <Section
        title={overview?.mcpDisabled ? '🚨 MCP DESACTIVADO globalmente' : '🟢 MCP activo globalmente'}
        action={
          <button
            onClick={toggleMcpGlobal}
            disabled={busy}
            className={`btn btn-sm ${overview?.mcpDisabled ? 'btn-accent' : 'btn-danger'}`}>
            {overview?.mcpDisabled ? 'Reactivar MCP' : 'Apagar MCP'}
          </button>
        }
      >
        <p className="text-sm text-ink-500 dark:text-ink-400">
          {overview?.mcpDisabled
            ? 'Las llamadas al endpoint /mcp devuelven 503 hasta que reactives. Útil para emergencias o mantenimiento.'
            : 'Toggle de emergencia: cuando está apagado, ningún cliente puede usar el MCP, devuelve 503. Tu UI web sigue funcionando normal.'}
        </p>
      </Section>

      {/* Clientes registrados */}
      <Section title={`Clientes registrados (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Ningún cliente OAuth registrado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-500 dark:text-ink-400 uppercase tracking-wider border-b border-ink-200 dark:border-ink-700">
                <tr><th className="text-left py-2 font-semibold">Nombre</th><th className="text-left font-semibold">Client ID</th><th className="text-left font-semibold">Tokens activos</th><th className="text-left font-semibold">Creado</th><th className="text-left font-semibold">Último uso</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {clients.map(c => (
                  <tr key={c.client_id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                    <td className="py-2 font-medium">{c.client_name || '(sin nombre)'}</td>
                    <td className="font-mono text-xs text-ink-500 dark:text-ink-400">{c.client_id.slice(0, 16)}…</td>
                    <td className="font-mono tabular-nums">{c.active_tokens}</td>
                    <td className="font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400">{fmtDate(c.created_at)}</td>
                    <td className="font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400">{fmtDate(c.last_used_at)}</td>
                    <td className="text-right">
                      <button onClick={() => deleteClient(c.client_id, c.client_name)} className="text-danger dark:text-danger-bright hover:underline underline-offset-2 text-xs">Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Sesiones activas */}
      <Section title={`Sesiones activas (${tokens.length})`}>
        {tokens.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">Ningún token activo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-500 dark:text-ink-400 uppercase tracking-wider border-b border-ink-200 dark:border-ink-700">
                <tr><th className="text-left py-2 font-semibold">Usuario</th><th className="text-left font-semibold">Cliente</th><th className="text-left font-semibold">Scope</th><th className="text-left font-semibold">Último uso</th><th className="text-left font-semibold">Expira</th><th></th></tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {tokens.map(t => (
                  <tr key={t.token_hash} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                    <td className="py-2 font-medium">{t.user_email || `#${t.user_id}`}</td>
                    <td>{t.client_name || t.client_id?.slice(0, 12) + '…'}</td>
                    <td className="text-xs text-ink-500 dark:text-ink-400">{t.scope || '—'}</td>
                    <td className="font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400">{fmtDate(t.last_used_at)}</td>
                    <td className="font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400">{fmtDate(t.expires_at)}</td>
                    <td className="text-right">
                      <button onClick={() => revokeToken(t.token_hash)} className="text-danger dark:text-danger-bright hover:underline underline-offset-2 text-xs">Revocar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Cuotas por usuario */}
      <Section title="Cuotas por usuario">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-500 dark:text-ink-400 uppercase tracking-wider border-b border-ink-200 dark:border-ink-700">
              <tr><th className="text-left py-2 font-semibold">Usuario</th><th className="text-left font-semibold">Rol</th><th className="text-left font-semibold">Cuota/día</th><th className="text-left font-semibold">Usado hoy</th><th className="text-left font-semibold">MCP</th></tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {quotas.map(u => (
                <tr key={u.id} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50 transition-colors">
                  <td className="py-2 font-medium">{u.email}</td>
                  <td><span className="chip chip-neutral">{u.role}</span></td>
                  <td>
                    {u.role === 'owner' ? (
                      <span className="text-ink-400 dark:text-ink-500 text-xs">sin límite (owner)</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        defaultValue={u.quota ?? ''}
                        placeholder="∞"
                        className="w-20 px-2 py-1 text-sm rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-950 dark:text-paper placeholder-ink-400 dark:placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright focus:border-transparent"
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                          if (v !== (u.quota ?? null)) updateUserQuota(u.id, { quota: v });
                        }}
                      />
                    )}
                  </td>
                  <td className={`font-mono tabular-nums ${u.used_today > 0 ? 'font-medium' : 'text-ink-400 dark:text-ink-500'}`}>{u.used_today}</td>
                  <td>
                    {u.role !== 'owner' && (
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!u.mcp_disabled}
                          onChange={(e) => updateUserQuota(u.id, { mcp_disabled: !e.target.checked })}
                        />
                        <span className={`chip ${u.mcp_disabled ? 'chip-danger' : 'chip-ok'}`}>
                          {u.mcp_disabled ? 'desactivado' : 'activo'}
                        </span>
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-500 dark:text-ink-400 mt-2">
          Cuota se aplica solo a transcripciones (no a lectura). Vacío = sin límite. El owner siempre tiene acceso ilimitado.
        </p>
      </Section>

      {/* Audit log */}
      <Section
        title={`Auditoría (${audit.length})`}
        action={
          <div className="flex items-center gap-3 text-xs">
            <select
              value={auditFilter.tool}
              onChange={(e) => setAuditFilter(f => ({ ...f, tool: e.target.value }))}
              className="rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-900 text-ink-950 dark:text-paper px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-bright"
            >
              <option value="">Todos los tools</option>
              <option value="list_my_transcriptions">list_my_transcriptions</option>
              <option value="transcribe_video_url">transcribe_video_url</option>
              <option value="get_transcription">get_transcription</option>
              <option value="analyze_video_transcript">analyze_video_transcript</option>
              <option value="build_idea_map">build_idea_map</option>
            </select>
            <label className="inline-flex items-center gap-2 text-ink-500 dark:text-ink-400">
              <input
                type="checkbox"
                checked={auditFilter.only_errors}
                onChange={(e) => setAuditFilter(f => ({ ...f, only_errors: e.target.checked }))}
              />
              Solo errores
            </label>
            <button onClick={loadAll} className="link-accent font-medium">Recargar</button>
          </div>
        }
      >
        {audit.length === 0 ? (
          <p className="text-sm text-ink-500 dark:text-ink-400">No hay actividad MCP que mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-500 dark:text-ink-400 uppercase tracking-wider border-b border-ink-200 dark:border-ink-700">
                <tr><th className="text-left py-2 font-semibold">Cuándo</th><th className="text-left font-semibold">Usuario</th><th className="text-left font-semibold">Tool</th><th className="text-left font-semibold">Args</th><th className="text-left font-semibold">Duración</th><th className="text-left font-semibold">Costo</th><th className="text-left font-semibold">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
                {audit.map(a => (
                  <tr key={a.id} className={`transition-colors ${a.success ? 'hover:bg-ink-100/50 dark:hover:bg-ink-800/50' : 'bg-danger-soft/60 dark:bg-danger-deep/40'}`}>
                    <td className="py-2 font-mono tabular-nums text-xs text-ink-500 dark:text-ink-400 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td className="text-xs">{a.user_email || `#${a.user_id}`}</td>
                    <td className="text-xs font-mono">{a.tool_name}</td>
                    <td className="text-xs text-ink-500 dark:text-ink-400 font-mono max-w-xs truncate" title={a.args_summary}>{a.args_summary || '—'}</td>
                    <td className="text-xs font-mono tabular-nums">{fmtMs(a.duration_ms)}</td>
                    <td className="text-xs font-mono tabular-nums">{a.cost_usd > 0 ? fmtMoney(a.cost_usd) : '—'}</td>
                    <td>
                      {a.success
                        ? <span className="text-ok dark:text-ok-bright text-xs">✓ ok</span>
                        : <span className="text-danger dark:text-danger-bright text-xs" title={a.error_message}>✗ error</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};

export default MCPAdmin;
