// api/controllers/documentController.js
import db from '../database/schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { processDocument } from '../rag/documentProcessor.js';

// Configurar __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directorio base para documentos de clientes
const getClientDocsDir = (clientId) => {
  const dataDir = process.env.NODE_ENV === 'production' ? '/opt/data' : path.join(__dirname, '../../data');
  return path.join(dataDir, 'clients', clientId.toString(), 'docs');
};

/**
 * Obtiene todos los documentos de un cliente
 */
export const getClientDocuments = (req, res) => {
  const { clientId } = req.params;
  
  db.all(
    `SELECT * FROM documents WHERE client_id = ? ORDER BY created_at DESC`,
    [clientId],
    (err, rows) => {
      if (err) {
        console.error('Error al obtener documentos:', err);
        return res.status(500).json({ error: 'Error al obtener documentos' });
      }
      
      res.json(rows || []);
    }
  );
};

/**
 * Obtiene un documento específico
 */
export const getDocumentById = (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM documents WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener documento:', err);
      return res.status(500).json({ error: 'Error al obtener documento' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    res.json(row);
  });
};

/**
 * Crea un nuevo documento para un cliente
 */
export const createDocument = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { title, content, type } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'El título y contenido son requeridos' });
    }
    
    // Verificar que el cliente existe
    const client = await new Promise((resolve, reject) => {
      db.get(`SELECT id FROM clients WHERE id = ?`, [clientId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    // Guardar documento en la base de datos
    const documentId = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO documents (client_id, title, content, type) VALUES (?, ?, ?, ?)`,
        [clientId, title, content, type || 'general'],
        function(err) {
          if (err) reject(err);
          resolve(this.lastID);
        }
      );
    });
    
    // Crear directorio para documentos del cliente si no existe
    const clientDir = getClientDocsDir(clientId);
    if (!fs.existsSync(clientDir)) {
      fs.mkdirSync(clientDir, { recursive: true });
    }
    
    // Guardar contenido en archivo
    const filename = `${documentId}-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    const filePath = path.join(clientDir, filename);
    fs.writeFileSync(filePath, content);
    
    // Actualizar la ruta del archivo en la base de datos
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE documents SET filename = ? WHERE id = ?`,
        [filename, documentId],
        function(err) {
          if (err) reject(err);
          resolve();
        }
      );
    });
    
    // Procesar documento para indexación
    await processDocument(documentId, content);
    
    // Obtener el documento creado
    const document = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM documents WHERE id = ?`, [documentId], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    res.status(201).json(document);
  } catch (error) {
    console.error('Error al crear documento:', error);
    res.status(500).json({ error: 'Error al crear documento' });
  }
};

/**
 * Actualiza un documento existente
 */
export const updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, type } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: 'El título y contenido son requeridos' });
    }
    
    // Obtener el documento actual
    const document = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM documents WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    // Actualizar documento en la base de datos
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE documents SET title = ?, content = ?, type = ? WHERE id = ?`,
        [title, content, type || document.type, id],
        function(err) {
          if (err) reject(err);
          if (this.changes === 0) reject(new Error('Documento no encontrado'));
          resolve();
        }
      );
    });
    
    // Actualizar archivo
    const clientDir = getClientDocsDir(document.client_id);
    let filename = document.filename;
    
    // Si cambió el título, crear un nuevo archivo
    if (title !== document.title && !filename) {
      filename = `${id}-${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      
      // Actualizar el nombre del archivo en la base de datos
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE documents SET filename = ? WHERE id = ?`,
          [filename, id],
          function(err) {
            if (err) reject(err);
            resolve();
          }
        );
      });
    }
    
    // Guardar contenido en archivo
    const filePath = path.join(clientDir, filename || `${id}-document.md`);
    fs.writeFileSync(filePath, content);
    
    // Reindexar el documento
    await processDocument(id, content);
    
    // Obtener el documento actualizado
    const updatedDocument = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM documents WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    res.json(updatedDocument);
  } catch (error) {
    console.error('Error al actualizar documento:', error);
    res.status(500).json({ error: 'Error al actualizar documento' });
  }
};

/**
 * Elimina un documento
 */
export const deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Obtener el documento
    const document = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM documents WHERE id = ?`, [id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    
    if (!document) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }
    
    // Eliminar vectores del documento
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM document_vectors WHERE document_id = ?`, [id], (err) => {
        if (err) reject(err);
        resolve();
      });
    });
    
    // Eliminar documento de la base de datos
    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM documents WHERE id = ?`, [id], function(err) {
        if (err) reject(err);
        if (this.changes === 0) reject(new Error('Documento no encontrado'));
        resolve();
      });
    });
    
    // Eliminar archivo si existe
    if (document.filename) {
      const filePath = path.join(getClientDocsDir(document.client_id), document.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json({ message: 'Documento eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar documento:', error);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
};
