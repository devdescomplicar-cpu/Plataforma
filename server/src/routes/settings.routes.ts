import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth.middleware.js';
import {
  getSettings,
  updateStoreInfo,
  updateSettings,
  uploadStoreLogo,
  uploadStoreLogoDark,
} from '../controllers/settings.controller.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
  },
});

const router = Router();

router.use(authMiddleware);

router.get('/', getSettings);
router.put('/store', updateStoreInfo);
router.post('/store/logo', upload.single('logo'), uploadStoreLogo);
router.post('/store/logo-dark', upload.single('logoDark'), uploadStoreLogoDark);
router.put('/', updateSettings);

export default router;
