import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getDashboardMetrics,
  getDashboardVehicles,
  getDashboardData,
} from '../controllers/dashboard.controller.js';
import {
  getReports,
  getReportsSeller,
  getReportsCollaborators,
  getReportsCollaboratorById,
} from '../controllers/reports.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/metrics', getDashboardMetrics);
router.get('/vehicles', getDashboardVehicles);
router.get('/data', getDashboardData);
router.get('/reports', getReports);
router.get('/reports/seller', getReportsSeller);
router.get('/reports/collaborators', getReportsCollaborators);
router.get('/reports/collaborators/:userId', getReportsCollaboratorById);

export default router;
