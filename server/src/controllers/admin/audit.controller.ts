import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

/** List audit logs with filters (admin). Enriches with user email, name and role. */
export async function listAuditLogs(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, entity, action, userRole, page = String(DEFAULT_PAGE), limit = String(DEFAULT_LIMIT) } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100);

    const where: { userId?: string | { in: string[] }; entity?: string; action?: string } = {};
    if (userId && typeof userId === 'string') where.userId = userId;
    if (entity && typeof entity === 'string') where.entity = entity;
    if (action && typeof action === 'string') where.action = action;

    if (userRole && typeof userRole === 'string') {
      const usersWithRole = await prisma.user.findMany({
        where: { role: userRole, deletedAt: null },
        select: { id: true },
      });
      const ids = usersWithRole.map((u) => u.id);
      where.userId = ids.length > 0 ? { in: ids } : { in: ['__no_match__'] };
    }

    const [logsToEnrich, totalToUse] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logsToEnrich.map((l) => l.userId).filter(Boolean))] as string[];
    let usersMap: Map<string, { email: string; name: string; role: string }> = new Map();
    if (userIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: userIds }, deletedAt: null },
        select: { id: true, email: true, name: true, role: true },
      });
      usersMap = new Map(users.map((u) => [u.id, { email: u.email, name: u.name, role: u.role }]));
    }

    const data = logsToEnrich.map((log) => {
      const user = log.userId ? usersMap.get(log.userId) : undefined;
      return {
        id: log.id,
        userId: log.userId,
        userEmail: user?.email ?? null,
        userName: user?.name ?? null,
        userRole: user?.role ?? null,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        payload: log.payload,
        ip: log.ip,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      };
    });

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: take,
        total: totalToUse,
        totalPages: Math.ceil(totalToUse / take) || 1,
      },
    });
  } catch (e) {
    next(e);
  }
}
