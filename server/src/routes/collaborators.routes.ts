import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import * as collaboratorsController from '../controllers/collaborators.controller.js';

const router = Router();

router.use(authMiddleware);

router.get('/', collaboratorsController.listCollaborators);
router.get('/:id', collaboratorsController.getCollaboratorById);
router.post('/', collaboratorsController.createCollaborator);
router.put('/:id', collaboratorsController.updateCollaborator);
router.delete('/:id', collaboratorsController.removeCollaborator);

export default router;
