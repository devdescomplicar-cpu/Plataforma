import { Router } from 'express';
import * as plansController from '../controllers/public/plans.controller.js';

const router = Router();

// Public routes (no authentication required)
router.get('/plans', plansController.listPublicPlans);

export default router;
