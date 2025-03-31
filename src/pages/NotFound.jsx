import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-6">
        <svg className="w-12 h-12 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200 mb-4">Página no encontrada</h2>
      
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md">
        La página que estás buscando no existe o ha sido movida a otra ubicación.
      </p>
      
      <Link 
        to="/" 
        className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
      >
        Regresar al inicio
      </Link>
    </div>
  );
};

export default NotFound;
