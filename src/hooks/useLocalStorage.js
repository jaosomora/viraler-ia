// src/hooks/useLocalStorage.js
import { useState, useEffect } from 'react';

/**
 * Hook personalizado para trabajar con localStorage
 * 
 * @param {string} key - Clave para guardar en localStorage
 * @param {any} initialValue - Valor inicial si no existe la clave
 * @returns {Array} - [storedValue, setValue]
 */
function useLocalStorage(key, initialValue) {
  // Estado para almacenar nuestro valor
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // Obtener de localStorage por clave
      const item = window.localStorage.getItem(key);
      // Analizar JSON almacenado o devolver initialValue
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // Si hay un error, devolver initialValue
      console.error(`Error al recuperar ${key} de localStorage:`, error);
      return initialValue;
    }
  });

  // Función para actualizar el valor en estado y localStorage
  const setValue = (value) => {
    try {
      // Permitir que value sea una función para tener la misma API que useState
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      
      // Guardar en estado
      setStoredValue(valueToStore);
      
      // Guardar en localStorage
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(`Error al guardar ${key} en localStorage:`, error);
    }
  };

  // Efecto para sincronizar con otros posibles cambios de localStorage
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === key) {
        try {
          setStoredValue(JSON.parse(event.newValue || JSON.stringify(initialValue)));
        } catch (e) {
          console.error(`Error al sincronizar ${key} de localStorage:`, e);
        }
      }
    };

    // Escuchar cambios
    window.addEventListener('storage', handleStorageChange);
    
    // Limpiar al desmontar
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}

export default useLocalStorage;
