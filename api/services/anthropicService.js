// api/services/anthropicService.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { logClaudeRequest, completeClaudeLog, logRagStats } from './logService.js';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Verifica que la API key esté configurada
 */
function validateApiKey() {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('API Key de Anthropic no configurada. Por favor, configura ANTHROPIC_API_KEY en el archivo .env');
  }
}

/**
 * Envía una solicitud a la API de Claude para generar un guión
 * 
 * @param {string} prompt - Prompt formateado para Claude
 * @param {Array} relevantChunks - Fragmentos relevantes de documentos
 * @param {number} clientId - ID del cliente
 * @returns {Promise<string>} - Texto generado por Claude
 */
export async function generateScript(prompt, relevantChunks = [], clientId) {
  validateApiKey();
  
  let logData = null;
  
  try {
    // Construir el sistema de mensaje con la información relevante
    let systemMessage = `Eres un asistente especializado en crear guiones virales para redes sociales. 
Tu objetivo es crear guiones que sean atractivos, breves y concisos para maximizar el engagement.`;

    // Agregar fragmentos relevantes como contexto
    if (relevantChunks && relevantChunks.length > 0) {
      systemMessage += `\n\nA continuación te proporciono información relevante que debes usar para crear el guión:\n\n`;
      
      relevantChunks.forEach((chunk, index) => {
        systemMessage += `--- Documento ${index + 1}: ${chunk.document_title || 'Sin título'} ---\n${chunk.chunk_text}\n\n`;
      });
      
      systemMessage += `Usa esta información como guía para el estilo, tono y estructura del guión.`;
    }

    // Iniciar log
    logData = await logClaudeRequest(clientId, 'generate_script', {
      model: 'claude-3-opus-20240229',
      prompt: prompt,
      ragContext: relevantChunks.map(chunk => ({
        document_id: chunk.document_id,
        document_title: chunk.document_title,
        chunk_index: chunk.chunk_index,
        similarity: chunk.similarity
      }))
    });

    // Realizar la solicitud a la API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        system: systemMessage,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    // Procesar la respuesta
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(`Error de API de Anthropic: ${data.error?.message || 'Desconocido'}`);
      // Completar log con error
      await completeClaudeLog(logData, null, error);
      throw error;
    }
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      const error = new Error('Respuesta inesperada de la API de Anthropic');
      await completeClaudeLog(logData, null, error);
      throw error;
    }
    
    // Registrar estadísticas RAG si hay fragmentos relevantes
    if (logData?.logId && relevantChunks && relevantChunks.length > 0) {
      await logRagStats(logData.logId, prompt, relevantChunks);
    }
    
    // Completar log con éxito
    await completeClaudeLog(logData, data);
    
    return data.content[0].text;
  } catch (error) {
    console.error('Error al generar guión con Claude:', error);
    // Asegurar que el log se complete incluso si hay error
    if (logData) {
      await completeClaudeLog(logData, null, error);
    }
    throw error;
  }
}

/**
 * Envía un mensaje de seguimiento en una conversación para mejoras de guión
 * 
 * @param {string} message - Mensaje del usuario
 * @param {Array} conversationHistory - Historial de conversación
 * @param {number} clientId - ID del cliente
 * @param {number} scriptId - ID del guión
 * @returns {Promise<string>} - Respuesta de Claude
 */
export async function conversationWithClaude(message, conversationHistory = [], clientId, scriptId) {
  validateApiKey();
  
  let logData = null;
  
  try {
    // Preparar los mensajes para la API
    const messages = [...conversationHistory, { role: 'user', content: message }];
    
    // Iniciar log
    logData = await logClaudeRequest(clientId, 'conversation', {
      model: 'claude-3-opus-20240229',
      messages: messages,
      scriptId: scriptId
    });
    
    // Realizar la solicitud a la API
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: messages
      })
    });

    // Procesar la respuesta
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(`Error de API de Anthropic: ${data.error?.message || 'Desconocido'}`);
      await completeClaudeLog(logData, null, error);
      throw error;
    }
    
    // Completar log con éxito
    await completeClaudeLog(logData, data);
    
    return data.content[0].text;
  } catch (error) {
    console.error('Error en conversación con Claude:', error);
    if (logData) {
      await completeClaudeLog(logData, null, error);
    }
    throw error;
  }
}