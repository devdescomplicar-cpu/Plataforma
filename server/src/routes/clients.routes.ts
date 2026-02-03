import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  getClientsStats,
} from '../controllers/clients.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getClientsStats);
router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', createClient);
router.put('/:id', updateClient);
router.delete('/:id', deleteClient);

export default router;
