import React, { useState } from 'react';
import './index.css';

function App() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!url) {
      setError('Por favor ingresa una URL');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/transcribeVideo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al transcribir el video');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="p-6 bg-white rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center mb-6">Viraler IA</h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                Link del Video
              </label>
              <input
                id="url"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="https://www.instagram.com/reel/ o https://youtube.com/shorts/"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              {isLoading ? 'Procesando...' : 'Transcribir Contenido'}
            </button>
          </form>
          
          {error && (
            <div className="mt-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md">
              {error}
            </div>
          )}
          
          {result && (
            <div className="mt-6 p-4 bg-gray-50 rounded-md">
              <h2 className="text-lg font-semibold mb-2">Transcripción:</h2>
              <p className="whitespace-pre-wrap">{result.transcript}</p>
              
              {result.title && (
                <p className="mt-2 text-sm text-gray-500">
                  <strong>Título:</strong> {result.title}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;