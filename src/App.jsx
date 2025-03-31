import React, { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import MyResults from './pages/MyResults';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';
import { checkHealth } from './services/api';
import './index.css';

function App() {
  const [serverStatus, setServerStatus] = useState('loading');

  // Verificar el estado del servidor al cargar
  useEffect(() => {
    const verifyServerHealth = async () => {
      try {
        await checkHealth();
        setServerStatus('online');
      } catch (error) {
        console.error('Error al verificar el servidor:', error);
        setServerStatus('offline');
      }
    };

    verifyServerHealth();
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-8">
        {serverStatus === 'offline' ? (
          <div className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6">
            <div className="flex items-center">
              <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>No se pudo conectar al servidor. Algunas funciones pueden no estar disponibles.</span>
            </div>
          </div>
        ) : null}
        
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mis-resultados" element={<MyResults />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      
      <Footer />
    </div>
  );
}

export default App;