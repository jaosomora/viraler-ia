import React, { useState, useMemo } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import { markdownToHtml, wrapAsDocument } from '../utils/markdownToHtml';

const FORMAT_COLORS = {
  pdf: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  docx: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  pptx: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  xlsx: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  epub: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
};

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

  const formatColor = FORMAT_COLORS[originalFormat] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

  const downloadLabel = format === 'html' ? 'Descargar .html' : 'Descargar .md';

  return (
    <div className="w-full max-w-3xl mx-auto mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">Conversion completada</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Format toggle */}
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 p-0.5">
              <button
                onClick={() => setFormat('md')}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  format === 'md'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                Markdown
              </button>
              <button
                onClick={() => setFormat('html')}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  format === 'html'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow'
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                HTML
              </button>
            </div>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 py-1 px-3 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 rounded-full transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{downloadLabel}</span>
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 py-1 px-3 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white rounded-full transition"
            >
              {copySuccess ? (
                <>
                  <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
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
            <span className="flex items-center gap-1 py-1 px-3 text-sm bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded-full">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span>Guardado</span>
            </span>
          </div>
        </div>

        {/* File info */}
        <div className="mb-4 flex items-center gap-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${formatColor}`}>
            {originalFormat.toUpperCase()}
          </span>
          <span className="text-sm text-gray-600 dark:text-gray-400">{filename}</span>
          {fileSize > 0 && (
            <span className="text-xs text-gray-400">{formatFileSize(fileSize)}</span>
          )}
        </div>

        {/* Content */}
        <div>
          <h4 className="font-medium mb-2 text-gray-900 dark:text-white">
            {format === 'html' ? 'Vista HTML:' : 'Markdown:'}
          </h4>
          {format === 'md' ? (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto whitespace-pre-wrap text-gray-800 dark:text-gray-100 font-mono text-sm">
              {markdown}
            </div>
          ) : (
            <div
              className="p-4 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversionResults;
