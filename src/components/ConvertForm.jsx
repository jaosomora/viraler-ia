import React, { useState, useRef, useEffect } from 'react';
import { useConversionContext } from '../context/ConversionContext';
import Spinner from './Spinner';

const ACCEPTED_FORMATS = '.pdf,.docx,.pptx,.xlsx,.epub';
const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200 MB

const FORMAT_LABELS = {
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  pptx: 'PowerPoint (PPTX)',
  xlsx: 'Excel (XLSX)',
  epub: 'EPUB',
};

const ConvertForm = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedProgress, setEstimatedProgress] = useState(0);
  const { processConversion, isLoading, error } = useConversionContext();

  // Timer + progreso estimado basado en tamaño del archivo
  useEffect(() => {
    if (!isLoading || !selectedFile) {
      setElapsedTime(0);
      setEstimatedProgress(0);
      return;
    }
    // Estimación: ~2 MB/s para PDFs, nunca llega a 100% (se frena en 95%)
    const fileSizeMB = selectedFile.size / (1024 * 1024);
    const estimatedSeconds = Math.max(fileSizeMB / 2, 3);

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
      setEstimatedProgress(prev => {
        const target = Math.min(95, (prev + (95 / estimatedSeconds)));
        return target;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, selectedFile]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileError('El archivo es demasiado grande. Maximo 200 MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setFileError('Selecciona un documento');
      return;
    }
    try {
      await processConversion(selectedFile);
    } catch (_) {}
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
        Sube un documento y obten su contenido en formato Markdown
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Documento</label>

          {!selectedFile ? (
            <label
              htmlFor="document-file"
              className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-lg cursor-pointer transition ${
                fileError
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700'
              } ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Arrastra un documento o haz clic para seleccionar
              </span>
              <span className="text-xs text-gray-400 mt-1">PDF, DOCX, PPTX, XLSX, EPUB (max 200 MB)</span>
              <input
                ref={fileInputRef}
                id="document-file"
                type="file"
                accept={ACCEPTED_FORMATS}
                onChange={handleFileChange}
                className="hidden"
                disabled={isLoading}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-gray-400">{getFileExt(selectedFile.name)} — {formatFileSize(selectedFile.size)}</p>
              </div>
              {!isLoading && (
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {fileError && <p className="mt-1 text-sm text-red-500">{fileError}</p>}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition duration-300 disabled:opacity-70"
        >
          {isLoading ? (
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Spinner size="sm" />
                <span>Convirtiendo... {elapsedTime}s — {Math.round(estimatedProgress)}%</span>
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
              <span>Convertir a Markdown</span>
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
