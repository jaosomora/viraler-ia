import React, { useState } from 'react';
import { marked } from 'marked';
import { useTranscriptionContext } from '../context/TranscriptionContext';
import { authFetch } from '../context/AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

// Configuración de marked: sin GFM tablas, sí breaks, output limpio.
marked.setOptions({ breaks: true, gfm: true });

const formatRelativeTime = (iso) => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return 'hace unos segundos';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return `hace ${Math.floor(diff / 86_400_000)} días`;
};

const VideoAnalysisPanel = ({ transcription }) => {
  const { applyAnalysisToTranscription } = useTranscriptionContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      // Copiamos el markdown crudo (no el HTML renderizado) — así se pega bien
      // en Notion, Apple Notes, Obsidian, etc., manteniendo títulos y listas.
      await navigator.clipboard.writeText(transcription.analysis || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      setError('No se pudo copiar al portapapeles');
    }
  };

  if (!transcription || !transcription.id) return null;

  const hasAnalysis = !!transcription.analysis;

  const runAnalysis = async (force = false) => {
    setError(null);
    setLoading(true);
    try {
      const url = `${API_BASE}/transcriptions/${transcription.id}/analyze${force ? '?force=true' : ''}`;
      const res = await authFetch(url, { method: 'POST' });
      if (!res.ok) {
        let msg = 'No se pudo generar el análisis';
        try { const data = await res.json(); msg = data.error || msg; } catch {}
        throw new Error(msg);
      }
      const data = await res.json();
      applyAnalysisToTranscription(transcription.id, {
        analysis: data.analysis,
        analysisModel: data.model,
        analysisAt: data.analysisAt,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Estado vacío: botón grande para invitar al análisis.
  if (!hasAnalysis) {
    return (
      <div className="my-6">
        <button
          onClick={() => runAnalysis(false)}
          disabled={loading}
          className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl border-2 border-dashed border-ink-300 dark:border-ink-600 hover:border-accent dark:hover:border-accent-bright hover:bg-accent-soft/50 dark:hover:bg-accent-deep/40 transition-colors disabled:opacity-60 disabled:cursor-wait text-left"
        >
          <div>
            <div className="font-semibold flex items-center gap-2">
              <span aria-hidden="true">✨</span>
              <span>{loading ? 'Analizando ideas…' : 'Analizar ideas detrás del video'}</span>
            </div>
            <div className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">
              Idea pelada · lógica del truco · molde paso a paso
            </div>
          </div>
          <div className="shrink-0 text-ink-400 dark:text-ink-500">
            {loading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <span className="text-xs font-mono tabular-nums">~$0.002 · gpt-4o-mini</span>
            )}
          </div>
        </button>
        {error && (
          <div className="mt-2 p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
            <p className="text-sm text-danger dark:text-danger-bright">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Renderizar el markdown a HTML. El system prompt fija el formato, así que confiamos.
  const html = marked.parse(transcription.analysis || '');

  return (
    <div className="my-6 card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-ink-200 dark:border-ink-700">
        <div>
          <span className="eyebrow">Análisis de ideas</span>
          <div className="text-xs text-ink-400 dark:text-ink-500 mt-1">
            {formatRelativeTime(transcription.analysisAt) || 'Generado'} · <span className="font-mono">{transcription.analysisModel || 'gpt-4o-mini'}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-paper transition-colors flex items-center gap-1"
            title="Copiar análisis en markdown"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-ok dark:text-ok-bright" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-ok dark:text-ok-bright">Copiado</span>
              </>
            ) : (
              <><span aria-hidden="true">📋</span><span>Copiar</span></>
            )}
          </button>
          <button
            onClick={() => runAnalysis(true)}
            disabled={loading}
            className="text-xs font-medium text-ink-500 hover:text-ink-950 dark:text-ink-400 dark:hover:text-paper transition-colors flex items-center gap-1 disabled:opacity-60"
            title="Regenerar análisis (vuelve a cobrar)"
          >
            {loading ? (
              <>
                <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Regenerando</span>
              </>
            ) : (
              <><span aria-hidden="true">🔄</span><span>Regenerar</span></>
            )}
          </button>
        </div>
      </div>

      <div
        className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none analysis-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {error && (
        <div className="mx-5 mb-4 p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
          <p className="text-sm text-danger dark:text-danger-bright">{error}</p>
        </div>
      )}

      {/* Estilos del markdown con los tokens tinta del sistema (ver docs/DESIGN.md).
            Contrastes AA en ambos modos:
            - Texto cuerpo:  light ink-950 (#0D0B0C) sobre blanco · dark paper (#F2EFEA) sobre ink-850.
            - Strong/h2:     máximo realce en ambos modos.
            - Code bg:       light ink-200 (#E4E0DC) · dark ink-700 (#2A2526). */}
      <style>{`
        .analysis-content h2 {
          font-family: Archivo, Inter, sans-serif;
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #0D0B0C;
        }
        .dark .analysis-content h2 { color: #F2EFEA; }
        .analysis-content h2:first-child { margin-top: 0; }
        .analysis-content p {
          font-size: 0.9rem;
          line-height: 1.65;
          color: #0D0B0C;
          margin-bottom: 0.5rem;
        }
        .dark .analysis-content p { color: #E4E0DC; }
        .analysis-content ul, .analysis-content ol {
          font-size: 0.9rem;
          line-height: 1.65;
          color: #0D0B0C;
          padding-left: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .dark .analysis-content ul, .dark .analysis-content ol { color: #E4E0DC; }
        .analysis-content ul { list-style: disc; }
        .analysis-content ol { list-style: decimal; }
        .analysis-content li { margin-bottom: 0.3rem; }
        .analysis-content strong { color: #0D0B0C; font-weight: 700; }
        .dark .analysis-content strong { color: #FFFFFF; }
        .analysis-content em { font-style: italic; }
        .analysis-content code {
          background: #E4E0DC;
          color: #0D0B0C;
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-size: 0.82rem;
          font-weight: 500;
        }
        .dark .analysis-content code {
          background: #2A2526;
          color: #F2EFEA;
        }
        /* Resaltado especial de la última sección (🎯 Lo que me llevo) */
        .analysis-content h2:last-of-type,
        .analysis-content h2:last-of-type ~ p,
        .analysis-content h2:last-of-type ~ ol,
        .analysis-content h2:last-of-type ~ ul {
          padding-left: 0.75rem;
          border-left: 3px solid #1B60D4;
        }
        .dark .analysis-content h2:last-of-type,
        .dark .analysis-content h2:last-of-type ~ p,
        .dark .analysis-content h2:last-of-type ~ ol,
        .dark .analysis-content h2:last-of-type ~ ul {
          border-left-color: #5B95FF;
        }
      `}</style>
    </div>
  );
};

export default VideoAnalysisPanel;
