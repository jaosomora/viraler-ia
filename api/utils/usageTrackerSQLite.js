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
    
    // Obtener estadísticas totales (incluye reels)
    db.get(
      `SELECT
        SUM(transcriptions) as totalTranscriptions,
        SUM(audio_minutes) as totalAudioMinutes,
        SUM(cost) as estimatedCost,
        SUM(conversions) as totalConversions,
        SUM(reels) as totalReels,
        SUM(reels_minutes) as totalReelsMinutes,
        SUM(reels_cost) as totalReelsCost
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
          usageData.totalConversions = row.totalConversions || 0;
          usageData.totalReels = row.totalReels || 0;
          usageData.totalReelsMinutes = row.totalReelsMinutes || 0;
          usageData.totalReelsCost = row.totalReelsCost || 0;
          usageData.estimatedCostAll = (row.estimatedCost || 0) + (row.totalReelsCost || 0);
        }

        // Obtener historial
        db.all(
          `SELECT date, transcriptions, audio_minutes as audioMinutes, cost,
                  conversions, reels, reels_minutes as reelsMinutes, reels_cost as reelsCost
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
export const trackUsage = (audioData, metadata, userId = null) => {
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
          // Detecta si trae al menos un campo de engagement (capturado vía yt-dlp).
          // Si todos son null/undefined, dejamos metrics_captured_at NULL para que el frontend
          // sepa que la ficha no aplica (caso upload o IG sin cookies).
          const hasMetrics = [
            metadata.viewCount, metadata.likeCount, metadata.commentCount,
            metadata.shareCount, metadata.uploaderHandle, metadata.uploadDate,
            metadata.description, metadata.hashtags
          ].some((v) => v !== null && v !== undefined);
          const metricsCapturedAt = hasMetrics ? new Date().toISOString() : null;
          const hashtagsJson = Array.isArray(metadata.hashtags) && metadata.hashtags.length > 0
            ? JSON.stringify(metadata.hashtags)
            : null;
          db.run(
            `INSERT INTO transcriptions (
              url, platform, title, transcript, duration, channel, thumbnail, language, user_id,
              view_count, like_count, comment_count, share_count,
              uploader_handle, uploader_url, upload_date, description, hashtags, metrics_captured_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              metadata.url || '',
              metadata.platform || 'unknown',
              metadata.title || 'Sin título',
              metadata.transcript,
              metadata.duration || 0,
              metadata.channel || 'Desconocido',
              metadata.thumbnail || null,
              metadata.language || 'es',
              userId,
              metadata.viewCount ?? null,
              metadata.likeCount ?? null,
              metadata.commentCount ?? null,
              metadata.shareCount ?? null,
              metadata.uploaderHandle ?? null,
              metadata.uploaderUrl ?? null,
              metadata.uploadDate ?? null,
              metadata.description ?? null,
              hashtagsJson,
              metricsCapturedAt
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
          SUM(cost) as estimatedCost,
          SUM(conversions) as totalConversions,
          SUM(analyses) as totalAnalyses,
          SUM(analyses_cost) as totalAnalysesCost
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
            usageData.totalConversions = row.totalConversions || 0;
            usageData.totalAnalyses = row.totalAnalyses || 0;
            usageData.totalAnalysesCost = row.totalAnalysesCost || 0;
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
            `SELECT date, transcriptions, audio_minutes as audioMinutes, cost, conversions,
                    analyses, analyses_cost as analysesCost
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
 * @returns {Promise<Array>} - Lista de transcripciones
 */
export const getTranscriptions = (userId = null) => {
  return new Promise((resolve, reject) => {
    const cols = `id, url, platform, title, transcript as text, duration, channel,
                  thumbnail, language, created_at as createdAt,
                  view_count as viewCount, like_count as likeCount,
                  comment_count as commentCount, share_count as shareCount,
                  uploader_handle as uploaderHandle, uploader_url as uploaderUrl,
                  upload_date as uploadDate, description, hashtags,
                  metrics_captured_at as metricsCapturedAt,
                  analysis, analysis_at as analysisAt, analysis_model as analysisModel`;
    const query = userId
      ? `SELECT ${cols} FROM transcriptions WHERE user_id = ? ORDER BY created_at DESC`
      : `SELECT ${cols} FROM transcriptions ORDER BY created_at DESC`;
    const params = userId ? [userId] : [];
    db.all(query, params,
      (err, rows) => {
        if (err) {
          console.error('Error al obtener transcripciones:', err);
          return reject(err);
        }
        // Parsear hashtags JSON → array
        const parsed = (rows || []).map((r) => ({
          ...r,
          hashtags: r.hashtags ? safeParseArray(r.hashtags) : null
        }));
        resolve(parsed);
      }
    );
  });
};

const safeParseArray = (s) => {
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : null; }
  catch { return null; }
};

/**
 * Obtiene una transcripción por ID, validando propiedad si se pasa userId.
 * Devuelve null si no existe o no pertenece al usuario.
 */
export const getTranscriptionById = (id, userId = null) => {
  return new Promise((resolve, reject) => {
    const query = userId
      ? `SELECT * FROM transcriptions WHERE id = ? AND user_id = ?`
      : `SELECT * FROM transcriptions WHERE id = ?`;
    const params = userId ? [id, userId] : [id];
    db.get(query, params, (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      row.hashtags = row.hashtags ? safeParseArray(row.hashtags) : null;
      resolve(row);
    });
  });
};

/**
 * Guarda el análisis on-demand generado por LLM en una transcripción.
 */
export const saveTranscriptionAnalysis = (id, { analysis, model, costUsd }) => {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE transcriptions
       SET analysis = ?, analysis_at = CURRENT_TIMESTAMP, analysis_model = ?, analysis_cost_usd = ?
       WHERE id = ?`,
      [analysis, model, costUsd || 0, id],
      function (err) {
        if (err) return reject(err);
        resolve({ success: this.changes > 0 });
      }
    );
  });
};

/**
 * Suma una llamada de análisis al contador diario de usage_stats.
 */
export const trackAnalysis = ({ costUsd }) => {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT id FROM usage_stats WHERE date = ?`, [today], (err, row) => {
      if (err) { console.error('trackAnalysis:', err); return resolve(); }
      if (row) {
        db.run(
          `UPDATE usage_stats SET analyses = COALESCE(analyses,0) + 1,
                                  analyses_cost = COALESCE(analyses_cost,0) + ?
           WHERE id = ?`,
          [costUsd || 0, row.id],
          () => resolve()
        );
      } else {
        db.run(
          `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost, analyses, analyses_cost)
           VALUES (?, 0, 0, 0, 1, ?)`,
          [today, costUsd || 0],
          () => resolve()
        );
      }
    });
  });
};

