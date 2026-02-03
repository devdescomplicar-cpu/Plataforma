import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { getVapidPublicKey, isPushConfigured } from '../services/push.service.js';

/** GET /api/push/vapid-public-key - Public, returns VAPID public key for client subscription */
export async function getVapidKey(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = getVapidPublicKey();
    if (!key) {
      res.status(503).json({
        success: false,
        error: { message: 'Push notifications not configured' },
      });
      return;
    }
    res.json({ success: true, data: { publicKey: key } });
  } catch (e) {
    next(e);
  }
}

/** POST /api/push/subscribe - Auth required. Saves push subscription for the authenticated account */
export async function subscribe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const accountId = req.accountId;
    if (!accountId) {
      res.status(401).json({
        success: false,
        error: { message: 'Não autenticado' },
      });
      return;
    }
    if (!isPushConfigured()) {
      res.status(503).json({
        success: false,
        error: { message: 'Push notifications not configured' },
      });
      return;
    }
    const { subscription } = req.body as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    };
    if (
      !subscription ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.keys ||
      typeof subscription.keys.p256dh !== 'string' ||
      typeof subscription.keys.auth !== 'string'
    ) {
      res.status(400).json({
        success: false,
        error: { message: 'subscription com endpoint e keys (p256dh, auth) são obrigatórios' },
      });
      return;
    }
    const userAgent = (req.headers['user-agent'] as string) || undefined;
    await prisma.pushSubscription.upsert({
      where: {
        accountId_endpoint: { accountId, endpoint: subscription.endpoint },
      },
      create: {
        accountId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        updatedAt: new Date(),
      },
    });
    res.json({ success: true, data: { ok: true } });
  } catch (e) {
    next(e);
  }
}
