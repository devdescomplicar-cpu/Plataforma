import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { createAuditLog, getAuditContextFromRequest, type AuditChangeItem } from '../../utils/audit.js';

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
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** List all plans (admin). */
export async function listPlans(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { includeInactive } = req.query;
    const where = includeInactive === 'true' 
      ? {} // Incluir todos, mesmo desativados (mas não deletados)
      : { deletedAt: null };
    
    const plans = await prisma.plan.findMany({
      where,
      orderBy: [{ name: 'asc' }, { durationMonths: 'asc' }],
      select: {
        ...PLAN_SELECT,
        _count: { select: { subscriptions: true } },
      },
    });
    const data = plans.map((p) => ({
      ...p,
      subscribersCount: p._count.subscriptions,
    }));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Get plan by id (admin). */
export async function getPlanById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const plan = await prisma.plan.findFirst({
      where: { id, deletedAt: null },
      select: PLAN_SELECT,
    });
    if (!plan) {
      res.status(404).json({ success: false, error: { message: 'Plano não encontrado' } });
      return;
    }
    res.json({ success: true, data: plan });
  } catch (e) {
    next(e);
  }
}

/** Get plans statistics (admin). */
export async function getPlansStats(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Assinaturas Ativas (total de clientes pagando)
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        deletedAt: null,
        status: 'active',
      },
    });

    // 2. MRR (Receita Recorrente Mensal)
    // Soma de todos os preços de planos mensais ativos
    // Para planos não-mensais, calcula o valor mensal equivalente
    const subscriptions = await prisma.subscription.findMany({
      where: {
        deletedAt: null,
        status: 'active',
      },
      include: {
        plan: {
          select: {
            price: true,
            durationType: true,
            durationMonths: true,
          },
        },
      },
    });

    let mrr = 0;
    for (const sub of subscriptions) {
      const { price, durationType, durationMonths } = sub.plan;
      if (durationType === 'monthly') {
        mrr += price;
      } else if (durationType === 'quarterly') {
        mrr += price / 3; // Divide por 3 para obter o valor mensal
      } else if (durationType === 'semiannual') {
        mrr += price / 6; // Divide por 6 para obter o valor mensal
      } else if (durationType === 'annual') {
        mrr += price / 12; // Divide por 12 para obter o valor mensal
      } else if (durationMonths) {
        mrr += price / durationMonths; // Divide pelo número de meses
      }
    }

    // 3. Plano Mais Vendido (nome do plano + número de assinaturas)
    const planSalesCount = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        deletedAt: null,
        status: 'active',
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 1,
    });

    let topPlanBySales = null;
    if (planSalesCount.length > 0) {
      const topPlanId = planSalesCount[0].planId;
      const salesCount = planSalesCount[0]._count.id;
      const plan = await prisma.plan.findUnique({
        where: { id: topPlanId },
        select: {
          id: true,
          name: true,
        },
      });
      if (plan) {
        topPlanBySales = {
          id: plan.id,
          name: plan.name,
          subscriptionsCount: salesCount,
        };
      }
    }

    // 4. Plano Mais Lucrativo (maior faturamento total) — calculado a partir de subscriptions + plan.price
    const planRevenueMap = new Map<string, number>();
    for (const sub of subscriptions) {
      const planId = sub.planId;
      const currentRevenue = planRevenueMap.get(planId) || 0;
      planRevenueMap.set(planId, currentRevenue + sub.plan.price);
    }

    let topPlanByRevenue = null;
    if (planRevenueMap.size > 0) {
      let maxRevenue = 0;
      let topPlanId = '';
      for (const [planId, revenue] of planRevenueMap.entries()) {
        if (revenue > maxRevenue) {
          maxRevenue = revenue;
          topPlanId = planId;
        }
      }
      if (topPlanId) {
        const plan = await prisma.plan.findUnique({
          where: { id: topPlanId },
          select: {
            id: true,
            name: true,
          },
        });
        if (plan) {
          topPlanByRevenue = {
            id: plan.id,
            name: plan.name,
            totalRevenue: maxRevenue,
          };
        }
      }
    }

    res.json({
      success: true,
      data: {
        activeSubscriptions,
        mrr,
        topPlanBySales,
        topPlanByRevenue,
      },
    });
  } catch (e) {
    next(e);
  }
}

function parseCustomBenefits(raw: unknown): unknown {
  if (!Array.isArray(raw)) return null;
  const arr = raw
    .filter(
      (item): item is { text?: string; positive?: boolean } =>
        item !== null && typeof item === 'object'
    )
    .map((item) => ({
      text: typeof item.text === 'string' ? item.text : '',
      positive: typeof item.positive === 'boolean' ? item.positive : true,
    }));
  return arr.length > 0 ? arr : null;
}

/** Create a single plan (admin). */
export async function createPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as {
      name: string;
      description?: string;
      price: number;
      features?: string[];
      maxVehicles?: number | null;
      maxClients?: number | null;
      maxStorageMb?: number | null;
      durationType?: string;
      durationMonths?: number;
      checkoutUrl?: string | null;
      customBenefits?: unknown;
      active?: boolean;
    };
    if (!body.name || typeof body.price !== 'number') {
      res.status(400).json({ success: false, error: { message: 'Nome e preço são obrigatórios' } });
      return;
    }
    const plan = await prisma.plan.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        features: Array.isArray(body.features) ? body.features : [],
        maxVehicles: body.maxVehicles ?? null,
        maxClients: body.maxClients ?? null,
        maxStorageMb: body.maxStorageMb ?? null,
        durationType: body.durationType ?? 'monthly',
        durationMonths: body.durationMonths ?? 1,
        checkoutUrl: body.checkoutUrl ?? null,
        customBenefits: parseCustomBenefits(body.customBenefits) as any,
        active: body.active ?? true,
      },
      select: PLAN_SELECT,
    });
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'create',
      entity: 'Plan',
      entityId: plan.id,
      payload: { name: plan.name, durationType: plan.durationType },
    });
    res.status(201).json({ success: true, data: plan });
  } catch (e) {
    next(e);
  }
}

