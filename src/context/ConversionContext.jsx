import React, { createContext, useContext, useState, useEffect } from 'react';
import { authFetch } from './AuthContext';

const API_BASE = import.meta.env.MODE === 'development' ? 'http://localhost:3000/api' : '/api';

const ConversionContext = createContext();

export const useConversionContext = () => useContext(ConversionContext);

export const ConversionProvider = ({ children }) => {
  const [savedConversions, setSavedConversions] = useState([]);
  const [currentConversion, setCurrentConversion] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchConversions = async () => {
    try {
      const response = await authFetch(`${API_BASE}/conversions`);
      if (response.ok) {
        const data = await response.json();
        setSavedConversions(data);
      }
    } catch (e) {
      console.error('Error al cargar conversiones:', e);
    }
  };

  useEffect(() => {
    if (localStorage.getItem('token')) {
      fetchConversions();
    }
  }, []);

  const processConversion = async (file) => {
    try {
      setIsLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append('document', file);

      const response = await authFetch(`${API_BASE}/convert`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al convertir el documento');
      }

      const data = await response.json();

      const newConversion = {
        id: data.id,
        filename: data.filename,
        originalFormat: data.originalFormat,
        markdown: data.markdown,
        fileSize: data.fileSize,
        createdAt: new Date().toISOString(),
      };

      setCurrentConversion(newConversion);
      await fetchConversions();
      return newConversion;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const deleteConversion = async (id) => {
    try {
      const response = await authFetch(`${API_BASE}/conversions/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setSavedConversions(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error('Error al eliminar conversión:', e);
    }
  };

  const value = {
    savedConversions,
    currentConversion,
    isLoading,
    error,
    processConversion,
    deleteConversion,
    setCurrentConversion,
    fetchConversions,
  };

  return (
    <ConversionContext.Provider value={value}>
      {children}
    </ConversionContext.Provider>
  );
};
