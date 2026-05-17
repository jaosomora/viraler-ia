import React, { useEffect, useState } from 'react';
import { authFetch } from '../context/AuthContext';

const API = '/api/admin/mcp';
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtMoney = (n) => `$${Number(n || 0).toFixed(4)}`;
const fmtMs = (ms) => ms ? `${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`}` : '—';

// ── Sección reutilizable ─────────────────────────────────────────────────
const Section = ({ title, action, children }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const Stat = ({ label, value, color = 'text-purple-600 dark:text-purple-400' }) => (
  <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4">
    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
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
    if (!confirm(`Borrar cliente "${name || id}"? Esto revocará todos sus tokens.`)) return;
    await authFetch(`${API}/clients/${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const revokeToken = async (hash) => {
    if (!confirm('Revocar este token? El cliente tendrá que volver a autorizar.')) return;
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

  if (loading) return <div className="text-gray-500 dark:text-gray-400 py-8 text-center">Cargando MCP…</div>;

  return (
    <div>
      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Clientes" value={overview?.clients || 0} />
        <Stat label="Sesiones activas" value={overview?.activeTokens || 0} color="text-green-600 dark:text-green-400" />
        <Stat label="Llamadas 24h" value={overview?.callsLast24h || 0} color="text-blue-600 dark:text-blue-400" />
        <Stat label="Costo 24h" value={fmtMoney(overview?.costLast24hUsd)} color="text-amber-600 dark:text-amber-400" />
        <Stat label="Errores 24h" value={overview?.errorsLast24h || 0} color={overview?.errorsLast24h ? 'text-red-600 dark:text-red-400' : 'text-gray-500'} />
      </div>

      {/* Toggle global emergency */}
      <Section
        title={overview?.mcpDisabled ? '🚨 MCP DESACTIVADO globalmente' : '🟢 MCP activo globalmente'}
        action={
          <button
            onClick={toggleMcpGlobal}
            disabled={busy}
            className={`px-4 py-2 text-sm rounded-lg font-medium ${
              overview?.mcpDisabled
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}>
            {overview?.mcpDisabled ? 'Reactivar MCP' : 'Apagar MCP'}
          </button>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {overview?.mcpDisabled
            ? 'Las llamadas al endpoint /mcp devuelven 503 hasta que reactives. Útil para emergencias o mantenimiento.'
            : 'Toggle de emergencia: cuando está apagado, ningún cliente puede usar el MCP, devuelve 503. Tu UI web sigue funcionando normal.'}
        </p>
      </Section>

      {/* Clientes registrados */}
      <Section title={`Clientes registrados (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-gray-500">Ningún cliente OAuth registrado todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr><th className="text-left py-2">Nombre</th><th className="text-left">Client ID</th><th className="text-left">Tokens activos</th><th className="text-left">Creado</th><th className="text-left">Último uso</th><th></th></tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.client_id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-medium text-gray-900 dark:text-white">{c.client_name || '(sin nombre)'}</td>
                    <td className="font-mono text-xs text-gray-500">{c.client_id.slice(0, 16)}…</td>
                    <td>{c.active_tokens}</td>
                    <td className="text-gray-500">{fmtDate(c.created_at)}</td>
                    <td className="text-gray-500">{fmtDate(c.last_used_at)}</td>
                    <td className="text-right">
                      <button onClick={() => deleteClient(c.client_id, c.client_name)} className="text-red-600 hover:text-red-700 text-xs">Borrar</button>
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
          <p className="text-sm text-gray-500">Ningún token activo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr><th className="text-left py-2">Usuario</th><th className="text-left">Cliente</th><th className="text-left">Scope</th><th className="text-left">Último uso</th><th className="text-left">Expira</th><th></th></tr>
              </thead>
              <tbody>
                {tokens.map(t => (
                  <tr key={t.token_hash} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-2 font-medium text-gray-900 dark:text-white">{t.user_email || `#${t.user_id}`}</td>
                    <td>{t.client_name || t.client_id?.slice(0, 12) + '…'}</td>
                    <td className="text-xs text-gray-500">{t.scope || '—'}</td>
                    <td className="text-gray-500">{fmtDate(t.last_used_at)}</td>
                    <td className="text-gray-500">{fmtDate(t.expires_at)}</td>
                    <td className="text-right">
                      <button onClick={() => revokeToken(t.token_hash)} className="text-red-600 hover:text-red-700 text-xs">Revocar</button>
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
            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
              <tr><th className="text-left py-2">Usuario</th><th className="text-left">Rol</th><th className="text-left">Cuota/día</th><th className="text-left">Usado hoy</th><th className="text-left">MCP</th></tr>
            </thead>
            <tbody>
              {quotas.map(u => (
                <tr key={u.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 font-medium text-gray-900 dark:text-white">{u.email}</td>
                  <td className="text-gray-500 text-xs">{u.role}</td>
                  <td>
                    {u.role === 'owner' ? (
                      <span className="text-gray-400 text-xs">sin límite (owner)</span>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        defaultValue={u.quota ?? ''}
                        placeholder="∞"
                        className="w-20 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded"
                        onBlur={(e) => {
                          const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                          if (v !== (u.quota ?? null)) updateUserQuota(u.id, { quota: v });
                        }}
                      />
                    )}
                  </td>
                  <td className={u.used_today > 0 ? 'font-medium' : 'text-gray-400'}>{u.used_today}</td>
                  <td>
                    {u.role !== 'owner' && (
                      <label className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={!u.mcp_disabled}
                          onChange={(e) => updateUserQuota(u.id, { mcp_disabled: !e.target.checked })}
                        />
                        <span className={u.mcp_disabled ? 'text-red-600' : 'text-green-600'}>
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
        <p className="text-xs text-gray-500 mt-2">
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
              className="bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1"
            >
              <option value="">Todos los tools</option>
              <option value="list_my_transcriptions">list_my_transcriptions</option>
              <option value="transcribe_video_url">transcribe_video_url</option>
              <option value="get_transcription">get_transcription</option>
              <option value="analyze_ideas">analyze_ideas</option>
            </select>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={auditFilter.only_errors}
                onChange={(e) => setAuditFilter(f => ({ ...f, only_errors: e.target.checked }))}
              />
              Solo errores
            </label>
            <button onClick={loadAll} className="text-purple-600 hover:underline">Recargar</button>
          </div>
        }
      >
        {audit.length === 0 ? (
          <p className="text-sm text-gray-500">No hay actividad MCP que mostrar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase border-b border-gray-200 dark:border-gray-700">
                <tr><th className="text-left py-2">Cuándo</th><th className="text-left">Usuario</th><th className="text-left">Tool</th><th className="text-left">Args</th><th className="text-left">Duración</th><th className="text-left">Costo</th><th className="text-left">Estado</th></tr>
              </thead>
              <tbody>
                {audit.map(a => (
                  <tr key={a.id} className={`border-b border-gray-100 dark:border-gray-800 ${a.success ? '' : 'bg-red-50 dark:bg-red-900/10'}`}>
                    <td className="py-2 text-xs text-gray-500 whitespace-nowrap">{fmtDate(a.created_at)}</td>
                    <td className="text-xs">{a.user_email || `#${a.user_id}`}</td>
                    <td className="text-xs font-mono">{a.tool_name}</td>
                    <td className="text-xs text-gray-500 font-mono max-w-xs truncate" title={a.args_summary}>{a.args_summary || '—'}</td>
                    <td className="text-xs">{fmtMs(a.duration_ms)}</td>
                    <td className="text-xs">{a.cost_usd > 0 ? fmtMoney(a.cost_usd) : '—'}</td>
                    <td>
                      {a.success
                        ? <span className="text-green-600 text-xs">✓ ok</span>
                        : <span className="text-red-600 text-xs" title={a.error_message}>✗ error</span>}
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
