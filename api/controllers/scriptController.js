// api/controllers/scriptController.js
import db from '../database/schema.js';
import { generateScript, conversationWithClaude } from '../services/anthropicService.js';
import { searchRelevantChunks } from '../rag/documentProcessor.js';
import { transcribeVideo } from '../services/transcriptionService.js';

/**
 * Obtiene todos los guiones de un cliente
 */
export const getClientScripts = (req, res) => {
  const { clientId } = req.params;
  
  db.all(
    `SELECT * FROM scripts WHERE client_id = ? ORDER BY created_at DESC`,
    [clientId],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener guiones:', err);
        return res.status(500).json({ error: 'Error al obtener guiones' });
      }
      
      res.json(rows || []);
    }
  );
};

/**
 * Obtiene un guión específico por ID
 */
export const getScriptById = (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM scripts WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener guión:', err);
      return res.status(500).json({ error: 'Error al obtener guión' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Guión no encontrado' });
    }
    
    res.json(row);
  });
};

/**
 * Genera un nuevo guión para un cliente
 */
export const createScript = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { 
      idea, 
      inspirationUrl, 
      cta = 'Ninguno', 
      additionalNotes = '',
      durationSeconds = 60,
      awarenessLevel = 0
    } = req.body;
    
    if (!idea) {
      return res.status(400).json({ error: 'La idea del guión es requerida' });
    }
    
    // Verificar que el cliente existe
    const client = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM clients WHERE id = ?`, [clientId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Procesar la URL de inspiración si existe
    let inspirationTranscript = '';
    if (inspirationUrl) {
      try {
        const transcriptionResult = await transcribeVideo({ url: inspirationUrl });
        inspirationTranscript = transcriptionResult.transcript || '';
      } catch (error) {
        console.warn('Error al transcribir URL de inspiración:', error);
        // Continuamos aunque falle la transcripción
      }
    }
    
    // Buscar documentos relevantes usando RAG
    const relevantChunks = await searchRelevantChunks(clientId, idea + ' ' + additionalNotes);
    
    // Construir el prompt para Claude
    const prompt = `
Necesito crear un guión viral para redes sociales con las siguientes características:

IDEA PRINCIPAL:
${idea}

${inspirationTranscript ? `TRANSCRIPCIÓN DE INSPIRACIÓN:
${inspirationTranscript}

` : ''}CTA (Call to Action): ${cta}

DURACIÓN OBJETIVO: ${durationSeconds} segundos

NIVEL DE CONCIENCIA DEL CLIENTE: ${awarenessLevel} 
${getAwarenessLevelDescription(awarenessLevel)}

${additionalNotes ? `NOTAS ADICIONALES:
${additionalNotes}

` : ''}CLIENTE: ${client.name}
${client.description ? client.description : ''}

Por favor, escribe un guión conciso, atractivo y diseñado para generar alta viralidad. 
Incluye indicaciones de timing y tono cuando sea apropiado.
    `.trim();
    
    // Generar el guión con Claude
    const scriptContent = await generateScript(prompt, relevantChunks);
    
    // Guardar en la base de datos
    const scriptId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO scripts (
          client_id, 
          title, 
          content, 
          inspiration_url, 
          inspiration_transcript,
          cta, 
          duration_seconds,
          awareness_level,
          additional_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clientId,
          `Guión: ${idea.substring(0, 50)}${idea.length > 50 ? '...' : ''}`,
          scriptContent,
          inspirationUrl || null,
          inspirationTranscript || null,
          cta,
          durationSeconds,
          awarenessLevel,
          additionalNotes
        ],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
    
    // Obtener el guión creado
    const script = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM scripts WHERE id = ?`, [scriptId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    res.status(201).json(script);
  } catch (error) {
    console.error('Error al crear guión:', error);
    res.status(500).json({ error: 'Error al crear guión: ' + error.message });
  }
};

/**
 * Actualizar un guión existente
 */
