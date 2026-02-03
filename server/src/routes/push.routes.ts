import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as pushController from '../controllers/push.controller.js';

const router = Router();

router.get('/vapid-public-key', pushController.getVapidKey);
router.post('/subscribe', authMiddleware, pushController.subscribe);

export default router;
