// src/components/LoginButton.jsx
import React from 'react';

const LoginButton = () => {
  const handleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center gap-2 py-2 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
    >
      {/* Logo de Google */}
      <svg width="20" height="20" viewBox="0 0 24 24" className="text-gray-700 dark:text-white">
        <path
          fill="currentColor"
          d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
        />
      </svg>
      <span className="font-medium text-gray-700 dark:text-white">Iniciar sesión con Google</span>
    </button>
  );
};

export default LoginButton;