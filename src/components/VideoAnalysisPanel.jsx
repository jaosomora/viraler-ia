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
          className="w-full group flex items-center justify-between gap-4 px-5 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-dashed border-gray-400 dark:border-gray-500 hover:border-gray-900 dark:hover:border-white hover:bg-gray-900 dark:hover:bg-white hover:text-white dark:hover:text-gray-900 rounded-xl transition-all disabled:opacity-60 disabled:cursor-wait"
        >
          <div className="text-left">
            <div className="font-semibold flex items-center gap-2">
              <span aria-hidden="true">✨</span>
              <span>{loading ? 'Analizando ideas…' : 'Analizar ideas detrás del video'}</span>
            </div>
            <div className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-200 dark:group-hover:text-gray-700 mt-0.5">
              Idea pelada · lógica del truco · molde paso a paso
            </div>
          </div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-200 dark:group-hover:text-gray-700 shrink-0">
            {loading ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              <>~$0.002 · gpt-4o-mini</>
            )}
          </div>
        </button>
        {error && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Renderizar el markdown a HTML. El system prompt fija el formato, así que confiamos.
  const html = marked.parse(transcription.analysis || '');

  return (
    <div className="my-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-200 dark:border-emerald-700/50 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/40 dark:to-gray-800">
        <div>
          <div className="text-xs uppercase tracking-widest text-emerald-800 dark:text-emerald-300 font-bold">
            ✨ Análisis de ideas
          </div>
          <div className="text-xs text-gray-700 dark:text-gray-300 mt-0.5">
            {formatRelativeTime(transcription.analysisAt) || 'Generado'} · {transcription.analysisModel || 'gpt-4o-mini'}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCopy}
            className="text-xs font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white flex items-center gap-1"
            title="Copiar análisis en markdown"
          >
            {copied ? (
              <>
                <svg className="h-3.5 w-3.5 text-green-600 dark:text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-green-700 dark:text-green-300">Copiado</span>
              </>
            ) : (
              <><span aria-hidden="true">📋</span><span>Copiar</span></>
            )}
          </button>
          <button
            onClick={() => runAnalysis(true)}
            disabled={loading}
            className="text-xs font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white flex items-center gap-1 disabled:opacity-60"
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
              <><span>🔄</span><span>Regenerar</span></>
            )}
          </button>
        </div>
      </div>

      <div
        className="px-5 py-4 prose prose-sm dark:prose-invert max-w-none analysis-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {error && (
        <div className="mx-5 mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Estilos del markdown. Contrastes pensados para WCAG AA en ambos modos:
            - Texto cuerpo:  light gray-800 (#1F2937) sobre white ≈ 16:1
                             dark  gray-100 (#F3F4F6) sobre gray-800 (#1F2937) ≈ 14:1
            - Strong:        light gray-900 (#111827) | dark white (#FFFFFF) — máximo realce.
            - Code bg:       light gray-200 (#E5E7EB) | dark gray-700 (#374151) — distinguible sin perder texto. */}
      <style>{`
        .analysis-content h2 {
          font-size: 1rem;
          font-weight: 700;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: rgb(17 24 39);
        }
        .dark .analysis-content h2 { color: rgb(255 255 255); }
        .analysis-content h2:first-child { margin-top: 0; }
        .analysis-content p {
          font-size: 0.9rem;
          line-height: 1.65;
          color: rgb(31 41 55);
          margin-bottom: 0.5rem;
        }
        .dark .analysis-content p { color: rgb(243 244 246); }
        .analysis-content ul, .analysis-content ol {
          font-size: 0.9rem;
          line-height: 1.65;
          color: rgb(31 41 55);
          padding-left: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .dark .analysis-content ul, .dark .analysis-content ol { color: rgb(243 244 246); }
        .analysis-content ul { list-style: disc; }
        .analysis-content ol { list-style: decimal; }
        .analysis-content li { margin-bottom: 0.3rem; }
        .analysis-content strong { color: rgb(17 24 39); font-weight: 700; }
        .dark .analysis-content strong { color: rgb(255 255 255); }
        .analysis-content em { font-style: italic; }
        .analysis-content code {
          background: rgb(229 231 235);
          color: rgb(17 24 39);
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-size: 0.82rem;
          font-weight: 500;
        }
        .dark .analysis-content code {
          background: rgb(55 65 81);
          color: rgb(255 255 255);
        }
        /* Resaltado especial de la última sección (🎯 Lo que me llevo) */
        .analysis-content h2:last-of-type,
        .analysis-content h2:last-of-type ~ p,
        .analysis-content h2:last-of-type ~ ol,
        .analysis-content h2:last-of-type ~ ul {
          padding-left: 0.75rem;
          border-left: 3px solid rgb(16 185 129);
        }
      `}</style>
    </div>
  );
};

export default VideoAnalysisPanel;