/**
 * Elimina una transcripción por ID
 * @param {number} id - ID de la transcripción
 * @returns {Promise<Object>}
 */
export const deleteTranscription = (id, userId = null) => {
  return new Promise((resolve, reject) => {
    const query = userId
      ? `DELETE FROM transcriptions WHERE id = ? AND user_id = ?`
      : `DELETE FROM transcriptions WHERE id = ?`;
    const params = userId ? [id, userId] : [id];
    db.run(query, params, function (err) {
      if (err) {
        console.error('Error al eliminar transcripción:', err);
        return reject(err);
      }
      if (this.changes === 0) {
        return resolve({ success: false, message: 'Transcripción no encontrada' });
      }
      resolve({ success: true, message: 'Transcripción eliminada' });
    });
  });
};

// ==========================================
// Funciones de Conversión de Documentos
// ==========================================

/**
 * Registra una conversión de documento en la base de datos
 * @param {Object} metadata - { filename, originalFormat, markdown, fileSize }
 * @param {number|null} userId - ID del usuario
 * @returns {Promise<number>} - ID de la conversión creada
 */
export const trackConversion = (metadata, userId = null) => {
  return new Promise((resolve, reject) => {
    const today = new Date().toISOString().split('T')[0];

    // Insertar conversión en la tabla
    db.run(
      `INSERT INTO conversions (filename, original_format, markdown_content, file_size, user_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        metadata.filename,
        metadata.originalFormat,
        metadata.markdown,
        metadata.fileSize || 0,
        userId
      ],
      function (err) {
        if (err) {
          console.error('Error al guardar conversión:', err);
          return reject(err);
        }

        const conversionId = this.lastID;

        // Actualizar usage_stats para hoy
        db.get(
          `SELECT id FROM usage_stats WHERE date = ?`,
          [today],
          (err, row) => {
            if (err) {
              console.error('Error al verificar registro de uso:', err);
              return resolve(conversionId);
            }

            if (row) {
              db.run(
                `UPDATE usage_stats SET conversions = conversions + 1 WHERE id = ?`,
                [row.id]
              );
            } else {
              db.run(
                `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost, conversions)
                 VALUES (?, 0, 0, 0, 1)`,
                [today]
              );
            }

            resolve(conversionId);
          }
        );
      }
    );
  });
};

/**
 * Obtiene las conversiones guardadas en la base de datos
 * @param {number|null} userId - Filtrar por usuario (null = todas)
 * @returns {Promise<Array>}
 */
export const getConversions = (userId = null) => {
  return new Promise((resolve, reject) => {
    const query = userId
      ? `SELECT id, filename, original_format as originalFormat, markdown_content as markdown,
                file_size as fileSize, created_at as createdAt
         FROM conversions WHERE user_id = ? ORDER BY created_at DESC`
      : `SELECT id, filename, original_format as originalFormat, markdown_content as markdown,
                file_size as fileSize, created_at as createdAt
         FROM conversions ORDER BY created_at DESC`;
    const params = userId ? [userId] : [];
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error al obtener conversiones:', err);
        return reject(err);
      }
      resolve(rows || []);
    });
  });
};

/**
 * Elimina una conversión por ID
 * @param {number} id - ID de la conversión
 * @param {number|null} userId - ID del usuario (para verificar ownership)
 * @returns {Promise<Object>}
 */
export const deleteConversion = (id, userId = null) => {
  return new Promise((resolve, reject) => {
    const query = userId
      ? `DELETE FROM conversions WHERE id = ? AND user_id = ?`
      : `DELETE FROM conversions WHERE id = ?`;
    const params = userId ? [id, userId] : [id];
    db.run(query, params, function (err) {
      if (err) {
        console.error('Error al eliminar conversión:', err);
        return reject(err);
      }
      if (this.changes === 0) {
        return resolve({ success: false, message: 'Conversión no encontrada' });
      }
      resolve({ success: true, message: 'Conversión eliminada' });
    });
  });
};

/**
 * Trackea un reel finalizado en usage_stats (contador + minutos finales + costo agregado).
 * Se llama una sola vez al transicionar el job a status='done'.
 */
export const trackReelUsage = ({ durationMinutes = 0, costUsd = 0 }) => {
  return new Promise((resolve) => {
    const today = new Date().toISOString().split('T')[0];
    db.get(`SELECT id FROM usage_stats WHERE date = ?`, [today], (err, row) => {
      if (err) { console.error('[usage] reel track err:', err); return resolve(); }
      if (row) {
        db.run(
          `UPDATE usage_stats SET reels = reels + 1, reels_minutes = reels_minutes + ?, reels_cost = reels_cost + ? WHERE id = ?`,
          [durationMinutes, costUsd, row.id],
          () => resolve()
        );
      } else {
        db.run(
          `INSERT INTO usage_stats (date, transcriptions, audio_minutes, cost, conversions, reels, reels_minutes, reels_cost)
           VALUES (?, 0, 0, 0, 0, 1, ?, ?)`,
          [today, durationMinutes, costUsd],
          () => resolve()
        );
      }
    });
  });
};
