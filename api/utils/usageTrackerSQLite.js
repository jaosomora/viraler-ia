// api/utils/usageTrackerSQLite.js
import db from '../database/schema.js';

/**
 * Calcula costo basado en la duración del audio
 * @param {number} durationInSeconds - Duración en segundos
 * @returns {number} - Costo estimado
 */
export const calculateCost = (durationInSeconds) => {
  // Whisper cobra $0.006 por minuto
  const durationInMinutes = durationInSeconds / 60;
  return durationInMinutes * 0.006;
};

/**
 * Obtiene los datos de uso actuales desde la base de datos
 * @returns {Object} - Datos de uso
 */
export const getUsageData = () => {
  return new Promise((resolve, reject) => {
    const usageData = {
      totalTranscriptions: 0,
      totalAudioMinutes: 0,
      estimatedCost: 0,
      history: []
    };
    
    // Obtener estadísticas totales
    db.get(
      `SELECT 
        SUM(transcriptions) as totalTranscriptions, 
        SUM(audio_minutes) as totalAudioMinutes, 
        SUM(cost) as estimatedCost 
      FROM usage_stats`,
      (err, row) => {
        if (err) {
          console.error('Error al obtener estadísticas totales:', err);
          return reject(err);
        }
        
        if (row) {
          usageData.totalTranscriptions = row.totalTranscriptions || 0;
          usageData.totalAudioMinutes = row.totalAudioMinutes || 0;
          usageData.estimatedCost = row.estimatedCost || 0;
        }
        
        // Obtener historial
        db.all(
          `SELECT date, transcriptions, audio_minutes as audioMinutes, cost 
           FROM usage_stats 
           ORDER BY date DESC`,
          (err, rows) => {
            if (err) {
              console.error('Error al obtener historial de uso:', err);
              return reject(err);
            }
            
            usageData.history = rows || [];
            resolve(usageData);
          }
        );
      }
    );
  });
};

/**
 * Registra un nuevo uso de la API en la base de datos
 * @param {Buffer} audioData - Datos de audio procesados
 * @param {Object} metadata - Metadatos del audio/video
 * @returns {Object} - Información de uso
 */
