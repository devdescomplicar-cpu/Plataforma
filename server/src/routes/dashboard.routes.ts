import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getDashboardMetrics,
  getDashboardVehicles,
  getDashboardData,
} from '../controllers/dashboard.controller.js';
import { getReports } from '../controllers/reports.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/metrics', getDashboardMetrics);
router.get('/vehicles', getDashboardVehicles);
router.get('/data', getDashboardData);
router.get('/reports', getReports);

export default router;
