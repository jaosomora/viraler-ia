// api/routes/scriptRoutes.js
import express from 'express';
import * as scriptController from '../controllers/scriptController.js';

const router = express.Router();

// Rutas para guiones
router.get('/client/:clientId', scriptController.getClientScripts);
router.get('/:id', scriptController.getScriptById);
router.post('/client/:clientId', scriptController.createScript);
router.put('/:id', scriptController.updateScript);
router.delete('/:id', scriptController.deleteScript);

// Ruta para conversación con guión
router.post('/:scriptId/conversation', scriptController.conversationWithScript);

export default router;
