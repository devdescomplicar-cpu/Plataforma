import type { Request } from 'express';
import { prisma } from '../services/prisma.service.js';
import { getClientPublicIp } from './client-ip.js';

export interface AuditLogInput {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditChangeItem {
  field: string;
  label: string;
  oldValue: string | number | boolean | null;
  newValue: string | number | boolean | null;
}

/** Context from request for audit (public IP and user-agent). Use when req is available. */
export function getAuditContextFromRequest(req: Request): { ip?: string; userAgent?: string } {
  return {
    ip: getClientPublicIp(req),
    userAgent: req.get('user-agent') ?? undefined,
  };
}

/**
 * Records an action in the audit log. Non-blocking; logs errors without throwing.
 * Prefer passing ip/userAgent via getAuditContextFromRequest(req) for public IP and device tracking.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        payload: input.payload == null ? undefined : (input.payload as object),
        ip: input.ip,
        userAgent: input.userAgent,
      },
    });
  } catch (e) {
    console.error('[createAuditLog]', e);
  }
}
