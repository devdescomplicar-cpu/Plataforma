import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { sendPushNotification, isPushConfigured } from '../../services/push.service.js';
import { createAuditLog, getAuditContextFromRequest } from '../../utils/audit.js';

export type TargetFilter = 'all' | 'active' | 'vencido';

/** Account filter: all non-deleted accounts (includes admin). No exclusion by user.role. */
function accountWhere(filter: TargetFilter) {
  return filter === 'all'
    ? { deletedAt: null }
    : filter === 'vencido'
      ? { deletedAt: null, status: 'vencido' }
      : { deletedAt: null, status: 'active' };
}

/** POST /api/admin/notifications/send - Send push only (PWA / navegador). No email. */
export async function sendNotification(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (typeof prisma.pushSubscription === 'undefined' || typeof prisma.pushNotificationLog === 'undefined') {
      res.status(503).json({
        success: false,
        error: {
          message:
            'Modelo de push não disponível. No servidor, rode: cd server && npx prisma generate e reinicie a API.',
        },
      });
      return;
    }
    const { title, body, targetFilter } = req.body as {
      title?: string;
      body?: string;
      targetFilter?: string;
    };
    const t = typeof title === 'string' ? title.trim() : '';
    const b = typeof body === 'string' ? body.trim() : '';
    const filter = targetFilter === 'vencido' || targetFilter === 'active' ? targetFilter : 'all';
    if (!t || !b) {
      res.status(400).json({
        success: false,
        error: { message: 'title e body são obrigatórios' },
      });
      return;
    }
    if (!isPushConfigured()) {
      res.status(503).json({
        success: false,
        error: { message: 'Push não configurado. Defina VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no servidor.' },
      });
      return;
    }

    const where = accountWhere(filter);
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { account: where },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const totalPushDevices = subscriptions.length;
    const payload = JSON.stringify({ title: t, body: b });
    let sent = 0;
    const failedIds: string[] = [];
    for (const sub of subscriptions) {
      try {
        const ok = await sendPushNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        if (ok) sent++;
        else failedIds.push(sub.id);
      } catch {
        failedIds.push(sub.id);
      }
    }
    if (failedIds.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: failedIds } } });
    }

    const failedCount = failedIds.length;
    await prisma.pushNotificationLog.create({
      data: { title: t, body: b, targetFilter: filter, sentCount: sent, failedCount },
    });

    const filterLabel = filter === 'all' ? 'todos' : filter === 'active' ? 'ativos' : 'vencidos';
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'notification_send',
      entity: 'PushNotification',
      payload: {
        description: `Notificação push enviada: '${t}' para contas ${filterLabel} (${sent}/${totalPushDevices} dispositivos)`,
        title: t,
        targetFilter: filter,
        sentCount: sent,
        totalDevices: totalPushDevices,
      },
    });

    res.json({
      success: true,
      data: { sent, total: totalPushDevices, targetFilter: filter },
    });
  } catch (e) {
    next(e);
  }
}

type LogEntry = {
  id: string;
  title: string;
  body: string;
  targetFilter: string;
  sentCount: number;
  failedCount: number;
  createdAt: Date;
};

/** GET /api/admin/notifications/log - Uses raw query so it works even without emailSentCount column. */
export async function listLog(
  req: AuthRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const safeLimit = Math.min(limit, 100);
  let logs: LogEntry[] = [];
  try {
    const raw = await prisma.$queryRawUnsafe<
      { id: string; title: string; body: string; targetFilter: string; sentCount: number; failedCount: number; createdAt: Date }[]
    >(
      `SELECT id, title, body, "targetFilter", "sentCount", COALESCE("failedCount", 0) AS "failedCount", "createdAt" FROM push_notification_logs ORDER BY "createdAt" DESC LIMIT $1`,
      safeLimit
    );
    logs = raw;
  } catch (e) {
    console.warn('[admin/notifications/log] list failed, returning empty:', e instanceof Error ? e.message : e);
  }
  res.json({ success: true, data: logs });
}