export const updateScript = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title,
      content,
      cta,
      durationSeconds,
      awarenessLevel,
      additionalNotes
    } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'El título y contenido son requeridos' });
    }
    
    // Actualizar guión en la base de datos
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE scripts SET 
         title = ?, 
         content = ?, 
         cta = ?,
         duration_seconds = ?,
         awareness_level = ?,
         additional_notes = ?
         WHERE id = ?`,
        [
          title,
          content,
          cta,
          durationSeconds,
          awarenessLevel,
          additionalNotes,
          id
        ],
        function(err) {
          if (err) reject(err);
          if (this.changes === 0) reject(new Error('Guión no encontrado'));
          resolve();
        }
      );
    });
    
    // Obtener guión actualizado
    const script = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM scripts WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Guión no encontrado'));
        resolve(row);
      });
    });
    
    res.json(script);
  } catch (error) {
    console.error('Error al actualizar guión:', error);
    res.status(500).json({ error: 'Error al actualizar guión: ' + error.message });
  }
};

/**
 * Eliminar un guión
 */
export const deleteScript = (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM scripts WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error('Error al eliminar guión:', err);
      return res.status(500).json({ error: 'Error al eliminar guión' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Guión no encontrado' });
    }
    
    res.json({ message: 'Guión eliminado correctamente' });
  });
};

/**
 * Conversación para mejorar un guión
 */
export const conversationWithScript = async (req, res) => {
  try {
    const { scriptId } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'El mensaje es requerido' });
    }
    
    // Obtener guión
    const script = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM scripts WHERE id = ?`, [scriptId], (err, row) => {
        if (err) reject(err);
        if (!row) reject(new Error('Guión no encontrado'));
        resolve(row);
      });
    });
    
    // Obtener historial de conversación
    const conversationHistory = await new Promise((resolve, reject) => {
      db.get(`SELECT messages FROM script_conversations WHERE script_id = ?`, [scriptId], (err, row) => {
        if (err) reject(err);
        resolve(row ? JSON.parse(row.messages) : []);
      });
    });
    
    // Si no hay conversación previa, iniciarla con el guión
    if (conversationHistory.length === 0) {
      conversationHistory.push({ 
        role: 'system', 
        content: `Eres un asistente especializado en guiones virales para redes sociales. 
Estás ayudando a mejorar un guión existente. El guión original es:

${script.content}

Tu tarea es ayudar a mejorarlo según las instrucciones del usuario.`
      });
      
      conversationHistory.push({ 
        role: 'assistant', 
        content: 'Aquí tienes el guión. ¿Qué aspectos te gustaría mejorar o ajustar?' 
      });
    }
    
    // Añadir el mensaje del usuario
    conversationHistory.push({ role: 'user', content: message });
    
    // Generar respuesta con Claude
    const response = await conversationWithClaude(message, conversationHistory.slice(0, -1));
    
    // Añadir respuesta al historial
    conversationHistory.push({ role: 'assistant', content: response });
    
    // Guardar o actualizar la conversación
    await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM script_conversations WHERE script_id = ?`, [scriptId], (err, row) => {
        if (err) reject(err);
        
        if (row) {
          // Actualizar conversación existente
          db.run(
            `UPDATE script_conversations SET messages = ? WHERE id = ?`,
            [JSON.stringify(conversationHistory), row.id],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        } else {
          // Crear nueva conversación
          db.run(
            `INSERT INTO script_conversations (script_id, messages) VALUES (?, ?)`,
            [scriptId, JSON.stringify(conversationHistory)],
            (err) => {
              if (err) reject(err);
              resolve();
            }
          );
        }
      });
    });
    
    res.json({
      response,
      conversation: conversationHistory
    });
  } catch (error) {
    console.error('Error en conversación de guión:', error);
    res.status(500).json({ error: 'Error en conversación: ' + error.message });
  }
};

/**
 * Obtiene la descripción de un nivel de conciencia
 */
function getAwarenessLevelDescription(level) {
  const descriptions = {
    0: `Nivel 0: El cliente no es consciente de que tiene un problema o necesidad.`,
    1: `Nivel 1: El cliente es consciente de que tiene un problema pero no está buscando soluciones activamente.`,
    2: `Nivel 2: El cliente es consciente del problema y está buscando soluciones.`,
    3: `Nivel 3: El cliente conoce la solución pero no ha decidido con quién resolverlo.`,
    4: `Nivel 4: El cliente conoce tu producto/servicio pero aún no lo ha comprado.`
  };
  
  return descriptions[level] || '';
}