export const trackUsage = (audioData, metadata) => {
  try {
    // Duración en segundos (o estimada si no está disponible)
    const durationInSeconds = metadata.duration || (audioData.byteLength / 16000);
    const estimatedCost = calculateCost(durationInSeconds);
    
    // Fecha actual en formato YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0];
    
    // Verificar si ya existe una entrada para hoy
    db.get(
      `SELECT id, transcriptions, audio_minutes, cost FROM usage_stats WHERE date = ?`,
      [today],
      (err, row) => {
        if (err) {
          console.error('Error al verificar registro de uso:', err);
          return;
        }
        
        if (row) {
          // Actualizar registro existente
          db.run(
            `UPDATE usage_stats 
             SET transcriptions = transcriptions + 1, 
                 audio_minutes = audio_minutes + ?, 
                 cost = cost + ?
             WHERE id = ?`,
            [durationInSeconds / 60, estimatedCost, row.id],
            (err) => {
              if (err) {
                console.error('Error al actualizar registro de uso:', err);
              }
            }
          );
        } else {
          // Crear nuevo registro
          db.run(
            `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost) 
             VALUES (?, 1, ?, ?)`,
            [today, durationInSeconds / 60, estimatedCost],
            (err) => {
              if (err) {
                console.error('Error al insertar registro de uso:', err);
              }
            }
          );
        }
        
        // Si hay transcripción en los metadatos, guardarla en la tabla de transcripciones
        if (metadata.transcript) {
          db.run(
            `INSERT INTO transcriptions (
              url, platform, title, transcript, duration, channel, thumbnail, language
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              metadata.url || '',
              metadata.platform || 'unknown',
              metadata.title || 'Sin título',
              metadata.transcript,
              metadata.duration || 0,
              metadata.channel || 'Desconocido',
              metadata.thumbnail || null,
              metadata.language || 'es'
            ],
            (err) => {
              if (err) {
                console.error('Error al guardar transcripción:', err);
              }
            }
          );
        }
      }
    );
    
    return {
      durationInSeconds,
      estimatedCost
    };
  } catch (error) {
    console.error('Error al registrar uso:', error);
    return null;
  }
};

/**
 * Genera un reporte de uso desde la base de datos
 * @returns {Object} - Reporte de uso
 */
export const generateUsageReport = () => {
  try {
    return new Promise((resolve, reject) => {
      const usageData = {
        totalTranscriptions: 0,
        totalAudioMinutes: 0,
        estimatedCost: 0,
        history: [],
        averageCostPerTranscription: 0,
        averageAudioMinutesPerTranscription: 0,
        recentHistory: []
      };
      
      // Obtener estadísticas totales
      db.get(
        `SELECT 
          SUM(transcriptions) as totalTranscriptions, 
          SUM(audio_minutes) as totalAudioMinutes, 
          SUM(cost) as estimatedCost 
        FROM usage_stats`,
        (err, row) => {
          if (err) {
            console.error('Error al obtener estadísticas totales:', err);
            return reject(err);
          }
          
          if (row) {
            usageData.totalTranscriptions = row.totalTranscriptions || 0;
            usageData.totalAudioMinutes = row.totalAudioMinutes || 0;
            usageData.estimatedCost = row.estimatedCost || 0;
          }
          
          // Calcular promedios
          usageData.averageCostPerTranscription = 
            usageData.totalTranscriptions > 0 
              ? (usageData.estimatedCost / usageData.totalTranscriptions).toFixed(4) 
              : 0;
          
          usageData.averageAudioMinutesPerTranscription = 
            usageData.totalTranscriptions > 0 
              ? (usageData.totalAudioMinutes / usageData.totalTranscriptions).toFixed(2) 
              : 0;
          
          // Obtener historial
          db.all(
            `SELECT date, transcriptions, audio_minutes as audioMinutes, cost 
             FROM usage_stats 
             ORDER BY date DESC 
             LIMIT 10`,
            (err, rows) => {
              if (err) {
                console.error('Error al obtener historial de uso:', err);
                return reject(err);
              }
              
              usageData.recentHistory = rows || [];
              usageData.history = rows || [];
              
              resolve(usageData);
            }
          );
        }
      );
    });
  } catch (error) {
    console.error('Error al generar reporte de uso:', error);
    throw error;
  }
};


/**
 * Reinicia los datos de uso en la base de datos
 * @param {boolean} keepHistory - Si se debe mantener el historial
 * @returns {Object} - Resultado de la operación
 */
export const resetUsageData = (keepHistory = false) => {
  try {
    if (keepHistory) {
      // Mantener historial pero poner a cero los totales en la tabla settings
      db.run(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES ('totalTranscriptions', '0', CURRENT_TIMESTAMP),
               ('totalAudioMinutes', '0', CURRENT_TIMESTAMP),
               ('estimatedCost', '0', CURRENT_TIMESTAMP)
      `);
      
      return { success: true, message: 'Contadores reiniciados manteniendo historial' };
    } else {
      // Eliminar todo el historial
      db.run(`DELETE FROM usage_stats`, (err) => {
        if (err) {
          console.error('Error al eliminar estadísticas de uso:', err);
          return { success: false, message: `Error: ${err.message}` };
        }
      });
      
      return { success: true, message: 'Datos de uso reiniciados completamente' };
    }
  } catch (error) {
    console.error('Error al reiniciar datos de uso:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

/**
 * Elimina un registro histórico específico por fecha
 * @param {string} date - Fecha en formato YYYY-MM-DD
 * @returns {Object} - Resultado de la operación
 */
export const deleteHistoryByDate = (date) => {
  try {
    // Implementación síncrona para mantener compatibilidad
    let result = { success: false, message: 'Operación no completada' };
    
    // Verificar que la fecha existe
    db.get(
      `SELECT id FROM usage_stats WHERE date = ?`,
      [date],
      (err, row) => {
        if (err) {
          console.error('Error al verificar fecha:', err);
          result = { success: false, message: `Error: ${err.message}` };
          return;
        }
        
        if (!row) {
          result = { success: false, message: 'Fecha no encontrada en el historial' };
          return;
        }
        
        // Eliminar registro para la fecha especificada
        db.run(
          `DELETE FROM usage_stats WHERE date = ?`,
          [date],
          (err) => {
            if (err) {
              console.error('Error al eliminar registro:', err);
              result = { success: false, message: `Error: ${err.message}` };
              return;
            }
            
            result = { success: true, message: `Registros del ${date} eliminados correctamente` };
          }
        );
      }
    );
    
    return result;
  } catch (error) {
    console.error('Error al eliminar registro histórico:', error);
    return { success: false, message: `Error: ${error.message}` };
  }
};

/**
 * Obtiene las transcripciones guardadas en la base de datos
 * @returns {Array} - Lista de transcripciones
 */
export const getTranscriptions = () => {
  try {
    // Implementación síncrona para mantener compatibilidad
    let transcriptions = [];
    
    db.all(
      `SELECT 
        id, url, platform, title, transcript, duration, channel, 
        thumbnail, language, created_at as createdAt
       FROM transcriptions 
       ORDER BY created_at DESC`,
      (err, rows) => {
        if (err) {
          console.error('Error al obtener transcripciones:', err);
          return [];
        }
        
        transcriptions = rows || [];
      }
    );
    
    return transcriptions;
  } catch (error) {
    console.error('Error al obtener transcripciones:', error);
    return [];
  }
};