/** Create multiple plan offers (same base plan, different periods). */
export async function createPlansBatch(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as {
      name: string;
      description?: string;
      features?: string[];
      maxVehicles?: number | null;
      maxClients?: number | null;
      maxStorageMb?: number | null;
      checkoutUrl?: string | null;
      customBenefits?: unknown;
      active?: boolean;
      offers: Array<{ durationType: string; durationMonths: number; price: number }>;
    };
    if (!body.name || !Array.isArray(body.offers) || body.offers.length === 0) {
      res
        .status(400)
        .json({
          success: false,
          error: { message: 'Nome e ao menos uma oferta (período + preço) são obrigatórios' },
        });
      return;
    }
    for (const o of body.offers) {
      if (typeof o.price !== 'number' || typeof o.durationMonths !== 'number' || !o.durationType) {
        res.status(400).json({
          success: false,
          error: { message: 'Cada oferta deve ter durationType, durationMonths e price' },
        });
        return;
      }
    }
    const customBenefits = parseCustomBenefits(body.customBenefits);
    const created = await prisma.$transaction(
      body.offers.map((o) =>
        prisma.plan.create({
          data: {
            name: body.name,
            description: body.description ?? null,
            features: Array.isArray(body.features) ? body.features : [],
            maxVehicles: body.maxVehicles ?? null,
            maxClients: body.maxClients ?? null,
            maxStorageMb: body.maxStorageMb ?? null,
            checkoutUrl: body.checkoutUrl ?? null,
            customBenefits: customBenefits as any,
            durationType: o.durationType,
            durationMonths: o.durationMonths,
            price: o.price,
            active: body.active ?? true,
          },
          select: PLAN_SELECT,
        })
      )
    );
    for (const plan of created) {
      await createAuditLog({
        ...getAuditContextFromRequest(req),
        userId: req.userId,
        action: 'create',
        entity: 'Plan',
        entityId: plan.id,
        payload: { name: plan.name, durationType: plan.durationType },
      });
    }
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
}

/** Update plan (admin). Soft delete: set deletedAt. */
export async function updatePlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as {
      name?: string;
      description?: string;
      price?: number;
      features?: string[];
      maxVehicles?: number | null;
      maxClients?: number | null;
      maxStorageMb?: number | null;
      checkoutUrl?: string | null;
      customBenefits?: unknown;
      durationType?: string;
      durationMonths?: number;
      active?: boolean;
    };
    const existing = await prisma.plan.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Plano não encontrado' } });
      return;
    }
    const plan = await prisma.plan.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.price !== undefined && { price: body.price }),
        ...(body.features !== undefined && { features: body.features }),
        ...(body.maxVehicles !== undefined && { maxVehicles: body.maxVehicles }),
        ...(body.maxClients !== undefined && { maxClients: body.maxClients }),
        ...(body.maxStorageMb !== undefined && { maxStorageMb: body.maxStorageMb }),
        ...(body.checkoutUrl !== undefined && { checkoutUrl: body.checkoutUrl }),
        ...(body.customBenefits !== undefined && {
          customBenefits: parseCustomBenefits(body.customBenefits) as any,
        }),
        ...(body.durationType !== undefined && { durationType: body.durationType }),
        ...(body.durationMonths !== undefined && { durationMonths: body.durationMonths }),
        ...(body.active !== undefined && { active: body.active }),
      },
      select: PLAN_SELECT,
    });
    const changes: AuditChangeItem[] = [];
    if (body.name !== undefined && body.name !== existing.name) {
      changes.push({ field: 'name', label: 'Nome', oldValue: existing.name, newValue: body.name });
    }
    if (body.description !== undefined && (body.description ?? null) !== (existing.description ?? null)) {
      changes.push({ field: 'description', label: 'Descrição', oldValue: existing.description ?? null, newValue: body.description ?? null });
    }
    if (body.price !== undefined && body.price !== existing.price) {
      changes.push({ field: 'price', label: 'Preço', oldValue: existing.price, newValue: body.price });
    }
    if (body.active !== undefined && body.active !== existing.active) {
      changes.push({ field: 'active', label: 'Ativo', oldValue: existing.active, newValue: body.active });
    }
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'update',
      entity: 'Plan',
      entityId: id,
      payload: {
        summary: changes.length ? `Alterado(s): ${changes.map((c) => c.label).join(', ')}` : 'Plano atualizado',
        changes: changes.length ? changes : undefined,
      },
    });
    res.json({ success: true, data: plan });
  } catch (e) {
    next(e);
  }
}

/** Soft delete plan (admin). */
export async function softDeletePlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.plan.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Plano não encontrado' } });
      return;
    }
    await prisma.plan.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'delete',
      entity: 'Plan',
      entityId: id,
      payload: { name: existing.name },
    });
    res.json({ success: true, data: { message: 'Plano desativado com sucesso' } });
  } catch (e) {
    next(e);
  }
}
