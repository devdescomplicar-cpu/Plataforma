import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
  getVehiclesWithExpenses,
} from '../controllers/expenses.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', getExpenses);
router.get('/vehicles', getVehiclesWithExpenses);
router.get('/:id', getExpenseById);
router.post('/', createExpense);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
