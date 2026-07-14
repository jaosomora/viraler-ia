import React, { useState } from 'react';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import { authFetch } from '../context/AuthContext';
import VideoMetadataCard from './VideoMetadataCard';
import VideoAnalysisPanel from './VideoAnalysisPanel';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const PLATFORM_LABELS = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  'youtube-shorts': 'YouTube Shorts',
  facebook: 'Facebook',
  upload: 'Archivo',
};

const TranscriptionResults = () => {
  const { currentTranscription } = useTranscriptionContext();
  const [copySuccess, setCopySuccess] = useState(false);
  const [showUsageInfo, setShowUsageInfo] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  if (!currentTranscription) return null;

  const { url, text, platform, title, usageInfo } = currentTranscription;
  const canDownloadVideo = !!url; // solo para transcripciones desde URL

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleDownloadVideo = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      const res = await authFetch(`${API_BASE}/download-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        let msg = 'No se pudo descargar el video';
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      // Extraer filename de Content-Disposition si existe
      const cd = res.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="?([^";]+)"?/);
      const filename = match ? match[1] : `${(title || 'video').replace(/[^\w.-]/g, '_').slice(0, 80)}.mp4`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setDownloadError(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const toggleUsageInfo = () => {
    setShowUsageInfo(!showUsageInfo);
  };

  const platformLabel = PLATFORM_LABELS[platform] || null;

  return (
    <div className="w-full max-w-3xl mx-auto card overflow-hidden">
      <div className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <h3 className="font-display text-lg font-semibold tracking-tight">
              Transcripción completada
            </h3>
            {platformLabel && <span className="chip chip-neutral">{platformLabel}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {usageInfo && (
              <button
                onClick={toggleUsageInfo}
                className="btn btn-ghost btn-sm"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Info</span>
              </button>
            )}
            {canDownloadVideo && (
              <button
                onClick={handleDownloadVideo}
                disabled={downloading}
                title="Descargar video original (máx 1 h)"
                className="btn btn-ghost btn-sm"
              >
                {downloading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                    </svg>
                    <span>Descargando…</span>
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    <span>Descargar video</span>
                  </>
                )}
              </button>
            )}
            <button
              onClick={handleCopy}
              className="btn btn-ghost btn-sm"
            >
              {copySuccess ? (
                <>
                  <svg className="h-4 w-4 text-ok dark:text-ok-bright" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span>Copiado</span>
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                  </svg>
                  <span>Copiar</span>
                </>
              )}
            </button>
            <span className="chip chip-ok">
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Guardado</span>
            </span>
          </div>
        </div>

        {downloadError && (
          <div className="mb-4 p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
            <p className="text-sm text-danger dark:text-danger-bright">{downloadError}</p>
          </div>
        )}

        {/* Información de uso y costos */}
        {showUsageInfo && usageInfo && (
          <div className="mb-4 p-3 rounded-xl bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-2">
              Información de uso de API
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-ink-500 dark:text-ink-400">Duración estimada:</span>
                <span className="font-mono tabular-nums font-medium">{Math.round(usageInfo.durationInSeconds)} seg</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-ink-500 dark:text-ink-400">Costo:</span>
                <span className="font-mono tabular-nums font-medium">${usageInfo.estimatedCost.toFixed(4)} USD</span>
              </div>
            </div>
          </div>
        )}

        {/* Ficha del video: thumbnail + métricas + description + hashtags.
            Si no hay metadata (caso upload, IG sin cookies, etc.) el componente no renderiza nada. */}
        <VideoMetadataCard transcription={currentTranscription} />

        {/* Análisis on-demand: solo si la transcripción ya tiene id real de DB. */}
        <VideoAnalysisPanel transcription={currentTranscription} />

        {url && (
          <div className="mb-4">
            <p className="text-xs text-ink-400 dark:text-ink-500 mb-1">URL del contenido</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="link-accent text-sm break-all"
            >
              {url}
            </a>
          </div>
        )}

        <div>
          <h4 className="text-xs uppercase tracking-wider font-semibold text-ink-500 dark:text-ink-400 mb-2">
            Transcripción
          </h4>
          <div className="p-4 rounded-xl bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionResults;
