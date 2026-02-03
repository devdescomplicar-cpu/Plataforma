import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware.js';
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  addVehicleImage,
  deleteVehicleImage,
  getVehiclesMetrics,
} from '../controllers/vehicles.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

router.get('/metrics', getVehiclesMetrics);
router.get('/', getVehicles);
router.get('/:id', getVehicleById);
router.post(
  '/',
  (req, res, next) => {
    console.log('[POST /vehicles] Request reached server (before multer)');
    next();
  },
  ...createVehicle
);
router.put('/:id', upload.array('images', 10), updateVehicle);
router.delete('/:id', deleteVehicle);
router.post('/:id/images', addVehicleImage);
router.delete('/:id/images/:imageId', deleteVehicleImage);

export default router;
