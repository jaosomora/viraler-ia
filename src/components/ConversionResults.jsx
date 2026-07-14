import React, { useState, useMemo } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import { markdownToHtml, wrapAsDocument } from '../utils/markdownToHtml';

const ConversionResults = () => {
  const { currentConversion, outputFormat, setOutputFormat } = useConversionContext();
  const [copySuccess, setCopySuccess] = useState(false);
  const format = outputFormat;
  const setFormat = setOutputFormat;

  const markdown = currentConversion?.markdown || '';
  const html = useMemo(
    () => (format === 'html' ? markdownToHtml(markdown) : ''),
    [format, markdown]
  );

  if (!currentConversion) return null;

  const { filename, originalFormat, fileSize } = currentConversion;

  const handleCopy = () => {
    const payload = format === 'html' ? html : markdown;
    navigator.clipboard.writeText(payload);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  const handleDownload = () => {
    const isHtml = format === 'html';
    const baseName = filename.replace(/\.[^.]+$/, '');
    const content = isHtml ? wrapAsDocument(html, baseName) : markdown;
    const blob = new Blob([content], {
      type: isHtml ? 'text/html;charset=utf-8' : 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.${isHtml ? 'html' : 'md'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const downloadLabel = format === 'html' ? 'Descargar .html' : 'Descargar .md';

  return (
    <div className="w-full card overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-display text-lg font-semibold tracking-tight">Conversión completada</h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Format toggle */}
            <div className="inline-flex rounded-full bg-ink-100 dark:bg-ink-900 p-0.5">
              <button
                onClick={() => setFormat('md')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  format === 'md'
                    ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm font-semibold'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
                }`}
              >
                Markdown
              </button>
              <button
                onClick={() => setFormat('html')}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  format === 'html'
                    ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm font-semibold'
                    : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
                }`}
              >
                HTML
              </button>
            </div>
            <button onClick={handleDownload} className="btn btn-ghost btn-sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloadLabel}</span>
            </button>
            <button onClick={handleCopy} className="btn btn-ghost btn-sm">
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

        {/* File info */}
        <div className="mb-4 flex items-center gap-3">
          <span className="chip chip-neutral">{originalFormat.toUpperCase()}</span>
          <span className="text-sm text-ink-500 dark:text-ink-400">{filename}</span>
          {fileSize > 0 && (
            <span className="text-xs text-ink-400 dark:text-ink-500 font-mono tabular-nums">{formatFileSize(fileSize)}</span>
          )}
        </div>

        {/* Content */}
        <div>
          <h4 className="text-sm font-medium text-ink-500 dark:text-ink-400 mb-2">
            {format === 'html' ? 'Vista HTML' : 'Markdown'}
          </h4>
          {format === 'md' ? (
            <div className="p-4 bg-ink-100 dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm">
              {markdown}
            </div>
          ) : (
            <div
              className="p-4 bg-white dark:bg-ink-900 border border-ink-200 dark:border-ink-700 rounded-xl max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversionResults;
