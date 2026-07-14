import React, { useState, useRef, useEffect } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import Spinner from './Spinner';

const ACCEPTED_FORMATS = '.pdf,.docx,.pptx,.xlsx,.epub';
const ACCEPTED_EXTS = ['pdf', 'docx', 'pptx', 'xlsx', 'epub'];
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const FORMAT_LABELS = {
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  pptx: 'PowerPoint (PPTX)',
  xlsx: 'Excel (XLSX)',
  epub: 'EPUB',
};

const ConvertForm = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const { processConversion, setCurrentConversion, isLoading, error, outputFormat, setOutputFormat } = useConversionContext();

  const activeFile = selectedFiles[currentIndex] || null;

  useEffect(() => {
    if (!isLoading || !activeFile) {
      setElapsedTime(0);
      setEstimatedProgress(0);
      return;
    }
    const fileSizeMB = activeFile.size / (1024 * 1024);
    const estimatedSeconds = Math.max(fileSizeMB / 2, 3);

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
      setEstimatedProgress(prev => Math.min(95, prev + (95 / estimatedSeconds)));
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, activeFile]);

  const validateAndAddFiles = (files) => {
    setFileError('');
    const valid = [];
    const errors = [];
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ACCEPTED_EXTS.includes(ext)) {
        errors.push(`${file.name}: formato no soportado`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: supera 200 MB`);
        continue;
      }
      valid.push(file);
    }
    if (errors.length) setFileError(errors.join(' · '));
    if (valid.length) {
      setSelectedFiles(prev => [...prev, ...valid]);
    }
  };

  const handleFileChange = (e) => {
    validateAndAddFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isLoading) return;
    validateAndAddFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRemoveFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleClearAll = () => {
    setSelectedFiles([]);
    setFileError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length) {
      setFileError('Selecciona al menos un documento');
      return;
    }
    const results = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      setCurrentIndex(i);
      try {
        const result = await processConversion(selectedFiles[i]);
        if (result) results.push(result);
      } catch (_) {
        // Error ya queda en context; continuar con el resto
      }
    }

    if (results.length > 1) {
      const combinedMarkdown = results
        .map(r => `# ${r.filename}\n\n${r.markdown}`)
        .join('\n\n---\n\n');
      const totalSize = results.reduce((sum, r) => sum + (r.fileSize || 0), 0);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      setCurrentConversion({
        id: null,
        filename: `combinado-${results.length}-docs-${timestamp}.md`,
        originalFormat: 'md',
        markdown: combinedMarkdown,
        fileSize: totalSize,
        createdAt: new Date().toISOString(),
      });
    }

    setSelectedFiles([]);
    setCurrentIndex(0);
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExt = (name) => {
    const ext = name.split('.').pop().toLowerCase();
    return FORMAT_LABELS[ext] || ext.toUpperCase();
  };

  return (
    <div className="w-full card p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="form-label">Documentos</label>

          <label
            htmlFor="document-file"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
              isDragging
                ? 'border-accent dark:border-accent-bright bg-accent-soft dark:bg-accent-deep'
                : fileError
                ? 'border-danger dark:border-danger-bright bg-danger-soft dark:bg-danger-deep'
                : 'border-ink-300 dark:border-ink-600 bg-ink-100/60 dark:bg-ink-900/60 hover:bg-ink-100 dark:hover:bg-ink-900'
            } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-ink-400 dark:text-ink-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-ink-500 dark:text-ink-400">
              Arrastra uno o varios documentos o haz clic para seleccionar
            </span>
            <span className="text-xs text-ink-400 dark:text-ink-500 mt-1">PDF, DOCX, PPTX, XLSX, EPUB (max 200 MB c/u)</span>
            <input
              ref={fileInputRef}
              id="document-file"
              type="file"
              accept={ACCEPTED_FORMATS}
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isLoading}
            />
          </label>

          {selectedFiles.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-ink-500 dark:text-ink-400">
                <span>{selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''} listo{selectedFiles.length !== 1 ? 's' : ''}</span>
                {!isLoading && (
                  <button type="button" onClick={handleClearAll} className="hover:text-danger dark:hover:text-danger-bright transition-colors">
                    Quitar todos
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className={`flex items-center gap-3 p-3 border rounded-xl transition-colors ${
                    isLoading && idx === currentIndex
                      ? 'border-accent/50 dark:border-accent-bright/50 bg-accent-soft dark:bg-accent-deep'
                      : 'border-ink-200 dark:border-ink-700 bg-ink-100/60 dark:bg-ink-900/60'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent dark:text-accent-bright flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-ink-400 dark:text-ink-500">
                      {getFileExt(file.name)} — <span className="font-mono tabular-nums">{formatFileSize(file.size)}</span>
                    </p>
                  </div>
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-ink-400 hover:text-danger dark:hover:text-danger-bright transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              </div>
            </div>
          )}

          {fileError && <p className="mt-1.5 text-sm text-danger dark:text-danger-bright">{fileError}</p>}
        </div>

        <div>
          <label className="form-label">Formato de salida</label>
          <div className="flex w-full gap-1 rounded-full bg-ink-100 dark:bg-ink-900 p-1">
            <button
              type="button"
              onClick={() => setOutputFormat('md')}
              disabled={isLoading}
              className={`flex-1 px-4 py-1.5 text-sm rounded-full transition-colors ${
                outputFormat === 'md'
                  ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm font-semibold'
                  : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
              }`}
            >
              Markdown (.md)
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat('html')}
              disabled={isLoading}
              className={`flex-1 px-4 py-1.5 text-sm rounded-full transition-colors ${
                outputFormat === 'html'
                  ? 'bg-white dark:bg-ink-850 text-ink-950 dark:text-paper shadow-sm font-semibold'
                  : 'text-ink-500 dark:text-ink-400 hover:text-ink-950 dark:hover:text-paper'
              }`}
            >
              HTML (.html)
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !selectedFiles.length}
          className="btn btn-accent w-full"
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              <span>Convirtiendo {currentIndex + 1}/{selectedFiles.length}…</span>
            </>
          ) : (
            <span>
              {selectedFiles.length > 1
                ? `Convertir ${selectedFiles.length} documentos →`
                : 'Convertir documento →'}
            </span>
          )}
        </button>

        {isLoading && (
          <div className="space-y-1.5">
            <div className="w-full h-1.5 rounded-full bg-ink-200 dark:bg-ink-700 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-accent dark:bg-accent-bright transition-all duration-1000 ease-linear"
                style={{ width: `${estimatedProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ink-500 dark:text-ink-400 font-mono tabular-nums">
              <span>{elapsedTime}s</span>
              <span>{Math.round(estimatedProgress)}%</span>
            </div>
          </div>
        )}
      </form>

      {error && (
        <div className="mt-4 p-3 rounded-xl bg-danger-soft dark:bg-danger-deep border border-danger/30 dark:border-danger-bright/30">
          <p className="text-danger dark:text-danger-bright text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ConvertForm;
