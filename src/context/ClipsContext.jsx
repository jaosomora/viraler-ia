import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { authFetch } from './AuthContext';

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
    try {
      let res;
      if (file) {
        const fd = new FormData();
        fd.append('video', file);
        fd.append('options', JSON.stringify(options));
        res = await authFetch(`${API_BASE}/clips/generate`, { method: 'POST', body: fd });
      } else {
        res = await authFetch(`${API_BASE}/clips/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, options }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al generar clips');
      setActiveJobId(data.jobId);
      await loadJobs();
      return data.jobId;
    } catch (err) {
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

  const applyFontsToAll = useCallback(async (jobId, payload) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}/apply-fonts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Error aplicando fuentes');
    if (activeJobId === jobId) await loadJob(activeJobId);
  }, [activeJobId, loadJob]);

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

  const deleteJob = useCallback(async (jobId) => {
    const res = await authFetch(`${API_BASE}/clips/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error eliminando');
    if (activeJobId === jobId) { setActiveJobId(null); setActiveJob(null); }
    await loadJobs();
  }, [activeJobId, loadJobs]);

  return (
    <ClipsContext.Provider value={{
      activeJob, activeJobId, setActiveJobId,
      jobs, fontCatalog, stages, error, isGenerating,
      loadFonts, loadStages, loadJobs, loadJob,
      generate, updateClip, regenerateCaption, downloadClip, deleteJob,
      applyFontsToAll, redetectKeywords,
    }}>
      {children}
    </ClipsContext.Provider>
  );
};
