import { Response, NextFunction, Request } from 'express';
import { prisma } from '../../services/prisma.service.js';

const PLAN_SELECT = {
  id: true,
  name: true,
  description: true,
  price: true,
  features: true,
  maxVehicles: true,
  maxClients: true,
  maxStorageMb: true,
  durationType: true,
  durationMonths: true,
  checkoutUrl: true,
  customBenefits: true,
} as const;

/** List all active plans (public, no auth required). */
export async function listPublicPlans(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await prisma.plan.findMany({
      where: {
        active: true,
        deletedAt: null,
      },
      orderBy: [{ name: 'asc' }, { durationMonths: 'asc' }],
      select: PLAN_SELECT,
    });
    res.json({ success: true, data: plans });
  } catch (e) {
    next(e);
  }
}
