import { Router, Request, Response, NextFunction } from 'express';
import { minioService } from '../services/minio.service.js';

const router = Router();

/**
 * GET /api/vehicle-images/*
 * Serve imagens de veículos via API (mesmo domínio HTTPS).
 * Evita mixed content e não expõe a porta do MinIO.
 */
router.get('*', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const key = req.path.replace(/^\//, '');
  if (!key || key.includes('..')) {
    res.status(400).json({ success: false, error: { message: 'Invalid key' } });
    return;
  }
  try {
    const { stream, contentType } = await minioService.getObjectStream(key);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
    stream.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: 'Failed to load image' } });
      }
      next(err);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(404).json({ success: false, error: { message: 'Image not found' } });
    }
    next(err);
  }
});

export default router;
