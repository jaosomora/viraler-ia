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
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
      <h2 className="text-2xl font-bold mb-2 text-center">Convertir Documento</h2>
      <p className="text-gray-600 dark:text-gray-300 text-center mb-6">
        Sube uno o varios documentos y obten su contenido en Markdown o HTML
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Documentos</label>

          <label
            htmlFor="document-file"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition ${
              isDragging
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : fileError
                ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
            } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Arrastra uno o varios documentos o haz clic para seleccionar
            </span>
            <span className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, XLSX, EPUB (max 200 MB c/u)</span>
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
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''} listo{selectedFiles.length !== 1 ? 's' : ''}</span>
                {!isLoading && (
                  <button type="button" onClick={handleClearAll} className="hover:text-red-500 transition">
                    Quitar todos
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className={`flex items-center gap-3 p-3 border rounded-lg ${
                    isLoading && idx === currentIndex
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">{getFileExt(file.name)} — {formatFileSize(file.size)}</p>
                  </div>
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-gray-400 hover:text-red-500 transition"
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

          {fileError && <p className="mt-1 text-sm text-red-500">{fileError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Formato de salida</label>
          <div className="inline-flex w-full rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
            <button
              type="button"
              onClick={() => setOutputFormat('md')}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm rounded-md transition ${
                outputFormat === 'md'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Markdown (.md)
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat('html')}
              disabled={isLoading}
              className={`flex-1 px-4 py-2 text-sm rounded-md transition ${
                outputFormat === 'html'
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow font-medium'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              HTML (.html)
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !selectedFiles.length}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition duration-300 disabled:opacity-70"
        >
          {isLoading ? (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Spinner size="sm" />
                <span>
                  Convirtiendo {currentIndex + 1}/{selectedFiles.length}... {elapsedTime}s — {Math.round(estimatedProgress)}%
                </span>
              </div>
              <div className="w-full bg-purple-800 rounded-full h-1.5">
                <div
                  className="bg-white rounded-full h-1.5 transition-all duration-1000 ease-linear"
                  style={{ width: `${estimatedProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <span>
                {selectedFiles.length > 1
                  ? `Convertir ${selectedFiles.length} documentos`
                  : 'Convertir documento'}
              </span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
};

export default ConvertForm;
