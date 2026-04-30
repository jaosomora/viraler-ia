import React, { useState, useEffect } from 'react';
import { getUsageStats, resetUsageStats, deleteHistoryEntry, getAdminTranscriptions, getAdminConversions, getAdminUsers, resetUserPassword, setUserAccess } from '../services/usageStats';
import Spinner from '../components/Spinner';
import SecretsAdmin from '../components/SecretsAdmin';

const AdminPanel = () => {
  const [usageData, setUsageData] = useState(null);
  const [transcriptions, setTranscriptions] = useState([]);
  const [conversions, setConversions] = useState([]);
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
      const [data, txns, convs, us] = await Promise.all([
        getUsageStats(),
        getAdminTranscriptions(),
        getAdminConversions(),
        getAdminUsers()
      ]);
      setUsageData(data);
      setTranscriptions(txns);
      setConversions(convs);
      setUsers(us);
      setError(null);
    } catch (err) {
      setError(err.message || 'Error al cargar datos de uso');
    } finally {
      setIsLoading(false);
    }
  };

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
        <p className="text-gray-600 dark:text-gray-300">Cargando estadísticas de uso...</p>
      </div>
    );
  }

  if (error && !usageData) {
    return (
      <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
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
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 p-4 rounded-lg flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Panel de Administración
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          Monitorea uso, gestiona usuarios y secretos
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {[
            { id: 'resumen', label: 'Resumen', icon: '📊' },
            { id: 'usuarios', label: 'Usuarios', icon: '👥', badge: users.length },
            { id: 'transcripciones', label: 'Transcripciones', icon: '📝', badge: transcriptions.length },
            { id: 'conversiones', label: 'Conversiones', icon: '📄', badge: conversions.length },
            { id: 'secretos', label: 'Secretos', icon: '🔐' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap flex items-center gap-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Acciones</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleResetClick}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reiniciar Contadores
          </button>
          <button
            onClick={() => fetchUsageData()}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar Datos
          </button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Transcripciones</h3>
            <div className="p-2 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{usageData.totalTranscriptions}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">transcripciones totales</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Minutos de audio</h3>
            <div className="p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatNumber(usageData.totalAudioMinutes)}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">minutos procesados</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Costo total</h3>
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{formatPrice(usageData.estimatedCost)}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">costo estimado (USD)</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Conversiones</h3>
            <div className="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">{usageData.totalConversions || 0}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">documentos convertidos</p>
        </div>
      </div>

      {/* Estadísticas adicionales */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Estadísticas de Transcripción</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Promedio por transcripción</h3>
            <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-300">Costo</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatPrice(usageData.averageCostPerTranscription)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Duración</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatNumber(usageData.averageAudioMinutesPerTranscription)} min</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Modelo de Transcripción</h3>
            <div className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50 p-4 rounded-lg border dark:border-gray-700">
              <div className="flex justify-between mb-2">
                <span className="text-gray-600 dark:text-gray-300">Modelo</span>
                <span className="font-medium text-gray-900 dark:text-white">gpt-4o-mini-transcribe</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-300">Costo por minuto</span>
                <span className="font-medium text-gray-900 dark:text-white">$0.003</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de uso */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Historial de uso reciente</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-750 dark:bg-gray-900/50">
              <tr>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Transcripciones</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Minutos</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Costo</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Conversiones</th>
                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Accion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {usageData.recentHistory && usageData.recentHistory.map((entry, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-750 dark:hover:bg-gray-900/30">
                  <td className="py-3 px-6 text-sm font-medium text-gray-900 dark:text-white">{entry.date}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{entry.transcriptions}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{formatNumber(entry.audioMinutes)}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{formatPrice(entry.cost)}</td>
                  <td className="py-3 px-6 text-sm text-gray-500 dark:text-gray-300">{entry.conversions || 0}</td>
                  <td className="py-3 px-6 text-sm">
                    <button
                      onClick={() => handleDeleteClick(entry.date)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {(!usageData.recentHistory || usageData.recentHistory.length === 0) && (
                <tr>
                  <td colSpan="6" className="py-4 px-6 text-sm text-center text-gray-500 dark:text-gray-400">
                    No hay datos históricos disponibles
                  </td>
                </tr>
              )}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Transcripciones recientes</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {transcriptions.length === 0 && (
            <p className="p-6 text-sm text-center text-gray-500 dark:text-gray-400">No hay transcripciones</p>
          )}
          {transcriptions.slice(0, 10).map((t) => (
            <div key={t.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.title}</h3>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">{t.platform}</span>
                    {t.channel && <span>{t.channel}</span>}
                    <span>{new Date(t.createdAt).toLocaleString()}</span>
                    {t.duration > 0 && <span>{(t.duration / 60).toFixed(1)} min</span>}
                  </div>
                </div>
                <button
                  onClick={() => setExpandedTranscription(expandedTranscription === t.id ? null : t.id)}
                  className="ml-2 text-xs text-purple-600 dark:text-purple-400 hover:underline whitespace-nowrap"
                >
                  {expandedTranscription === t.id ? 'Ocultar' : 'Ver texto'}
                </button>
              </div>
              {expandedTranscription === t.id && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto whitespace-pre-wrap">
                  {t.text}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {/* === TAB: CONVERSIONES === */}
      {activeTab === 'conversiones' && (
      <>
      {/* Conversiones recientes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Conversiones recientes</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {conversions.length === 0 && (
            <p className="p-6 text-sm text-center text-gray-500 dark:text-gray-400">No hay conversiones</p>
          )}
          {conversions.slice(0, 10).map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.filename}</h3>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">{c.originalFormat?.toUpperCase()}</span>
                    {c.fileSize > 0 && <span>{(c.fileSize / 1024).toFixed(0)} KB</span>}
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedConversion(expandedConversion === c.id ? null : c.id)}
                  className="ml-2 text-xs text-purple-600 dark:text-purple-400 hover:underline whitespace-nowrap"
                >
                  {expandedConversion === c.id ? 'Ocultar' : 'Ver markdown'}
                </button>
              </div>
              {expandedConversion === c.id && (
                <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm text-gray-700 dark:text-gray-300 max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Usuarios y acceso</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Asigna hasta cuándo cada cliente puede usar la herramienta. Click en un usuario para editar.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] min-h-[420px]">
          {/* Lista compacta */}
          <ul className="divide-y divide-gray-200 dark:divide-gray-700 lg:border-r lg:border-gray-200 lg:dark:border-gray-700">
            {users.length === 0 && (
              <li className="px-4 py-6 text-sm text-center text-gray-500 dark:text-gray-400">No hay usuarios</li>
            )}
            {users.map((u) => {
              const st = accessStatus(u);
              const initials = (u.name || u.email).slice(0, 2).toUpperCase();
              const isSelected = u.id === selectedUserId;
              const toneClass =
                st.tone === 'expired' ? 'text-red-500'
                : st.tone === 'warning' ? 'text-amber-500'
                : st.tone === 'active' ? 'text-emerald-500'
                : 'text-gray-400';
              return (
                <li
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-l-2 border-purple-500'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 grid place-items-center text-xs font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</div>
                    </div>
                  </div>
                  <span className={`text-xs ml-2 shrink-0 ${toneClass}`}>
                    {u.role === 'owner' || !u.access_expires_at ? '∞' : formatAccessDate(u.access_expires_at)}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* Drawer / detalle */}
          {!selectedUser ? (
            <div className="grid place-items-center p-10 text-center text-gray-500 dark:text-gray-400">
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
                  <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 grid place-items-center font-semibold">
                    {(selectedUser.name || selectedUser.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedUser.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedUser.email} · <span className="capitalize">{selectedUser.role}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserId(null)}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
                  aria-label="Cerrar"
                >✕</button>
              </div>

              {/* Estado actual */}
              {(() => {
                const st = accessStatus(selectedUser);
                const bg =
                  st.tone === 'expired' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40'
                  : st.tone === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40'
                  : st.tone === 'active' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-gray-50 dark:bg-gray-900/40 border-gray-200 dark:border-gray-700';
                const dot =
                  st.tone === 'expired' ? 'bg-red-500'
                  : st.tone === 'warning' ? 'bg-amber-500'
                  : st.tone === 'active' ? 'bg-emerald-500'
                  : 'bg-gray-400';
                return (
                  <div className={`p-4 rounded-lg border ${bg}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Estado actual</span>
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-200">
                        <span className={`w-2 h-2 rounded-full ${dot}`}></span> {st.label}
                      </span>
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-white">
                      {selectedUser.role === 'owner' || !selectedUser.access_expires_at
                        ? 'Sin límite'
                        : `Hasta el ${formatAccessDate(selectedUser.access_expires_at)}`}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{st.detail}</div>
                  </div>
                );
              })()}

              {/* Editar acceso (oculto para owner) */}
              {selectedUser.role === 'owner' ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  El owner siempre tiene acceso permanente.
                </div>
              ) : (
                <div>
                  <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-3">
                    Extender acceso
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    <button onClick={() => addMonths(1)} className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100">+1 mes</button>
                    <button onClick={() => addMonths(3)} className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100">+3 meses</button>
                    <button onClick={() => addMonths(6)} className="px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100">+6 meses</button>
                    <button onClick={() => addMonths(12)} className="px-3 py-2 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium">+1 año</button>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">O fecha exacta</label>
                      <input
                        type="date"
                        value={draftDate}
                        disabled={draftUnlimited}
                        onChange={(e) => setDraftDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-md bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-white disabled:opacity-50"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pb-2">
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
                      className="px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium disabled:opacity-50"
                    >
                      Revocar acceso
                    </button>
                    <button
                      onClick={handleSaveAccess}
                      disabled={savingAccess || (!draftUnlimited && !draftDate)}
                      className="px-5 py-2 text-sm rounded-md bg-purple-600 hover:bg-purple-700 text-white font-medium disabled:opacity-50"
                    >
                      {savingAccess ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                  </div>
                </div>
              )}

              {/* Acciones extra */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-wrap gap-3 text-sm">
                <button
                  onClick={() => handleResetPassword(selectedUser)}
                  className="text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Resetear contraseña
                </button>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-gray-500 dark:text-gray-400">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Contraseña temporal generada</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3 text-sm">
              Comparte esta contraseña con <strong>{resetUserTarget?.email}</strong>. No se volverá a mostrar.
            </p>
            <div className="bg-gray-100 dark:bg-gray-900 p-3 rounded-md font-mono text-center text-lg mb-4 select-all">
              {resetResult}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => navigator.clipboard.writeText(resetResult)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Copiar
              </button>
              <button
                onClick={closeResetModal}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para reiniciar datos */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar reinicio de datos</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas reiniciar los contadores de uso? Esta acción no se puede deshacer.
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => handleResetConfirm(false)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center"
              >
                Reiniciar Todo (Incluido Historial)
              </button>
              <button
                onClick={() => handleResetConfirm(true)}
                className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 flex items-center justify-center"
              >
                Reiniciar Solo Contadores (Mantener Historial)
              </button>
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar registro */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md mx-auto p-6 shadow-xl">
            <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">Confirmar eliminación</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              ¿Estás seguro de que deseas eliminar el registro del {deleteTarget}? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelAction}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
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