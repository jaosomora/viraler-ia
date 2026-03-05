// api/routes/logRoutes.js
import express from 'express';
import * as logController from '../controllers/logController.js';

const router = express.Router();

// Rutas para logs y estadísticas
router.get('/usage-stats', logController.getUsageStats);
router.get('/logs', logController.getLogs);
router.get('/logs/:id', logController.getLogDetail);

export default router;
