// api/services/logService.js
import fs from 'fs';
import path from 'path';
import db from '../database/schema.js';
import { logSchema } from '../database/logSchema.js';

// Calcular costo estimado basado en el modelo y tokens
const calculateCost = (model, tokensInput, tokensOutput) => {
  const rates = {
    'claude-3-opus-20240229': {
      input: 0.015, // por 1M tokens
      output: 0.075  // por 1M tokens
    },
    'claude-3-sonnet-20240229': {
      input: 0.003,
      output: 0.015
    },
    'claude-3-haiku-20240307': {
      input: 0.00025,
      output: 0.00125
    }
  };
  
  const modelRates = rates[model] || rates['claude-3-opus-20240229'];
  
  // Convertir a dólares por token
  const inputCost = (tokensInput / 1000000) * modelRates.input;
  const outputCost = (tokensOutput / 1000000) * modelRates.output;
  
  return inputCost + outputCost;
};

// Guardar log detallado en archivo JSON
const saveDetailedLog = async (data) => {
  try {
    // Crear carpeta para la fecha actual
    const today = new Date().toISOString().split('T')[0];
    const logDir = path.join(logSchema.logsDir, today);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Generar nombre único de archivo
    const timestamp = Date.now();
    const clientId = data.clientId || 'unknown';
    const requestType = data.requestType || 'request';
    const filename = `${clientId}_${requestType}_${timestamp}.json`;
    const filePath = path.join(logDir, filename);
    
    // Guardar datos en archivo
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    return path.relative(logSchema.logsDir, filePath);
  } catch (error) {
    console.error('Error al guardar log detallado:', error);
    return null;
  }
};

// Registrar una solicitud a la API de Claude
export const logClaudeRequest = async (clientId, requestType, data) => {
  try {
    const startTime = Date.now();
    
    // Guardar log detallado
    const detailedLog = {
      clientId,
      requestType,
      timestamp: new Date().toISOString(),
      request: {
        model: data.model,
        prompt: data.prompt || data.messages,
        ragContext: data.ragContext || null
      }
    };
    
    return {
      logId: null,
      logStart: startTime,
      detailedLog
    };
  } catch (error) {
    console.error('Error al iniciar log de Claude:', error);
    return null;
  }
};

// Completar log con la respuesta
export const completeClaudeLog = async (logData, response, error = null) => {
  try {
    if (!logData) return null;
    
    const { logId, logStart, detailedLog } = logData;
    const duration = Date.now() - logStart;
    
    // Añadir información de respuesta al log detallado
    detailedLog.response = error ? { error: error.message } : response;
    detailedLog.duration = duration;
    
    // Estimar tokens (esto es una aproximación, Claude no devuelve conteos exactos en la API)
    const promptString = typeof detailedLog.request.prompt === 'string' 
      ? detailedLog.request.prompt 
      : JSON.stringify(detailedLog.request.prompt);
    
    const responseString = error ? error.message : (typeof response === 'string' ? response : JSON.stringify(response));
    
    // Estimación: ~1 token por cada 4 caracteres
    const tokensInput = Math.ceil(promptString.length / 4);
    const tokensOutput = Math.ceil(responseString.length / 4);
    
    detailedLog.tokenEstimates = {
      input: tokensInput,
      output: tokensOutput
    };
    
    // Calcular costo estimado
    const model = detailedLog.request.model || 'claude-3-opus-20240229';
    const costEstimate = calculateCost(model, tokensInput, tokensOutput);
    detailedLog.costEstimate = costEstimate;
    
    // Guardar log detallado en archivo
    const logFilePath = await saveDetailedLog(detailedLog);
    
    // Insertar en la base de datos
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO api_logs (
          client_id, request_type, model_used, tokens_input, tokens_output,
          cost_estimate, duration_ms, log_file_path, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          detailedLog.clientId,
          detailedLog.requestType,
          model,
          tokensInput,
          tokensOutput,
          costEstimate,
          duration,
          logFilePath,
          error ? 'error' : 'success'
        ],
        function(err) {
          if (err) {
            console.error('Error al guardar log en base de datos:', err);
            reject(err);
            return;
          }
          
          const logId = this.lastID;
          resolve({
            logId,
            logFilePath,
            duration,
            tokensInput,
            tokensOutput,
            costEstimate
          });
        }
      );
    });
  } catch (error) {
    console.error('Error al completar log de Claude:', error);
    return null;
  }
};

// Registrar estadísticas de RAG
export const logRagStats = async (apiLogId, query, relevantChunks) => {
  try {
    if (!relevantChunks || relevantChunks.length === 0) return null;
    
    // Encontrar la puntuación de similitud más alta
    const topSimilarityScore = Math.max(...relevantChunks.map(chunk => chunk.similarity || 0));
    
    // Insertar estadísticas RAG
    const ragStatId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO rag_stats (
          api_log_id, query, num_chunks_retrieved, top_similarity_score
        ) VALUES (?, ?, ?, ?)`,
        [
          apiLogId,
          query,
          relevantChunks.length,
          topSimilarityScore
        ],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(this.lastID);
        }
      );
    });
    
    // Insertar documentos utilizados
    const insertPromises = relevantChunks.map(chunk => {
      return new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO rag_documents_used (
            rag_stat_id, document_id, chunk_index, similarity_score
          ) VALUES (?, ?, ?, ?)`,
          [
            ragStatId,
            chunk.document_id,
            chunk.chunk_index,
            chunk.similarity || 0
          ],
          function(err) {
            if (err) {
              reject(err);
              return;
            }
            
            resolve(this.lastID);
          }
        );
      });
    });
    
    await Promise.all(insertPromises);
    
    return {
      ragStatId,
      numChunks: relevantChunks.length,
      topSimilarityScore
    };
  } catch (error) {
    console.error('Error al registrar estadísticas RAG:', error);
    return null;
  }
};

