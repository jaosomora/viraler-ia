// api/rag/documentProcessor.js
import natural from 'natural';
import db from '../database/schema.js';

const TfIdf = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();

/**
 * Divide un documento en fragmentos para indexación
 * @param {string} text - Texto del documento
 * @param {number} chunkSize - Tamaño aproximado de cada fragmento en caracteres
 * @returns {string[]} - Array de fragmentos de texto
 */
function chunkDocument(text, chunkSize = 1000) {
  if (!text) return [];
  
  // Dividir por párrafos
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    // Si el párrafo actual es muy grande, necesitamos dividirlo
    if (paragraph.length > chunkSize) {
      // Si hay contenido en el chunk actual, guardarlo primero
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // Dividir párrafo grande por oraciones
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      
      let sentenceChunk = '';
      for (const sentence of sentences) {
        if (sentenceChunk.length + sentence.length <= chunkSize) {
          sentenceChunk += sentence;
        } else {
          chunks.push(sentenceChunk);
          sentenceChunk = sentence;
        }
      }
      
      if (sentenceChunk) {
        chunks.push(sentenceChunk);
      }
    } 
    // Si el párrafo cabe en el chunk actual
    else if (currentChunk.length + paragraph.length <= chunkSize) {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    } 
    // Si el párrafo no cabe, guardar el chunk actual y empezar uno nuevo
    else {
      chunks.push(currentChunk);
      currentChunk = paragraph;
    }
  }
  
  // Guardar el último chunk si hay contenido
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * Genera un vector TF-IDF para un fragmento de texto
 * @param {string} text - Texto a vectorizar
 * @returns {Buffer} - Vector serializado
 */
function generateVector(text) {
  const tfidf = new TfIdf();
  
  // Añadir el documento al modelo TF-IDF
  tfidf.addDocument(text);
  
  // Extraer términos y pesos
  const terms = {};
  
  // Tokenizar el texto
  const tokens = tokenizer.tokenize(text.toLowerCase());
  
  // Obtener términos únicos
  const uniqueTokens = [...new Set(tokens)];
  
  // Calcular TF-IDF para cada término
  uniqueTokens.forEach(term => {
    terms[term] = tfidf.tfidf(term, 0);
  });
  
  // Serializar el objeto de términos
  return Buffer.from(JSON.stringify(terms));
}

/**
 * Procesa un documento para indexación en el sistema RAG
 * @param {number} documentId - ID del documento
 * @param {string} content - Contenido del documento
 */
export async function processDocument(documentId, content) {
  try {
    // Eliminar vectores existentes para este documento
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM document_vectors WHERE document_id = ?`, [documentId], (err) => {
        if (err) reject(err);
        resolve();
      });
    });
    
    // Dividir el documento en fragmentos
    const chunks = chunkDocument(content);
    
    // Generar y guardar vectores para cada fragmento
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = generateVector(chunk);
      
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO document_vectors (document_id, chunk_index, chunk_text, vector) 
           VALUES (?, ?, ?, ?)`,
          [documentId, i, chunk, vector],
          (err) => {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
    
    console.log(`Documento ${documentId} procesado: ${chunks.length} fragmentos indexados`);
  } catch (error) {
    console.error(`Error al procesar documento ${documentId}:`, error);
    throw error;
  }
}

/**
 * Busca fragmentos relevantes para una consulta
 * @param {number} clientId - ID del cliente
 * @param {string} query - Texto de la consulta
 * @param {number} limit - Número máximo de resultados
 * @returns {Promise<Array>} - Fragmentos relevantes
 */
export async function searchRelevantChunks(clientId, query, limit = 5) {
  try {
    // Generar vector para la consulta
    const queryVector = generateVector(query);
    const queryTerms = JSON.parse(queryVector.toString());
    
    // Obtener todos los vectores para documentos del cliente
    const chunks = await new Promise((resolve, reject) => {
      db.all(
        `SELECT dv.id, dv.document_id, dv.chunk_index, dv.chunk_text, dv.vector, d.title as document_title
         FROM document_vectors dv
         JOIN documents d ON dv.document_id = d.id
         WHERE d.client_id = ?`,
        [clientId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows || []);
        }
      );
    });
    
    // Calcular similitud coseno entre la consulta y cada fragmento
    const results = chunks.map(chunk => {
      const chunkTerms = JSON.parse(chunk.vector.toString());
      const similarity = calculateCosineSimilarity(queryTerms, chunkTerms);
      
      return {
        ...chunk,
        similarity
      };
    });
    
    // Ordenar por similitud y limitar resultados
    const topResults = results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
    
    return topResults;
  } catch (error) {
    console.error('Error al buscar fragmentos relevantes:', error);
    throw error;
  }
}

/**
 * Calcula la similitud coseno entre dos vectores TF-IDF
 * @param {Object} vector1 - Primer vector (objeto de términos y pesos)
 * @param {Object} vector2 - Segundo vector (objeto de términos y pesos)
 * @returns {number} - Valor de similitud coseno entre 0 y 1
 */
function calculateCosineSimilarity(vector1, vector2) {
  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;
  
  // Calcular producto punto
  for (const term in vector1) {
    if (vector2[term]) {
      dotProduct += vector1[term] * vector2[term];
    }
    magnitude1 += Math.pow(vector1[term], 2);
  }
  
  // Calcular magnitudes
  for (const term in vector2) {
    magnitude2 += Math.pow(vector2[term], 2);
  }
  
  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);
  
  // Evitar división por cero
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }
  
  return dotProduct / (magnitude1 * magnitude2);
}
