import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ToolHub from './pages/ToolHub';
import Home from './pages/Home';
import ConvertPage from './pages/ConvertPage';
import ClipsPage from './pages/ClipsPage';
import ReelsCleanerPage from './pages/ReelsCleanerPage';
import IdeaMapPage from './pages/IdeaMapPage';
import MyResults from './pages/MyResults';
import AdminPanel from './pages/AdminPanel';
import NotFound from './pages/NotFound';
import LoginPage from './pages/LoginPage';
import SecretsPage from './pages/SecretsPage';
import ViewSecretPage from './pages/ViewSecretPage';
import MagicLinkPage from './pages/MagicLinkPage';
import Spinner from './components/Spinner';
import { checkHealth } from './services/api';
import './index.css';

function App() {
  const { isAuthenticated, isOwner, loading } = useAuth();
  const [serverStatus, setServerStatus] = useState('loading');

  useEffect(() => {
    checkHealth()
      .then(() => setServerStatus('online'))
      .catch(() => setServerStatus('offline'));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="xl" />
      </div>
    );
  }

  // Ruta pública: consumo de magic link (procesa token y loguea)
  const isMagicRoute = typeof window !== 'undefined'
    && window.location.pathname.startsWith('/magic/');

  if (isMagicRoute) {
    return (
      <Routes>
        <Route path="/magic/:token" element={<MagicLinkPage />} />
      </Routes>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">
        {serverStatus === 'offline' && (
          <div className="rounded-2xl border border-danger/30 dark:border-danger-bright/30 bg-danger-soft dark:bg-danger-deep text-danger dark:text-danger-bright p-4 mb-6">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium">No se pudo conectar al servidor.</span>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<ToolHub />} />
          <Route path="/transcribir" element={<Home />} />
          <Route path="/convertir" element={<ConvertPage />} />
          <Route path="/clips" element={<ClipsPage />} />
          <Route path="/reels-cleaner" element={<ReelsCleanerPage />} />
          <Route path="/mapa-de-ideas" element={<IdeaMapPage />} />
          <Route path="/mapa-de-ideas/:id" element={<IdeaMapPage />} />
          <Route path="/mis-resultados" element={<MyResults />} />
          <Route path="/secretos" element={<SecretsPage />} />
          <Route path="/secreto/:token" element={<ViewSecretPage />} />
          <Route path="/admin" element={isOwner ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}

export default App;