// Obtener estadísticas de uso
export const getApiUsageStats = async () => {
  try {
    // Estadísticas globales
    const globalStats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT 
          COUNT(*) as totalRequests,
          SUM(tokens_input) as totalTokensInput,
          SUM(tokens_output) as totalTokensOutput,
          SUM(cost_estimate) as totalCost,
          AVG(duration_ms) as avgDuration
        FROM api_logs`,
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(row);
        }
      );
    });
    
    // Estadísticas por modelo
    const modelStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          model_used,
          COUNT(*) as requests,
          SUM(tokens_input) as tokensInput,
          SUM(tokens_output) as tokensOutput,
          SUM(cost_estimate) as cost
        FROM api_logs
        GROUP BY model_used
        ORDER BY requests DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(rows);
        }
      );
    });
    
    // Estadísticas por cliente
    const clientStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          c.id as clientId,
          c.name as clientName,
          COUNT(l.id) as requests,
          SUM(l.tokens_input) as tokensInput,
          SUM(l.tokens_output) as tokensOutput,
          SUM(l.cost_estimate) as cost
        FROM api_logs l
        JOIN clients c ON l.client_id = c.id
        GROUP BY l.client_id
        ORDER BY requests DESC`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(rows);
        }
      );
    });
    
    // Estadísticas diarias
    const dailyStats = await new Promise((resolve, reject) => {
      db.all(
        `SELECT 
          date(timestamp) as date,
          COUNT(*) as requests,
          SUM(tokens_input) as tokensInput,
          SUM(tokens_output) as tokensOutput,
          SUM(cost_estimate) as cost
        FROM api_logs
        GROUP BY date(timestamp)
        ORDER BY date DESC
        LIMIT 30`,
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(rows);
        }
      );
    });
    
    return {
      global: globalStats,
      byModel: modelStats,
      byClient: clientStats,
      daily: dailyStats
    };
  } catch (error) {
    console.error('Error al obtener estadísticas de uso de API:', error);
    throw error;
  }
};

// Obtener lista de logs
export const getApiLogs = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        l.id, l.client_id, l.script_id, l.request_type, l.model_used,
        l.tokens_input, l.tokens_output, l.cost_estimate, l.duration_ms,
        l.timestamp, l.log_file_path, l.status,
        c.name as client_name
      FROM api_logs l
      LEFT JOIN clients c ON l.client_id = c.id
    `;
    
    const whereConditions = [];
    const params = [];
    
    if (filters.clientId) {
      whereConditions.push('l.client_id = ?');
      params.push(filters.clientId);
    }
    
    if (filters.scriptId) {
      whereConditions.push('l.script_id = ?');
      params.push(filters.scriptId);
    }
    
    if (filters.requestType) {
      whereConditions.push('l.request_type = ?');
      params.push(filters.requestType);
    }
    
    if (filters.status) {
      whereConditions.push('l.status = ?');
      params.push(filters.status);
    }
    
    if (filters.startDate) {
      whereConditions.push('date(l.timestamp) >= ?');
      params.push(filters.startDate);
    }
    
    if (filters.endDate) {
      whereConditions.push('date(l.timestamp) <= ?');
      params.push(filters.endDate);
    }
    
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY l.timestamp DESC LIMIT ${filters.limit || 100} OFFSET ${filters.offset || 0}`;
    
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        resolve(rows);
      });
    });
  } catch (error) {
    console.error('Error al obtener logs de API:', error);
    throw error;
  }
};

// Obtener contenido de un log específico
export const getLogDetails = async (logId) => {
  try {
    // Obtener metadatos del log
    const logMeta = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM api_logs WHERE id = ?`,
        [logId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(row);
        }
      );
    });
    
    if (!logMeta) {
      throw new Error('Log no encontrado');
    }
    
    // Leer contenido del archivo de log
    let logContent = null;
    if (logMeta.log_file_path) {
      const logFilePath = path.join(logSchema.logsDir, logMeta.log_file_path);
      if (fs.existsSync(logFilePath)) {
        logContent = JSON.parse(fs.readFileSync(logFilePath, 'utf8'));
      }
    }
    
    // Obtener estadísticas RAG si existen
    const ragStats = await new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM rag_stats WHERE api_log_id = ?`,
        [logId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          resolve(row);
        }
      );
    });
    
    // Obtener documentos utilizados si hay estadísticas RAG
    let ragDocuments = [];
    if (ragStats) {
      ragDocuments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT 
            r.*, d.title as document_title
           FROM rag_documents_used r
           JOIN documents d ON r.document_id = d.id
           WHERE r.rag_stat_id = ?
           ORDER BY r.similarity_score DESC`,
          [ragStats.id],
          (err, rows) => {
            if (err) {
              reject(err);
              return;
            }
            
            resolve(rows);
          }
        );
      });
    }
    
    return {
      meta: logMeta,
      content: logContent,
      rag: ragStats ? {
        stats: ragStats,
        documents: ragDocuments
      } : null
    };
  } catch (error) {
    console.error('Error al obtener detalles del log:', error);
    throw error;
  }
};
