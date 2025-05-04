// api/controllers/logController.js
import { 
  getApiUsageStats, 
  getApiLogs, 
  getLogDetails 
} from '../services/logService.js';

/**
 * Obtiene estadísticas de uso de la API
 */
export const getUsageStats = async (req, res) => {
  try {
    const stats = await getApiUsageStats();
    res.json(stats);
  } catch (error) {
    console.error('Error al obtener estadísticas de uso:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas de uso' });
  }
};

/**
 * Obtiene lista de logs con filtros
 */
export const getLogs = async (req, res) => {
  try {
    const filters = {
      clientId: req.query.clientId ? parseInt(req.query.clientId) : null,
      scriptId: req.query.scriptId ? parseInt(req.query.scriptId) : null,
      requestType: req.query.requestType || null,
      status: req.query.status || null,
      startDate: req.query.startDate || null,
      endDate: req.query.endDate || null,
      limit: req.query.limit ? parseInt(req.query.limit) : 100,
      offset: req.query.offset ? parseInt(req.query.offset) : 0
    };
    
    const logs = await getApiLogs(filters);
    res.json(logs);
  } catch (error) {
    console.error('Error al obtener logs:', error);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
};

/**
 * Obtiene detalles de un log específico
 */
export const getLogDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const logDetails = await getLogDetails(id);
    
    if (!logDetails) {
      return res.status(404).json({ error: 'Log no encontrado' });
    }
    
    res.json(logDetails);
  } catch (error) {
    console.error('Error al obtener detalles del log:', error);
    res.status(500).json({ error: 'Error al obtener detalles del log' });
  }
};
