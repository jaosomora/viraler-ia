import React, { useState, useEffect } from 'react';
import { getUsageStats, resetUsageStats, deleteHistoryEntry, getAdminTranscriptions, getAdminConversions, getAdminUsers, getAdminClips, getAdminReels, resetUserPassword, setUserAccess } from '../services/usageStats';
import Spinner from '../components/Spinner';
import SecretsAdmin from '../components/SecretsAdmin';
import ClipsAdmin from '../components/ClipsAdmin';
import ReelsAdmin from '../components/ReelsAdmin';
import MCPAdmin from '../components/MCPAdmin';
import IdeaMapsAdmin from '../components/IdeaMapsAdmin';

const AdminPanel = () => {
  const [usageData, setUsageData] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [clipJobs, setClipJobs] = useState([]);
  const [reelJobs, setReelJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [expandedTranscription, setExpandedTranscription] = useState(null);
  const [expandedConversion, setExpandedConversion] = useState(null);
  const [users, setUsers] = useState([]);
  const [resetResult, setResetResult] = useState(null);
  const [resetUserTarget, setResetUserTarget] = useState(null);
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('admin_active_tab') || 'resumen');
  useEffect(() => { localStorage.setItem('admin_active_tab', activeTab); }, [activeTab]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [draftDate, setDraftDate] = useState('');
  const [draftUnlimited, setDraftUnlimited] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const selectedUser = users.find(u => u.id === selectedUserId) || null;

  // Sincronizar el formulario del drawer cuando cambia el usuario seleccionado
  useEffect(() => {
    if (!selectedUser) return;
    if (!selectedUser.access_expires_at) {
      setDraftUnlimited(selectedUser.role === 'owner' ? true : false);
      setDraftDate('');
    } else {
      setDraftUnlimited(false);
      setDraftDate(selectedUser.access_expires_at.slice(0, 10));
    }
  }, [selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const accessStatus = (u) => {
    if (u.role === 'owner') return { label: 'Sin límite', tone: 'neutral', detail: 'Owner · acceso permanente' };
    if (!u.access_expires_at) return { label: 'Sin límite', tone: 'neutral', detail: 'Uso interno' };
    const now = Date.now();
    const exp = new Date(u.access_expires_at).getTime();
    const days = Math.round((exp - now) / 86400000);
    if (exp < now) return { label: 'Expirado', tone: 'expired', detail: `Venció hace ${Math.abs(days)} días` };
    if (days <= 7) return { label: 'Por vencer', tone: 'warning', detail: `Faltan ${days} días` };
    return { label: 'Activo', tone: 'active', detail: `Faltan ${days} días` };
  };

  const formatAccessDate = (iso) => {
    if (!iso) return '∞';
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const addMonths = (months) => {
    const base = new Date();
    base.setMonth(base.getMonth() + months);
    setDraftUnlimited(false);
    setDraftDate(base.toISOString().slice(0, 10));
  };

  const handleSaveAccess = async () => {
    if (!selectedUser) return;
    try {
      setSavingAccess(true);
      const expiresAt = draftUnlimited ? null : (draftDate ? new Date(`${draftDate}T23:59:59`).toISOString() : null);
      await setUserAccess(selectedUser.id, expiresAt);
      setActionSuccess(`Acceso actualizado para ${selectedUser.email}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
    } catch (err) {
      setError(err.message || 'Error al actualizar acceso');
    } finally {
      setSavingAccess(false);
    }
  };

  const handleRevokeAccess = async () => {
    if (!selectedUser) return;
    try {
      setSavingAccess(true);
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      await setUserAccess(selectedUser.id, yesterday);
      setActionSuccess(`Acceso revocado para ${selectedUser.email}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
      setDraftDate(yesterday.slice(0, 10));
      setDraftUnlimited(false);
    } catch (err) {
      setError(err.message || 'Error al revocar acceso');
    } finally {
      setSavingAccess(false);
    }
  };

  const fetchUsageData = async () => {
    try {
      setIsLoading(true);
      const [data, txns, convs, us, clips, reels] = await Promise.all([
        getUsageStats(),
        getAdminTranscriptions(),
        getAdminConversions(),
        getAdminUsers(),
        getAdminClips().catch(() => []),
        getAdminReels().catch(() => []),
      ]);
      setUsageData(data);
      setTranscriptions(txns);
      setConversions(convs);
      setUsers(us);
      setClipJobs(clips || []);
      setReelJobs(reels || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar datos de uso');
    } finally {
      setIsLoading(false);
    }
  };

  // Aggregate de costos clips para el Resumen
  const clipsAgg = (() => {
    const total = (clipJobs || []).reduce((acc, j) => ({
      jobs: acc.jobs + 1,
      clips: acc.clips + (j.clip_count || 0),
      cost: acc.cost + (j.total_cost_usd || 0),
      whisperCost: acc.whisperCost + (j.whisper_cost_usd || 0),
      llmCost: acc.llmCost + (j.llm_cost_usd || 0),
      minutes: acc.minutes + ((j.duration_seconds || 0) / 60),
    }), { jobs: 0, clips: 0, cost: 0, whisperCost: 0, llmCost: 0, minutes: 0 });
    return total;
  })();

  useEffect(() => {
    fetchUsageData();
  }, []);

  // Mostrar confirmación para reiniciar los datos
  const handleResetClick = () => {
    setShowResetConfirm(true);
  };

  // Confirmar reinicio de datos
  const handleResetConfirm = async (keepHistory) => {
    try {
      await resetUsageStats(keepHistory);
      setActionSuccess(`Datos de uso reiniciados correctamente${keepHistory ? ' (manteniendo historial)' : ''}`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
    } catch (err) {
      setError(err.message || 'Error al reiniciar datos');
    } finally {
      setShowResetConfirm(false);
    }
  };

  // Mostrar confirmación para eliminar una entrada del historial
  const handleDeleteClick = (date) => {
    setDeleteTarget(date);
    setShowDeleteConfirm(true);
  };

  // Confirmar eliminación de entrada
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    
    try {
      await deleteHistoryEntry(deleteTarget);
      setActionSuccess(`Registro del ${deleteTarget} eliminado correctamente`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchUsageData();
    } catch (err) {
      setError(err.message || 'Error al eliminar registro');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  // Cancelar cualquier confirmación
  const handleCancelAction = () => {
    setShowDeleteConfirm(false);
    setShowResetConfirm(false);
    setDeleteTarget(null);
  };

  const handleResetPassword = async (user) => {
    try {
      setResetUserTarget(user);
      const result = await resetUserPassword(user.id);
      setResetResult(result.tempPassword);
    } catch (err) {
      setError(err.message || 'Error al resetear contraseña');
      setResetUserTarget(null);
    }
  };

  const closeResetModal = () => {
    setResetResult(null);
    setResetUserTarget(null);
  };

  if (isLoading && !usageData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <Spinner size="xl" />
        <p className="text-ink-500 dark:text-ink-400">Cargando estadísticas de uso...</p>
      </div>
    );
  }

  if (error && !usageData) {
    return (
      <div className="bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30 text-danger dark:text-danger-bright p-4 rounded-xl">
        <div className="flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Error: {error}</span>
        </div>
      </div>
    );
  }

  // Formatear números
  const formatNumber = (num, decimals = 2) => {
    return Number(num).toFixed(decimals);
  };

  // Formatear precio
  const formatPrice = (amount) => {
    return `$${Number(amount).toFixed(4)}`;
  };

  return (
    <div className="flex flex-col space-y-6 max-w-6xl mx-auto">
      {/* Mensaje de acción exitosa */}
      {actionSuccess && (
        <div className="bg-ok-soft dark:bg-ok-deep border border-ok/30 dark:border-ok-bright/30 text-ok dark:text-ok-bright p-4 rounded-xl flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{actionSuccess}</span>
        </div>
      )}

      <div>
        <span className="eyebrow">Sala de control</span>
        <h1 className="mt-2 font-display text-2xl md:text-3xl font-bold tracking-tight">
          Panel de Administración
        </h1>
        <p className="mt-2 text-ink-500 dark:text-ink-400">
          Monitorea uso, gestiona usuarios y secretos
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-ink-200 dark:border-ink-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen', icon: '📊' },
            { id: 'usuarios', label: 'Usuarios', icon: '👥', badge: users.length },
            { id: 'transcripciones', label: 'Transcripciones', icon: '📝', badge: transcriptions.length },
            { id: 'clips', label: 'Clips', icon: '🎬' },
            { id: 'reels', label: 'Reels', icon: '🎵' },
            { id: 'conversiones', label: 'Conversiones', icon: '📄', badge: conversions.length },
            { id: 'idea_maps', label: 'Mapas de ideas', icon: '💡' },
            { id: 'secretos', label: 'Secretos', icon: '🔐' },
            { id: 'mcp', label: 'MCP', icon: '🔌' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-accent text-accent dark:border-accent-bright dark:text-accent-bright'
                  : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 font-mono text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.id
                    ? 'bg-accent-soft text-accent dark:bg-accent-deep dark:text-accent-bright'
                    : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* === TAB: RESUMEN === */}
      {activeTab === 'resumen' && (
      <>
      {/* Controles de administración */}
      <div className="card p-6">
        <h2 className="font-display text-xl font-semibold tracking-tight mb-4">Acciones</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleResetClick}
            className="btn btn-ghost"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar Contadores
          </button>
          <button
            onClick={() => fetchUsageData()}
            className="btn btn-ghost"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Costo total unificado — toda la cuenta lo que has gastado */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Costo total acumulado · todas las herramientas</h3>
          <svg className="w-5 h-5 text-ink-400 dark:text-ink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-mono text-4xl font-bold tabular-nums">{formatPrice((usageData.estimatedCost || 0) + clipsAgg.cost + (usageData.totalAnalysesCost || 0) + (usageData.totalIdeaMapsCost || 0))}</p>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="bg-ink-100 dark:bg-ink-900 rounded-xl px-3 py-2">
            <div className="text-[11px] text-ink-500 dark:text-ink-400">Transcripciones</div>
            <div className="font-mono font-semibold tabular-nums">{formatPrice(usageData.estimatedCost || 0)}</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 rounded-xl px-3 py-2">
            <div className="text-[11px] text-ink-500 dark:text-ink-400">Clips · Whisper {formatPrice(clipsAgg.whisperCost)} + LLM {formatPrice(clipsAgg.llmCost)}</div>
            <div className="font-mono font-semibold tabular-nums">{formatPrice(clipsAgg.cost)}</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 rounded-xl px-3 py-2">
            <div className="text-[11px] text-ink-500 dark:text-ink-400">Análisis de ideas · {usageData.totalAnalyses || 0} corridas</div>
            <div className="font-mono font-semibold tabular-nums">{formatPrice(usageData.totalAnalysesCost || 0)}</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 rounded-xl px-3 py-2">
            <div className="text-[11px] text-ink-500 dark:text-ink-400">Mapas de ideas · {usageData.totalIdeaMaps || 0} exitosos</div>
            <div className="font-mono font-semibold tabular-nums">{formatPrice(usageData.totalIdeaMapsCost || 0)}</div>
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Transcripciones</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{usageData.totalTranscriptions}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatNumber(usageData.totalAudioMinutes)} min · {formatPrice(usageData.estimatedCost)}</p>
        </div>

        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Análisis de ideas</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{usageData.totalAnalyses || 0}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatPrice(usageData.totalAnalysesCost || 0)} · gpt-4o-mini</p>
        </div>

        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Clips generados</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{clipsAgg.clips}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{clipsAgg.jobs} jobs · {Math.round(clipsAgg.minutes)} min · {formatPrice(clipsAgg.cost)}</p>
        </div>

        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Mapas de ideas</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{usageData.totalIdeaMaps || 0}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{formatPrice(usageData.totalIdeaMapsCost || 0)} · gpt-4o-mini</p>
        </div>

        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Conversiones</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{usageData.totalConversions || 0}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">documentos</p>
        </div>

        <div className="card p-5">
          <h3 className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Usuarios</h3>
          <p className="mt-2 font-display text-2xl font-bold tabular-nums">{users.length}</p>
          <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">registrados</p>
        </div>
      </div>

      {/* Modelos de IA en uso — todos los que cuestan dinero */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-ink-200 dark:border-ink-700">
          <h2 className="font-display text-xl font-semibold tracking-tight">Modelos de IA en uso</h2>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Todos los servicios externos que generan costo en la app</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Transcribir</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o-mini-transcribe</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.003 / minuto · audio → texto</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Análisis de ideas</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o-mini</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.15/M input · $0.60/M output · ~$0.002/análisis</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Generador de Ideas</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o-mini</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">2 llamadas/mapa exitoso (gate + generate) · ~$0.003 · MCP $0</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Clips · transcripción</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">whisper-1</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.006 / minuto · word-timestamps</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Clips · highlights</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$2.50/M input · $10/M output</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Clips · keywords</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o-mini</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.15/M input · $0.60/M output</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700 opacity-60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Anthropic</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">no configurado</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">claude-sonnet-4</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">No conectado · pendiente activar</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Convertir</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">local</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">markitdown</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0 · sin LLM, conversión nativa</div>
          </div>

          {/* AS Reels Cleaner */}
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Reels · transcripción</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">whisper-1</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.006 / minuto · word-timestamps</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Reels · sugerir música</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">OpenAI / Anthropic</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">gpt-4o-mini · claude-sonnet-4-5</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0.001 / sugerencia (mini) · $0.02 (sonnet)</div>
          </div>
          <div className="bg-ink-100 dark:bg-ink-900 p-4 rounded-xl border border-ink-200 dark:border-ink-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wider text-accent dark:text-accent-bright font-semibold">Reels · música</span>
              <span className="text-[11px] text-ink-500 dark:text-ink-400">Jamendo</span>
            </div>
            <div className="font-mono text-sm text-ink-950 dark:text-paper">jamendo API</div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-1">$0 · CC, instrumentales, 35K req/mes</div>
          </div>
        </div>
      </div>

      {/* Historial de uso unificado: transcripciones + clips por fecha */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-ink-200 dark:border-ink-700">
          <h2 className="font-display text-xl font-semibold tracking-tight">Historial de uso reciente</h2>
          <p className="text-xs text-ink-500 dark:text-ink-400 mt-1">Actividad agregada por día — todas las herramientas</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-ink-200 dark:border-ink-700">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Fecha</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Transcripciones</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Análisis</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Mapas</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Clips</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Reels</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Min. totales</th>
                <th className="py-3 px-6 text-right text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">Costo total</th>
                <th className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-200 dark:divide-ink-700">
              {(() => {
                const byDate = {};
                const empty = d => ({ date: d, txns: 0, txnMin: 0, txnCost: 0, analyses: 0, analysesCost: 0, ideaMaps: 0, ideaMapsCost: 0, clipJobs: 0, clipMin: 0, clipCost: 0, reelJobs: 0, reelMin: 0, reelCost: 0 });
                (usageData.recentHistory || []).forEach(e => {
                  byDate[e.date] = byDate[e.date] || empty(e.date);
                  byDate[e.date].txns += e.transcriptions || 0;
                  byDate[e.date].txnMin += e.audioMinutes || 0;
                  byDate[e.date].txnCost += e.cost || 0;
                  byDate[e.date].analyses += e.analyses || 0;
                  byDate[e.date].analysesCost += e.analysesCost || 0;
                  byDate[e.date].ideaMaps += e.ideaMaps || 0;
                  byDate[e.date].ideaMapsCost += e.ideaMapsCost || 0;
                });
                (clipJobs || []).forEach(j => {
                  if (!j.created_at) return;
                  const date = j.created_at.slice(0, 10);
                  byDate[date] = byDate[date] || empty(date);
                  byDate[date].clipJobs += 1;
                  byDate[date].clipMin += (j.duration_seconds || 0) / 60;
                  byDate[date].clipCost += j.total_cost_usd || 0;
                });
                (reelJobs || []).forEach(j => {
                  if (!j.created_at) return;
                  const date = j.created_at.slice(0, 10);
                  byDate[date] = byDate[date] || empty(date);
                  byDate[date].reelJobs += 1;
                  byDate[date].reelMin += (j.duration_seconds || 0) / 60;
                  byDate[date].reelCost += j.total_cost_usd || 0;
                });
                const rows = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
                if (rows.length === 0) {
                  return (
                    <tr><td colSpan="9" className="py-8 px-6 text-sm text-center text-ink-500 dark:text-ink-400">Sin actividad aún</td></tr>
                  );
                }
                return rows.map((r) => (
                  <tr key={r.date} className="hover:bg-ink-100/50 dark:hover:bg-ink-800/50">
                    <td className="py-3 px-6 timecode font-medium">{r.date}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{r.txns}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{r.analyses || '–'}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{r.ideaMaps || '–'}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{r.clipJobs || '–'}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{r.reelJobs || '–'}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums">{formatNumber(r.txnMin + r.clipMin + r.reelMin)}</td>
                    <td className="py-3 px-6 text-sm text-right font-mono tabular-nums font-semibold text-accent dark:text-accent-bright">{formatPrice(r.txnCost + r.clipCost + r.reelCost + (r.analysesCost || 0) + (r.ideaMapsCost || 0))}</td>
                    <td className="py-3 px-6 text-right">
                      {r.txns > 0 && (
                        <button onClick={() => handleDeleteClick(r.date)}
                          className="text-xs text-danger dark:text-danger-bright hover:bg-danger-soft dark:hover:bg-danger-deep p-1 rounded-full transition-colors"
                          title="Eliminar registro de transcripciones de este día">
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* === TAB: TRANSCRIPCIONES === */}
      {activeTab === 'transcripciones' && (
      <>
      {/* Transcripciones recientes */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-ink-200 dark:border-ink-700">
          <h2 className="font-display text-xl font-semibold tracking-tight">Transcripciones recientes</h2>
        </div>
        <div className="divide-y divide-ink-200 dark:divide-ink-700">
          {transcriptions.length === 0 && (
            <p className="p-6 text-sm text-center text-ink-500 dark:text-ink-400">No hay transcripciones</p>
          )}
          {transcriptions.slice(0, 20).map((t) => {
            const fmt = (n) => {
              if (n === null || n === undefined) return null;
              if (n < 1000) return String(n);
              if (n < 1e6) return `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '')}K`;
              return `${(n / 1e6).toFixed(n < 1e7 ? 1 : 0).replace(/\.0$/, '')}M`;
            };
            const hasMetrics = t.viewCount || t.likeCount || t.commentCount;
            const hasAnalysis = !!t.analysis;
            return (
              <div key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-ink-950 dark:text-paper truncate">{t.title}</h3>
                      {hasAnalysis && (
                        <span className="chip chip-ok">
                          ✨ Analizado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-ink-500 dark:text-ink-400">
                      <span className="chip chip-accent">{t.platform}</span>
                      {t.uploaderHandle && <span className="font-medium">@{t.uploaderHandle}</span>}
                      {t.channel && t.channel !== t.uploaderHandle && <span>{t.channel}</span>}
                      <span>{new Date(t.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}</span>
                      {t.duration > 0 && <span>{(t.duration / 60).toFixed(1)} min</span>}
                    </div>
                    {hasMetrics && (
                      <div className="flex flex-wrap gap-3 mt-2 text-sm text-ink-950 dark:text-paper">
                        {t.viewCount !== null && t.viewCount !== undefined && (
                          <span className="inline-flex items-center gap-1"><span aria-hidden="true">👁</span><span className="font-semibold tabular-nums">{fmt(t.viewCount)}</span></span>
                        )}
                        {t.likeCount !== null && t.likeCount !== undefined && (
                          <span className="inline-flex items-center gap-1"><span aria-hidden="true">❤️</span><span className="font-semibold tabular-nums">{fmt(t.likeCount)}</span></span>
                        )}
                        {t.commentCount !== null && t.commentCount !== undefined && (
                          <span className="inline-flex items-center gap-1"><span aria-hidden="true">💬</span><span className="font-semibold tabular-nums">{fmt(t.commentCount)}</span></span>
                        )}
                        {t.shareCount !== null && t.shareCount !== undefined && (
                          <span className="inline-flex items-center gap-1"><span aria-hidden="true">🔁</span><span className="font-semibold tabular-nums">{fmt(t.shareCount)}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedTranscription(expandedTranscription === t.id ? null : t.id)}
                    className="text-xs font-medium link-accent whitespace-nowrap"
                  >
                    {expandedTranscription === t.id ? 'Ocultar' : (hasAnalysis ? 'Ver texto + análisis' : 'Ver texto')}
                  </button>
                </div>
                {expandedTranscription === t.id && (
                  <div className="mt-3 space-y-3">
                    {hasAnalysis && (
                      <div className="p-3 bg-ok-soft dark:bg-ok-deep border border-ok/30 dark:border-ok-bright/30 rounded-xl">
                        <div className="text-[10px] uppercase tracking-wider text-ok dark:text-ok-bright font-bold mb-2">
                          ✨ Análisis de ideas {t.analysisModel ? `· ${t.analysisModel}` : ''}
                        </div>
                        <div className="text-sm text-ink-950 dark:text-paper max-h-60 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                          {t.analysis}
                        </div>
                      </div>
                    )}
                    {t.description && (
                      <div className="p-3 bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl">
                        <div className="text-[10px] uppercase tracking-wider text-ink-500 dark:text-ink-400 font-bold mb-1">Description del creador</div>
                        <div className="text-sm text-ink-950 dark:text-paper italic">"{t.description}"</div>
                      </div>
                    )}
                    <div className="p-3 bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl text-sm text-ink-950 dark:text-paper max-h-60 overflow-y-auto whitespace-pre-wrap">
                      {t.text}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}

      {/* === TAB: CLIPS === */}
      {activeTab === 'clips' && <ClipsAdmin />}
      {activeTab === 'reels' && <ReelsAdmin />}
      {activeTab === 'mcp' && <MCPAdmin />}
      {activeTab === 'idea_maps' && <IdeaMapsAdmin />}

      {/* === TAB: CONVERSIONES === */}
      {activeTab === 'conversiones' && (
      <>
      {/* Conversiones recientes */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-ink-200 dark:border-ink-700">
          <h2 className="font-display text-xl font-semibold tracking-tight">Conversiones recientes</h2>
        </div>
        <div className="divide-y divide-ink-200 dark:divide-ink-700">
          {conversions.length === 0 && (
            <p className="p-6 text-sm text-center text-ink-500 dark:text-ink-400">No hay conversiones</p>
          )}
          {conversions.slice(0, 10).map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-ink-950 dark:text-paper truncate">{c.filename}</h3>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-ink-500 dark:text-ink-400">
                    <span className="chip chip-neutral">{c.originalFormat?.toUpperCase()}</span>
                    {c.fileSize > 0 && <span>{(c.fileSize / 1024).toFixed(0)} KB</span>}
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedConversion(expandedConversion === c.id ? null : c.id)}
                  className="ml-2 text-xs font-medium link-accent whitespace-nowrap"
                >
                  {expandedConversion === c.id ? 'Ocultar' : 'Ver markdown'}
                </button>
              </div>
              {expandedConversion === c.id && (
                <div className="mt-3 p-3 bg-ink-100 dark:bg-ink-900 rounded-xl text-sm text-ink-950 dark:text-paper max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                  {c.markdown}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* === TAB: USUARIOS === */}
      {activeTab === 'usuarios' && (
      <>
      {/* Usuarios — gestión de acceso */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-ink-200 dark:border-ink-700">
          <h2 className="font-display text-xl font-semibold tracking-tight">Usuarios y acceso</h2>
          <p className="text-sm text-ink-500 dark:text-ink-400 mt-1">
            Asigna hasta cuándo cada cliente puede usar la herramienta. Click en un usuario para editar.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[420px]">
          {/* Lista compacta */}
          <ul className="divide-y divide-ink-200 dark:divide-ink-700 lg:border-r lg:border-ink-200 lg:dark:border-ink-700">
            {users.length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-ink-500 dark:text-ink-400">No hay usuarios</li>
            )}
            {users.map((u) => {
              const st = accessStatus(u);
              const initials = (u.name || u.email).slice(0, 2).toUpperCase();
              const isSelected = u.id === selectedUserId;
              const toneClass =
                st.tone === 'expired' ? 'text-danger dark:text-danger-bright'
                : st.tone === 'warning' ? 'text-warn dark:text-warn-bright'
                : st.tone === 'active' ? 'text-ok dark:text-ok-bright'
                : 'text-ink-400 dark:text-ink-500';
              return (
                <li
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-accent-soft dark:bg-accent-deep border-l-2 border-accent dark:border-accent-bright'
                      : 'hover:bg-ink-100/50 dark:hover:bg-ink-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-ink-100 dark:bg-ink-800 text-accent dark:text-accent-bright grid place-items-center text-xs font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink-950 dark:text-paper truncate">{u.name}</div>
                      <div className="text-xs text-ink-500 dark:text-ink-400 truncate">{u.email}</div>
                    </div>
                  </div>
                  <span className={`font-mono tabular-nums text-xs ml-2 shrink-0 ${toneClass}`}>
                    {u.role === 'owner' || !u.access_expires_at ? '∞' : formatAccessDate(u.access_expires_at)}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Drawer / detalle */}
          {!selectedUser ? (
            <div className="grid place-items-center p-10 text-center text-ink-500 dark:text-ink-400">
              <div>
                <div className="text-4xl mb-2">←</div>
                <p className="text-sm">Selecciona un usuario para ver y editar su acceso a la herramienta.</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-ink-100 dark:bg-ink-800 text-accent dark:text-accent-bright grid place-items-center font-semibold">
                    {(selectedUser.name || selectedUser.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">{selectedUser.name}</h3>
                    <p className="text-sm text-ink-500 dark:text-ink-400">
                      {selectedUser.email} · <span className="capitalize">{selectedUser.role}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-ink-400 hover:text-ink-950 dark:hover:text-paper transition-colors text-xl"
                  aria-label="Cerrar"
                >✕</button>
              </div>

              {/* Estado actual */}
              {(() => {
                const st = accessStatus(selectedUser);
                const bg =
                  st.tone === 'expired' ? 'bg-danger-soft dark:bg-danger-deep border-danger/30 dark:border-danger-bright/30'
                  : st.tone === 'warning' ? 'bg-warn-soft dark:bg-warn-deep border-warn/30 dark:border-warn-bright/30'
                  : st.tone === 'active' ? 'bg-ok-soft dark:bg-ok-deep border-ok/30 dark:border-ok-bright/30'
                  : 'bg-ink-100 dark:bg-ink-900 border-ink-200 dark:border-ink-700';
                const dot =
                  st.tone === 'expired' ? 'bg-danger dark:bg-danger-bright'
                  : st.tone === 'warning' ? 'bg-warn dark:bg-warn-bright'
                  : st.tone === 'active' ? 'bg-ok dark:bg-ok-bright'
                  : 'bg-ink-400 dark:bg-ink-500';
                return (
                  <div className={`p-4 rounded-xl border ${bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold">Estado actual</span>
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-950 dark:text-paper">
                        <span className={`w-2 h-2 rounded-full ${dot}`}></span> {st.label}
                      </span>
                    </div>
                    <div className="font-display text-xl font-semibold tracking-tight">
                      {selectedUser.role === 'owner' || !selectedUser.access_expires_at
                        ? 'Sin límite'
                        : `Hasta el ${formatAccessDate(selectedUser.access_expires_at)}`}
                    </div>
                    <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{st.detail}</div>
                  </div>
                );
              })()}

              {/* Editar acceso (oculto para owner) */}
              {selectedUser.role === 'owner' ? (
                <div className="text-sm text-ink-500 dark:text-ink-400 italic">
                  El owner siempre tiene acceso permanente.
                </div>
              ) : (
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-500 dark:text-ink-400 font-semibold mb-3">
                    Extender acceso
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <button onClick={() => addMonths(1)} className="btn btn-ghost btn-sm">+1 mes</button>
                    <button onClick={() => addMonths(3)} className="btn btn-ghost btn-sm">+3 meses</button>
                    <button onClick={() => addMonths(6)} className="btn btn-ghost btn-sm">+6 meses</button>
                    <button onClick={() => addMonths(12)} className="btn btn-accent btn-sm">+1 año</button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-ink-500 dark:text-ink-400 mb-1">O fecha exacta</label>
                      <input
                        type="date"
                        value={draftDate}
                        disabled={draftUnlimited}
                        onChange={(e) => setDraftDate(e.target.value)}
                        className="input"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 pb-2">
                        <input
                          type="checkbox"
                          checked={draftUnlimited}
                          onChange={(e) => setDraftUnlimited(e.target.checked)}
                          className="rounded"
                        />
                        Sin límite (uso interno)
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-end gap-2 mt-5">
                    <button
                      onClick={handleRevokeAccess}
                      disabled={savingAccess}
                      className="btn btn-ghost text-danger dark:text-danger-bright hover:bg-danger-soft dark:hover:bg-danger-deep"
                    >
                      Revocar acceso
                    </button>
                    <button
                      onClick={handleSaveAccess}
                      disabled={savingAccess || (!draftUnlimited && !draftDate)}
                      className="btn btn-accent"
                    >
                      {savingAccess ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}

              {/* Acciones extra */}
              <div className="border-t border-ink-200 dark:border-ink-700 pt-4 flex flex-wrap gap-3 text-sm">
                <button
                  onClick={() => handleResetPassword(selectedUser)}
                  className="link-accent font-medium"
                >
                  Resetear contraseña
                </button>
                <span className="text-ink-300 dark:text-ink-600">·</span>
                <span className="text-ink-500 dark:text-ink-400">
                  Registrado el {new Date(selectedUser.created_at).toLocaleDateString('es-CO')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      </>
      )}

      {/* === TAB: SECRETOS === */}
      {activeTab === 'secretos' && (
      <>
      {/* Sobres de credenciales */}
      <SecretsAdmin />
      </>
      )}

      {/* Modal de contraseña temporal */}
      {resetResult && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md mx-auto p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold tracking-tight mb-3">Contraseña temporal generada</h3>
            <p className="text-ink-500 dark:text-ink-400 mb-3 text-sm">
              Comparte esta contraseña con <strong>{resetUserTarget?.email}</strong>. No se volverá a mostrar.
            </p>
            <div className="bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 p-3 rounded-xl font-mono text-center text-lg mb-4 select-all">
              {resetResult}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(resetResult)}
                className="btn btn-ghost"
              >
                Copiar
              </button>
              <button
                onClick={closeResetModal}
                className="btn btn-accent"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para reiniciar datos */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md mx-auto p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold tracking-tight mb-3">Confirmar reinicio de datos</h3>
            <p className="text-ink-500 dark:text-ink-400 mb-4">
              ¿Estás seguro de que deseas reiniciar los contadores de uso? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => handleResetConfirm(false)}
                className="btn btn-danger w-full"
              >
                Reiniciar Todo (Incluido Historial)
              </button>
              <button
                onClick={() => handleResetConfirm(true)}
                className="btn btn-ghost w-full text-warn dark:text-warn-bright"
              >
                Reiniciar Solo Contadores (Mantener Historial)
              </button>
              <button
                onClick={handleCancelAction}
                className="btn btn-ghost w-full"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar registro */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md mx-auto p-6 shadow-2xl">
            <h3 className="font-display text-lg font-semibold tracking-tight mb-3">Confirmar eliminación</h3>
            <p className="text-ink-500 dark:text-ink-400 mb-4">
              ¿Estás seguro de que deseas eliminar el registro del {deleteTarget}? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleCancelAction}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="btn btn-danger"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;