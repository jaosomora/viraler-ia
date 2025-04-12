// src/components/AuthStatus.jsx
import React, { useState, useEffect } from 'react';
import LoginButton from './LoginButton';

const AuthStatus = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si el usuario está autenticado al cargar el componente
    const checkAuthStatus = async () => {
      try {
        const response = await fetch('/api/auth/status');
        const data = await response.json();
        
        if (data.isAuthenticated) {
          // Si está autenticado, obtener información del usuario
          const userResponse = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setUser(userData.user);
          }
        }
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
      // Opcional: recargar la página o redirigir
      window.location.reload();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-10 w-10">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
    </div>;
  }

  if (!user) {
    return <LoginButton />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {user.picture ? (
          <img 
            src={user.picture} 
            alt={user.name} 
            className="h-8 w-8 rounded-full object-cover border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-700 dark:text-purple-300 font-medium">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium dark:text-white hidden md:inline">{user.name}</span>
      </div>
      <button
        onClick={handleLogout}
        className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        Cerrar sesión
      </button>
    </div>
  );
};

export default AuthStatus;