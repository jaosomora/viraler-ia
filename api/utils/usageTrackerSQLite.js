// api/utils/usageTrackerSQLite.js
// Esta es una versión temporal que redirige al sistema existente
import * as originalTracker from './usageTracker.js';

// Exportar las mismas funciones que el módulo original
export const getUsageData = originalTracker.getUsageData;
export const trackUsage = originalTracker.trackUsage;
export const generateUsageReport = originalTracker.generateUsageReport;
export const resetUsageData = originalTracker.resetUsageData;
export const deleteHistoryByDate = originalTracker.deleteHistoryByDate;

// Añadir esta función para cálculos de costo
export const calculateCost = (durationInSeconds) => {
  // Whisper cobra $0.006 por minuto
  const durationInMinutes = durationInSeconds / 60;
  return durationInMinutes * 0.006;
};
