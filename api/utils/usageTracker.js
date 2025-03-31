// api/utils/usageTracker.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo de registro de uso
const usageFilePath = path.join(__dirname, '../../data/usage.json');

// Asegurarse de que el directorio data existe
const ensureDataDir = () => {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Inicializar archivo de registro si no existe
const initUsageFile = () => {
  ensureDataDir();
  if (!fs.existsSync(usageFilePath)) {
    const initialData = {
      totalTranscriptions: 0,
      totalAudioMinutes: 0,
      estimatedCost: 0,
      history: []
    };
    fs.writeFileSync(usageFilePath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  return JSON.parse(fs.readFileSync(usageFilePath, 'utf8'));
};

// Obtener datos de uso actuales
export const getUsageData = () => {
  try {
    return initUsageFile();
  } catch (error) {
    console.error('Error al leer datos de uso:', error);
    return {
      totalTranscriptions: 0,
      totalAudioMinutes: 0,
      estimatedCost: 0,
      history: []
    };
  }
};

// Calcular costo basado en la duración del audio
// Precios basados en OpenAI Whisper API (revisar para actualizaciones)
// https://openai.com/pricing#audio-models
const calculateCost = (durationInSeconds) => {
  // Whisper cobra $0.006 por minuto
  const durationInMinutes = durationInSeconds / 60;
  return durationInMinutes * 0.006;
};

// Registrar un nuevo uso de la API
export const trackUsage = (audioData, metadata) => {
  try {
    const usageData = getUsageData();
    
    // Duración en segundos (o estimada si no está disponible)
    const durationInSeconds = metadata.duration || (audioData.byteLength / 16000);
    const estimatedCost = calculateCost(durationInSeconds);
    
    // Actualizar totales
    usageData.totalTranscriptions += 1;
    usageData.totalAudioMinutes += (durationInSeconds / 60);
    usageData.estimatedCost += estimatedCost;
    
    // Añadir al historial
    const today = new Date().toISOString().split('T')[0];
    const existingEntry = usageData.history.find(entry => entry.date === today);
    
    if (existingEntry) {
      existingEntry.transcriptions += 1;
      existingEntry.audioMinutes += (durationInSeconds / 60);
      existingEntry.cost += estimatedCost;
    } else {
      usageData.history.push({
        date: today,
        transcriptions: 1,
        audioMinutes: (durationInSeconds / 60),
        cost: estimatedCost
      });
    }
    
    // Guardar actualizaciones
    fs.writeFileSync(usageFilePath, JSON.stringify(usageData, null, 2));
    
    return { 
      durationInSeconds,
      estimatedCost
    };
  } catch (error) {
    console.error('Error al registrar uso:', error);
    return null;
  }
};

// Para estadísticas y reportes
export const generateUsageReport = () => {
  try {
    const usageData = getUsageData();
    
    // Calcular estadísticas adicionales
    const averageCostPerTranscription = 
      usageData.totalTranscriptions > 0 
        ? (usageData.estimatedCost / usageData.totalTranscriptions).toFixed(4) 
        : 0;
    
    const averageAudioMinutesPerTranscription = 
      usageData.totalTranscriptions > 0 
        ? (usageData.totalAudioMinutes / usageData.totalTranscriptions).toFixed(2) 
        : 0;
    
    // Ordenar historial por fecha (más reciente primero)
    const sortedHistory = [...usageData.history].sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );
    
    return {
      ...usageData,
      averageCostPerTranscription,
      averageAudioMinutesPerTranscription,
      recentHistory: sortedHistory.slice(0, 10) // Últimas 10 entradas
    };
  } catch (error) {
    console.error('Error al generar reporte de uso:', error);
    return null;
  }
};

// Reiniciar los datos de uso
export const resetUsageData = (keepHistory = false) => {
  try {
    ensureDataDir();
    
    // Si se quiere mantener el historial, primero obtenerlo
    let history = [];
    if (keepHistory && fs.existsSync(usageFilePath)) {
      const currentData = JSON.parse(fs.readFileSync(usageFilePath, 'utf8'));
      history = currentData.history || [];
    }
    
    // Crear nuevo objeto de datos
    const newData = {
      totalTranscriptions: 0,
      totalAudioMinutes: 0,
      estimatedCost: 0,
      history: keepHistory ? history : []
    };
    
    // Guardar datos reiniciados
    fs.writeFileSync(usageFilePath, JSON.stringify(newData, null, 2));
    
    return { success: true, message: 'Datos de uso reiniciados correctamente' };
  } catch (error) {
    console.error('Error al reiniciar datos de uso:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

// Eliminar registros históricos específicos por fecha
export const deleteHistoryByDate = (date) => {
  try {
    const usageData = getUsageData();
    
    // Buscar el índice del registro a eliminar
    const indexToDelete = usageData.history.findIndex(entry => entry.date === date);
    
    if (indexToDelete === -1) {
      return { success: false, message: 'Fecha no encontrada en el historial' };
    }
    
    // Obtener los valores para restar de los totales
    const entryToDelete = usageData.history[indexToDelete];
    
    // Actualizar totales
    usageData.totalTranscriptions -= entryToDelete.transcriptions;
    usageData.totalAudioMinutes -= entryToDelete.audioMinutes;
    usageData.estimatedCost -= entryToDelete.cost;
    
    // Eliminar la entrada del historial
    usageData.history.splice(indexToDelete, 1);
    
    // Guardar datos actualizados
    fs.writeFileSync(usageFilePath, JSON.stringify(usageData, null, 2));
    
    return { 
      success: true, 
      message: `Registros del ${date} eliminados correctamente` 
    };
  } catch (error) {
    console.error('Error al eliminar registro histórico:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};