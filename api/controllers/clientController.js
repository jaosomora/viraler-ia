// api/controllers/clientController.js
import db from '../database/schema.js';

/**
 * Obtiene todos los clientes
 */
export const getAllClients = (req, res) => {
  db.all(`SELECT * FROM clients ORDER BY name ASC`, (err, rows) => {
    if (err) {
      console.error('Error al obtener clientes:', err);
      return res.status(500).json({ error: 'Error al obtener clientes' });
    }
    
    res.json(rows || []);
  });
};

/**
 * Obtiene un cliente por ID
 */
export const getClientById = (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT * FROM clients WHERE id = ?`, [id], (err, row) => {
    if (err) {
      console.error('Error al obtener cliente:', err);
      return res.status(500).json({ error: 'Error al obtener cliente' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json(row);
  });
};

/**
 * Crea un nuevo cliente
 */
export const createClient = (req, res) => {
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre del cliente es requerido' });
  }
  
  db.run(
    `INSERT INTO clients (name, description) VALUES (?, ?)`,
    [name, description || ''],
    function(err) {
      if (err) {
        console.error('Error al crear cliente:', err);
        return res.status(500).json({ error: 'Error al crear cliente' });
      }
      
      // Get the created client
      db.get(`SELECT * FROM clients WHERE id = ?`, [this.lastID], (err, row) => {
        if (err) {
          console.error('Error al obtener el cliente creado:', err);
          return res.status(500).json({ error: 'Cliente creado pero no se pudo recuperar' });
        }
        
        res.status(201).json(row);
      });
    }
  );
};

/**
 * Actualiza un cliente existente
 */
export const updateClient = (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'El nombre del cliente es requerido' });
  }
  
  db.run(
    `UPDATE clients SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, description || '', id],
    function(err) {
      if (err) {
        console.error('Error al actualizar cliente:', err);
        return res.status(500).json({ error: 'Error al actualizar cliente' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }
      
      // Get the updated client
      db.get(`SELECT * FROM clients WHERE id = ?`, [id], (err, row) => {
        if (err) {
          console.error('Error al obtener el cliente actualizado:', err);
          return res.status(500).json({ error: 'Cliente actualizado pero no se pudo recuperar' });
        }
        
        res.json(row);
      });
    }
  );
};

/**
 * Elimina un cliente
 */
export const deleteClient = (req, res) => {
  const { id } = req.params;
  
  db.run(`DELETE FROM clients WHERE id = ?`, [id], function(err) {
    if (err) {
      console.error('Error al eliminar cliente:', err);
      return res.status(500).json({ error: 'Error al eliminar cliente' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    res.json({ message: 'Cliente eliminado correctamente' });
  });
};
