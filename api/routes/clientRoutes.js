// api/routes/clientRoutes.js
import express from 'express';
import * as clientController from '../controllers/clientController.js';
import * as documentController from '../controllers/documentController.js';

const router = express.Router();

// Rutas para clientes
router.get('/', clientController.getAllClients);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

// Rutas para documentos de clientes
router.get('/:clientId/documents', documentController.getClientDocuments);
router.post('/:clientId/documents', documentController.createDocument);
router.get('/documents/:id', documentController.getDocumentById);
router.put('/documents/:id', documentController.updateDocument);
router.delete('/documents/:id', documentController.deleteDocument);

export default router;
