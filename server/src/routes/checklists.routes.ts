import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getChecklists,
  getChecklistById,
  createChecklist,
  updateChecklist,
  updateChecklistItem,
  createChecklistItem,
  deleteChecklistItem,
  deleteChecklist,
} from '../controllers/checklists.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getChecklists);
router.post('/', createChecklist);
router.get('/:id', getChecklistById);
router.put('/:id', updateChecklist);
router.post('/:id/items', createChecklistItem);
router.put('/:id/items/:itemId', updateChecklistItem);
router.delete('/:id/items/:itemId', deleteChecklistItem);
router.delete('/:id', deleteChecklist);

export default router;
