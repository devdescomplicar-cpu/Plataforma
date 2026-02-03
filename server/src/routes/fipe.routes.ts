import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getFipeBrands,
  getFipeModels,
  getFipeYears,
  getFipePriceData,
} from '../controllers/fipe.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

router.get('/brands', getFipeBrands);
router.get('/models', getFipeModels);
router.get('/years', getFipeYears);
router.get('/price', getFipePriceData);

export default router;
