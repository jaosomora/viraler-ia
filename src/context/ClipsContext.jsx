import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authFetch } from './AuthContext';
import { chunkedUpload } from '../services/chunkedUpload';

// Usamos URL relativa siempre para que Vite proxie /api desde cualquier IP (LAN, móvil, etc.)
const API_BASE = '/api';

const ClipsContext = createContext();
export const useClips = () => useContext(ClipsContext);

export const ClipsProvider = ({ children }) => {
  const [activeJobId, setActiveJobId] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [fontCatalog, setFontCatalog] = useState(null);
  const [stages, setStages] = useState([]);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // {loaded, total, pct} | null
  const pollRef = useRef(null);

  const loadFonts = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/clips/fonts`);
      if (res.ok) setFontCatalog(await res.json());
    } catch {}
  }, []);

  const loadStages = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/clips/stages`);
      if (res.ok) setStages((await res.json()).stages || []);
    } catch {}
  }, []);

  const loadJobs = useCallback(async () => {
    const res = await authFetch(`${API_BASE}/clips/jobs`);
    if (res.ok) setJobs(await res.json());
  }, []);

  const loadJob = useCallback(async (jobId) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}`);
    if (res.ok) {
      const data = await res.json();
      setActiveJob(data);
      return data;
    }
  }, []);

  // Polling: cada 3s mientras el job no esté done/error
  useEffect(() => {
    if (!activeJobId) return;
    const tick = async () => {
      const data = await loadJob(activeJobId);
      if (data && (data.status === 'done' || data.status === 'error')) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setIsGenerating(false);
        loadJobs();
      }
    };
    tick();
    pollRef.current = setInterval(tick, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeJobId, loadJob, loadJobs]);

  const generate = useCallback(async ({ url, file, options = {} }) => {
    setError(null);
    setIsGenerating(true);
    setUploadProgress(null);
    try {
      let body;
      if (file) {
        // Upload chunked: parte el archivo y sube en trozos de 5MB.
        // Reemplaza el single-shot multipart porque Render mata requests >100s.
        setUploadProgress({ loaded: 0, total: file.size, pct: 0 });
        const { uploadId } = await chunkedUpload(file, (p) => setUploadProgress(p));
        body = { uploadId, options };
      } else {
        body = { url, options };
      }
      const res = await authFetch(`${API_BASE}/clips/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setUploadProgress(null);
      if (!res.ok) throw new Error(data.error || 'Error al generar clips');
      setActiveJobId(data.jobId);
      await loadJobs();
      return data.jobId;
    } catch (err) {
      setUploadProgress(null);
      setError(err.message);
      setIsGenerating(false);
      throw err;
    }
  }, [loadJobs]);

  const updateClip = useCallback(async (clipId, updates) => {
    const res = await authFetch(`${API_BASE}/clips/${clipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error guardando');
    }
    if (activeJobId) await loadJob(activeJobId);
  }, [activeJobId, loadJob]);

  const regenerateCaption = useCallback(async (clipId, tone) => {
    const res = await authFetch(`${API_BASE}/clips/${clipId}/regenerate-caption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tone }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error');
    }
    const data = await res.json();
    if (activeJobId) await loadJob(activeJobId);
    return data;
  }, [activeJobId, loadJob]);

  const downloadClip = useCallback(async (clip, resolution = '1080') => {
    const url = `${API_BASE}/clips/${clip.id}/download?resolution=${resolution}`;
    const token = localStorage.getItem('token');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error descargando');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(clip.title || 'clip').replace(/[^\w\d.-]/g, '_')}_${resolution}p.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  // Modelo Opus: descarga el base.mp4 (sin subs) para reproducir en el editor con overlay HTML.
  const loadBaseVideoBlob = useCallback(async (clipId, resolution = '1080') => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/clips/${clipId}/base-video?resolution=${resolution}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error cargando video base');
    }
    return URL.createObjectURL(await res.blob());
  }, []);

  // Carga los chunks de subtítulos (timestamps relativos al clip) con overrides aplicados.
  const loadCaptions = useCallback(async (clipId) => {
    const res = await authFetch(`${API_BASE}/clips/${clipId}/captions`);
    if (!res.ok) throw new Error('Error cargando captions');
    return await res.json();
  }, []);

  // Exporta MP4 final con subs quemados (rápido: parte del base ya cropeado).
  const exportClip = useCallback(async (clip, resolution = '1080') => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}/clips/${clip.id}/export?resolution=${resolution}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error exportando');
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(clip.title || 'clip').replace(/[^\w\d.-]/g, '_')}_${resolution}p.mp4`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  const applyFontsToAll = useCallback(async (jobId, payload) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/apply-fonts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Error aplicando fuentes');
    if (activeJobId === jobId) await loadJob(activeJobId);
  }, [activeJobId, loadJob]);

  // Aplica un estilo completo (todos los params de una plantilla) a todos los clips del job.
  const applyStyleToAll = useCallback(async (jobId, params) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/apply-style`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error aplicando estilo a todos');
    }
    const data = await res.json();
    if (activeJobId === jobId) await loadJob(activeJobId);
    return data;
  }, [activeJobId, loadJob]);

  const [userTemplates, setUserTemplates] = useState([]);
  const loadUserTemplates = useCallback(async () => {
    try {
      const res = await authFetch(`${API_BASE}/clips/templates`);
      if (res.ok) setUserTemplates((await res.json()).templates || []);
    } catch {}
  }, []);
  const saveUserTemplate = useCallback(async (name, params) => {
    const res = await authFetch(`${API_BASE}/clips/templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, params }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error guardando plantilla');
    }
    await loadUserTemplates();
    return await res.json();
  }, [loadUserTemplates]);
  const deleteUserTemplate = useCallback(async (id) => {
    const res = await authFetch(`${API_BASE}/clips/templates/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando plantilla');
    await loadUserTemplates();
  }, [loadUserTemplates]);

  const redetectKeywords = useCallback(async (clipId) => {
    const res = await authFetch(`${API_BASE}/clips/${clipId}/redetect-keywords`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Error detectando keywords');
    }
    const data = await res.json();
    if (activeJobId) await loadJob(activeJobId);
    return data;
  }, [activeJobId, loadJob]);

  // Modo manual: descarga el transcript completo (segments + words con timestamps)
  // del job para que el usuario marque rangos en la UI.
  const fetchTranscript = useCallback(async (jobId) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/transcript`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error cargando transcripción');
    }
    return await res.json();
  }, []);

  // Reabre un job done para agregar más clips manuales sin re-transcribir.
  // Cambia el status a 'awaiting_selection' y el polling activa la pantalla de selección.
  // Importante: si el job ya era el active y su polling se detuvo (porque llegó a 'done'),
  // necesitamos reiniciar el useEffect del polling. Truco: setActiveJobId(null) → setActiveJobId(jobId)
  // fuerza la re-evaluación del effect aunque el id sea el mismo.
  const reopenForSelection = useCallback(async (jobId) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/reopen-for-selection`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error reabriendo el job');
    }
    setActiveJobId(null);              // hack: forzar re-render del polling effect
    await loadJobs();
    await loadJob(jobId);              // refresca activeJob inmediatamente con status='awaiting_selection'
    setActiveJobId(jobId);             // dispara el useEffect de polling de nuevo
    return await res.json();
  }, [loadJobs, loadJob]);

  // Modo manual: envía los rangos elegidos por el usuario para resumir el job.
  // Backend disparará el render de bases tras procesarlos.
  const submitRanges = useCallback(async (jobId, ranges) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/submit-ranges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranges }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error enviando rangos');
    }
    if (activeJobId === jobId) await loadJob(activeJobId);
    return await res.json();
  }, [activeJobId, loadJob]);

  const deleteJob = useCallback(async (jobId) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando');
    if (activeJobId === jobId) { setActiveJobId(null); setActiveJob(null); }
    await loadJobs();
  }, [activeJobId, loadJobs]);

  return (
    <ClipsContext.Provider value={{
      activeJob, activeJobId, setActiveJobId,
      jobs, fontCatalog, stages, error, isGenerating, uploadProgress,
      loadFonts, loadStages, loadJobs, loadJob,
      generate, updateClip, regenerateCaption, downloadClip, deleteJob,
      applyFontsToAll, redetectKeywords,
      loadBaseVideoBlob, loadCaptions, exportClip,
      applyStyleToAll,
      userTemplates, loadUserTemplates, saveUserTemplate, deleteUserTemplate,
      fetchTranscript, submitRanges, reopenForSelection,
    }}>
      {children}
    </ClipsContext.Provider>
  );
};
