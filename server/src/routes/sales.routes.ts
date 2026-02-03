import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  getSalesStats,
  getSalesByMonth,
} from '../controllers/sales.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/stats', getSalesStats);
router.get('/by-month', getSalesByMonth);
router.get('/', getSales);
router.get('/:id', getSaleById);
router.post('/', createSale);
router.put('/:id', updateSale);
router.delete('/:id', deleteSale);

export default router;
