import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { executeWelcomeTrigger } from '../../services/notification-trigger.service.js';
import { normalizeEmail } from '../../utils/email.js';
import { createAuditLog, getAuditContextFromRequest, type AuditChangeItem } from '../../utils/audit.js';
import { validateAndNormalizeCpfCnpj } from '../../utils/cpf-cnpj.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/** Get users statistics (admin). */
export async function getUsersStats(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7);
    sevenDaysFromNow.setHours(23, 59, 59, 999);

    const [
      totalUsers,
      activeUsers,
      expiringIn7Days,
      salesByAccount,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({
        where: {
          deletedAt: null,
          role: 'user',
          accounts: {
            some: {
              deletedAt: null,
              trialEndsAt: { gte: now },
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
          role: 'user',
          accounts: {
            some: {
              deletedAt: null,
              trialEndsAt: {
                gte: now,
                lte: sevenDaysFromNow,
              },
            },
          },
        },
      }),
      prisma.sale.groupBy({
        by: ['accountId'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
    ]);

    // Find account with most sales
    let topUserBySales = null;
    if (salesByAccount.length > 0) {
      const topAccount = salesByAccount.reduce((max, item) => 
        item._count.id > max._count.id ? item : max
      );
      
      const account = await prisma.account.findFirst({
        where: { id: topAccount.accountId, deletedAt: null },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (account?.user) {
        topUserBySales = {
          id: account.user.id,
          name: account.user.name,
          email: account.user.email,
          salesCount: topAccount._count.id,
        };
      }
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        expiringIn7Days,
        topUserBySales,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** List all users (admin). */
export async function listUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { search, page = String(DEFAULT_PAGE), limit = String(DEFAULT_LIMIT) } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Math.min(Number(limit), 100);

    const searchStr = typeof search === 'string' ? search.trim() : '';
    const where = {
      deletedAt: null,
      ...(searchStr
        ? {
            OR: [
              { email: { contains: searchStr, mode: 'insensitive' as const } },
              { name: { contains: searchStr, mode: 'insensitive' as const } },
              { phone: { contains: searchStr, mode: 'insensitive' as const } },
              { cpfCnpj: { contains: searchStr, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          cpfCnpj: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          accounts: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              status: true,
              trialEndsAt: true,
              createdAt: true,
              subscriptions: {
                where: { deletedAt: null },
                orderBy: { startDate: 'desc' },
                take: 1,
                select: {
                  id: true,
                  status: true,
                  startDate: true,
                  endDate: true,
                  plan: {
                    select: {
                      id: true,
                      name: true,
                      price: true,
                      durationType: true,
                      durationMonths: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone ?? null,
      cpfCnpj: u.cpfCnpj ?? null,
      role: u.role,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
      account: u.accounts[0]
        ? {
            id: u.accounts[0].id,
            name: u.accounts[0].name,
            status: u.accounts[0].status,
            trialEndsAt: u.accounts[0].trialEndsAt?.toISOString() ?? null,
            createdAt: u.accounts[0].createdAt.toISOString(),
            subscription: (() => {
              const sub = u.accounts[0].subscriptions[0];
              if (!sub) return null;
              return {
                id: sub.id,
                status: sub.status,
                startDate: sub.startDate.toISOString(),
                endDate: sub.endDate?.toISOString() ?? null,
                plan: {
                  id: sub.plan.id,
                  name: sub.plan.name,
                  price: sub.plan.price,
                  durationType: sub.plan.durationType,
                  durationMonths: sub.plan.durationMonths,
                },
              };
            })(),
          }
        : null,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Get one user by id (admin). */
export async function getUserById(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpfCnpj: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
            subscriptions: {
              where: { deletedAt: null },
              orderBy: { startDate: 'desc' },
              select: {
                id: true,
                status: true,
                startDate: true,
                endDate: true,
                plan: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    durationType: true,
                    durationMonths: true,
                    maxVehicles: true,
                    maxStorageMb: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }
    const acc = user.accounts[0];
    const sub = acc?.subscriptions[0];
    res.json({
      success: true,
      data: {
        ...user,
        account: acc
          ? {
              ...acc,
              subscription: sub
                ? {
                    ...sub,
                    startDate: sub.startDate.toISOString(),
                    endDate: sub.endDate?.toISOString() ?? null,
                    plan: {
                      ...sub.plan,
                    },
                  }
                : null,
            }
          : null,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Update user and account (admin). Validates CPF/CNPJ. */
export async function updateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as {
      name?: string;
      email?: string;
      phone?: string | null;
      cpfCnpj?: string | null;
      role?: string;
      accountName?: string;
      trialEndsAt?: string | null;
      status?: string;
    };

    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { accounts: { where: { deletedAt: null }, take: 1 } },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }

    if (body.cpfCnpj !== undefined) {
      const raw = body.cpfCnpj === null || body.cpfCnpj === '' ? '' : String(body.cpfCnpj).trim();
      const { valid, normalized } = validateAndNormalizeCpfCnpj(raw);
      if (!valid && raw !== '') {
        res.status(400).json({
          success: false,
          error: { message: 'CPF ou CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).' },
        });
        return;
      }
      body.cpfCnpj = normalized || null;
    }

    if (body.email !== undefined && body.email.trim() !== '') {
      const emailNorm = normalizeEmail(body.email);
      const existing = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' }, id: { not: id }, deletedAt: null },
      });
      if (existing) {
        res.status(400).json({ success: false, error: { message: 'E-mail já cadastrado para outro usuário' } });
        return;
      }
    }

    const newRole = body.role === 'admin' || body.role === 'user' ? body.role : undefined;
    await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name.trim() }),
        ...(body.email !== undefined && { email: normalizeEmail(body.email) }),
        ...(body.phone !== undefined && { phone: body.phone?.trim() || null }),
        ...(body.cpfCnpj !== undefined && { cpfCnpj: body.cpfCnpj }),
        ...(newRole !== undefined && { role: newRole }),
      },
    });

    const account = user.accounts[0];
    const effectiveRole = newRole ?? user.role;
    const isAdminUser = effectiveRole === 'admin';
    
    // Manter a data exatamente como foi enviada (sem conversão de timezone)
    let trialEndsAtVal: Date | null | undefined = undefined;
    if (body.trialEndsAt !== undefined) {
      if (body.trialEndsAt === null || body.trialEndsAt === '') {
        trialEndsAtVal = null;
      } else if (account?.trialEndsAt) {
        // Se já existe uma data e a data enviada é a mesma, manter o objeto Date original
        const existingDateStr = account.trialEndsAt.toISOString().split('T')[0];
        if (body.trialEndsAt === existingDateStr) {
          trialEndsAtVal = account.trialEndsAt;
        } else {
          // Nova data: parse como local (meio-dia UTC para evitar problemas de timezone)
          const [year, month, day] = body.trialEndsAt.split('-').map(Number);
          trialEndsAtVal = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        }
      } else {
        // Nova data: parse como local (meio-dia UTC para evitar problemas de timezone)
        const [year, month, day] = body.trialEndsAt.split('-').map(Number);
        trialEndsAtVal = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      }
    }
    const hasAccountUpdates =
      body.accountName !== undefined ||
      body.trialEndsAt !== undefined;

    if (account && hasAccountUpdates) {
      // Calculate status based on trialEndsAt
      let statusVal: string | undefined = undefined;
      if (trialEndsAtVal !== undefined && !isAdminUser) {
        if (trialEndsAtVal === null) {
          statusVal = 'vencido';
        } else {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const trialDate = new Date(trialEndsAtVal);
          trialDate.setHours(0, 0, 0, 0);
          statusVal = trialDate >= now ? 'active' : 'vencido';
        }
      } else if (account.trialEndsAt && !isAdminUser) {
        // Recalculate status if trialEndsAt already exists
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const trialDate = new Date(account.trialEndsAt);
        trialDate.setHours(0, 0, 0, 0);
        statusVal = trialDate >= now ? 'active' : 'vencido';
      }

      await prisma.account.update({
        where: { id: account.id },
        data: {
          ...(body.accountName !== undefined && { name: body.accountName.trim() }),
          ...(trialEndsAtVal !== undefined && !isAdminUser && { trialEndsAt: trialEndsAtVal }),
          ...(statusVal !== undefined && !isAdminUser && { status: statusVal }),
        },
      });
    }

    const changes: AuditChangeItem[] = [];
    if (body.name !== undefined && body.name.trim() !== user.name) {
      changes.push({ field: 'name', label: 'Nome', oldValue: user.name, newValue: body.name.trim() });
    }
    if (body.email !== undefined && body.email.trim() !== user.email) {
      changes.push({ field: 'email', label: 'E-mail', oldValue: user.email, newValue: body.email.trim() });
    }
    if (body.phone !== undefined) {
      const newPhone = body.phone?.trim() || null;
      if (newPhone !== (user.phone ?? null)) {
        changes.push({ field: 'phone', label: 'Telefone', oldValue: user.phone ?? null, newValue: newPhone });
      }
    }
    if (body.cpfCnpj !== undefined) {
      const newCpf = body.cpfCnpj ?? null;
      if (newCpf !== (user.cpfCnpj ?? null)) {
        changes.push({ field: 'cpfCnpj', label: 'CPF/CNPJ', oldValue: user.cpfCnpj ?? null, newValue: newCpf });
      }
    }
    if (newRole !== undefined && newRole !== user.role) {
      changes.push({ field: 'role', label: 'Perfil', oldValue: user.role, newValue: newRole });
    }
    if (account && body.accountName !== undefined && body.accountName.trim() !== account.name) {
      changes.push({
        field: 'accountName',
        label: 'Nome da conta',
        oldValue: account.name,
        newValue: body.accountName.trim(),
      });
    }
    if (account && body.trialEndsAt !== undefined) {
      const oldTrial = account.trialEndsAt ? account.trialEndsAt.toISOString().slice(0, 10) : null;
      const newTrial =
        body.trialEndsAt === null || body.trialEndsAt === ''
          ? null
          : trialEndsAtVal
            ? trialEndsAtVal.toISOString().slice(0, 10)
            : null;
      if (oldTrial !== newTrial) {
        changes.push({ field: 'trialEndsAt', label: 'Data de vencimento (trial)', oldValue: oldTrial, newValue: newTrial });
      }
    }

    const userDescription =
      changes.length > 0
        ? `Usuário '${user.name}': ${changes.map((c) => c.label).join(', ')} alterados`
        : `Usuário '${user.name}' (nenhum campo alterado)`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'update',
      entity: 'User',
      entityId: id,
      payload: {
        description: userDescription,
        summary: changes.length ? `Alterado(s): ${changes.map((c) => c.label).join(', ')}` : 'Nenhum campo alterado',
        changes: changes.length ? changes : undefined,
        entityName: user.name,
      },
    });

    const updated = await prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpfCnpj: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
          },
        },
      },
    });
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
}

/** Create user (admin). Creates user + default account. */
export async function createUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as {
      name: string;
      email: string;
      password: string;
      phone?: string | null;
      cpfCnpj?: string | null;
      role?: string;
      accountName?: string;
      trialEndsAt?: string | null;
      status?: string;
    };

    if (!body.name?.trim() || !body.email?.trim() || !body.password) {
      res.status(400).json({
        success: false,
        error: { message: 'Nome, e-mail e senha são obrigatórios' },
      });
      return;
    }

    if (body.password.length < 6) {
      res.status(400).json({
        success: false,
        error: { message: 'Senha deve ter no mínimo 6 caracteres' },
      });
      return;
    }

    if (body.cpfCnpj !== undefined && body.cpfCnpj !== null && String(body.cpfCnpj).trim() !== '') {
      const raw = String(body.cpfCnpj).trim();
      const { valid, normalized } = validateAndNormalizeCpfCnpj(raw);
      if (!valid) {
        res.status(400).json({
          success: false,
          error: { message: 'CPF ou CNPJ inválido. Informe 11 dígitos (CPF) ou 14 dígitos (CNPJ).' },
        });
        return;
      }
      body.cpfCnpj = normalized;
    } else {
      body.cpfCnpj = null;
    }

    const emailNorm = normalizeEmail(body.email);
    const existing = await prisma.user.findFirst({
      where: { email: { equals: emailNorm, mode: 'insensitive' }, deletedAt: null },
    });
    if (existing) {
      res.status(400).json({
        success: false,
        error: { message: 'E-mail já cadastrado' },
      });
      return;
    }

    const role = body.role === 'admin' || body.role === 'user' ? body.role : 'user';
    const hashedPassword = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashedPassword,
        name: body.name.trim(),
        phone: body.phone?.trim() || null,
        cpfCnpj: body.cpfCnpj,
        role,
      },
    });

    const accountName = body.accountName?.trim() || `${user.name}'s Account`;
    const trialEndsAt =
      role === 'admin'
        ? null
        : body.trialEndsAt !== undefined && body.trialEndsAt !== null && body.trialEndsAt !== ''
          ? new Date(body.trialEndsAt)
          : null;

    // Calculate status based on trialEndsAt
    const accountStatus = role === 'admin' 
      ? 'active' 
      : (trialEndsAt && trialEndsAt >= new Date()) 
        ? 'active' 
        : 'vencido';

    await prisma.account.create({
      data: {
        name: accountName,
        userId: user.id,
        status: accountStatus,
        trialEndsAt,
      },
    });

    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'create',
      entity: 'User',
      entityId: user.id,
      payload: {
        description: `Usuário '${user.name}' (${user.email}) criado`,
        email: user.email,
        role,
        entityName: user.name,
      },
    });

    executeWelcomeTrigger(user.id).catch((err) => {
      console.error('[admin/users] welcome trigger failed', err);
    });

    const created = await prisma.user.findFirst({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        cpfCnpj: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        accounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            status: true,
            trialEndsAt: true,
            createdAt: true,
          },
        },
      },
    });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
}

/** Update account trial end date (admin). */
export async function updateAccountTrial(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { accountId } = req.params;
    const { trialEndsAt } = req.body as { trialEndsAt?: string | null };
    const account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
      include: { user: { select: { name: true } } },
    });
    if (!account) {
      res.status(404).json({ success: false, error: { message: 'Conta não encontrada' } });
      return;
    }
    
    // Manter a data exatamente como foi enviada (sem conversão de timezone)
    let newDate: Date | null | undefined = undefined;
    if (trialEndsAt !== undefined) {
      if (trialEndsAt === null || trialEndsAt === '') {
        newDate = null;
      } else if (account.trialEndsAt) {
        // Se já existe uma data e a data enviada é a mesma, manter o objeto Date original
        const existingDateStr = account.trialEndsAt.toISOString().split('T')[0];
        if (trialEndsAt === existingDateStr) {
          newDate = account.trialEndsAt;
        } else {
          // Nova data: parse como local (meio-dia UTC para evitar problemas de timezone)
          const [year, month, day] = trialEndsAt.split('-').map(Number);
          newDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        }
      } else {
        // Nova data: parse como local (meio-dia UTC para evitar problemas de timezone)
        const [year, month, day] = trialEndsAt.split('-').map(Number);
        newDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      }
    }
    await prisma.account.update({
      where: { id: accountId },
      data: newDate !== undefined ? { trialEndsAt: newDate } : {},
    });
    const userName = account.user?.name ?? 'Usuário';
    const newDateStr = newDate ? newDate.toISOString().slice(0, 10) : null;
    const trialDescription = newDateStr
      ? `Data de vencimento de '${userName}' alterada para ${newDateStr}`
      : `Data de vencimento de '${userName}' removida`;
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'update',
      entity: 'Account',
      entityId: accountId,
      payload: {
        description: trialDescription,
        summary: 'Data de vencimento do trial alterada',
        changes: [
          {
            field: 'trialEndsAt',
            label: 'Data de vencimento (trial)',
            oldValue: account.trialEndsAt ? account.trialEndsAt.toISOString().slice(0, 10) : null,
            newValue: newDateStr,
          },
        ],
        entityName: userName,
      },
    });
    res.json({ success: true, data: { trialEndsAt: newDate } });
  } catch (e) {
    next(e);
  }
}

/** Permanently delete user and all related data (admin). Irreversible — data is removed from DB. */
export async function deleteUserPermanently(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const user = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: {
        accounts: {
          where: { deletedAt: null },
          select: {
            id: true,
            vehicles: { where: { deletedAt: null }, select: { id: true } },
            checklists: { where: { deletedAt: null }, select: { id: true } },
          },
        },
        webhooks: { where: { deletedAt: null }, select: { id: true } },
      },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'Usuário não encontrado' } });
      return;
    }

    const accountIds = user.accounts.map((a) => a.id);
    const vehicleIds = user.accounts.flatMap((a) => a.vehicles.map((v) => v.id));
    const checklistIds = user.accounts.flatMap((a) => a.checklists.map((c) => c.id));
    const webhookIds = user.webhooks.map((w) => w.id);

    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'permanent_delete',
      entity: 'User',
      entityId: id,
      payload: {
        description: `Usuário '${user.name}' (${user.email}) excluído permanentemente`,
        email: user.email,
        name: user.name,
        entityName: user.name,
      },
    });

    await prisma.$transaction(async (tx) => {
      if (accountIds.length > 0) {
        await tx.sale.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.expense.deleteMany({ where: { accountId: { in: accountIds } } });
        if (vehicleIds.length > 0) {
          await tx.vehicleImage.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
        }
        await tx.vehicle.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.client.deleteMany({ where: { accountId: { in: accountIds } } });
        if (checklistIds.length > 0) {
          await tx.checklistItem.deleteMany({ where: { checklistId: { in: checklistIds } } });
        }
        await tx.checklist.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.subscription.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.pushSubscription.deleteMany({ where: { accountId: { in: accountIds } } });
        await tx.account.deleteMany({ where: { userId: id } });
      }
      if (webhookIds.length > 0) {
        await tx.webhookFieldMapping.deleteMany({ where: { webhookId: { in: webhookIds } } });
        await tx.webhookLog.deleteMany({ where: { webhookId: { in: webhookIds } } });
      }
      await tx.uniqueAccessLink.deleteMany({ where: { userId: id } });
      await tx.emailTemplate.deleteMany({ where: { userId: id } });
      await tx.webhook.deleteMany({ where: { userId: id } });
      await tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
      await tx.user.delete({ where: { id } });
    });

    res.json({ success: true, data: { message: 'Usuário e todos os dados relacionados foram excluídos permanentemente do banco.' } });
  } catch (e) {
    next(e);
  }
}

/** Change account plan (admin): create/update subscription. */
export async function changeAccountPlan(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { accountId } = req.params;
    const { planId, endDate } = req.body as { planId: string; endDate?: string | null };
    const account = await prisma.account.findFirst({
      where: { id: accountId, deletedAt: null },
    });
    const plan = await prisma.plan.findFirst({
      where: { id: planId, deletedAt: null, active: true },
    });
    if (!account) {
      res.status(404).json({ success: false, error: { message: 'Conta não encontrada' } });
      return;
    }
    if (!plan) {
      res.status(404).json({ success: false, error: { message: 'Plano não encontrado' } });
      return;
    }
    const existing = await prisma.subscription.findFirst({
      where: { accountId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
    // Manter a data exatamente como foi enviada (sem conversão de timezone)
    // Parse da data como local (meio-dia UTC para evitar problemas de timezone)
    let endDateVal: Date | null = null;
    if (endDate) {
      // Se já existe uma subscription e a data enviada é a mesma, manter o objeto Date original
      if (existing?.endDate) {
        const existingDateStr = existing.endDate.toISOString().split('T')[0];
        if (endDate === existingDateStr) {
          endDateVal = existing.endDate;
        } else {
          // Nova data: parse como local (meio-dia para evitar problemas de timezone)
          const [year, month, day] = endDate.split('-').map(Number);
          endDateVal = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
        }
      } else {
        // Nova data: parse como local (meio-dia para evitar problemas de timezone)
        const [year, month, day] = endDate.split('-').map(Number);
        endDateVal = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
      }
    }
    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: { planId, endDate: endDateVal, status: 'active' },
      });
    } else {
      await prisma.subscription.create({
        data: {
          accountId,
          planId,
          status: 'active',
          endDate: endDateVal,
        },
      });
    }
    const accountWithUser = await prisma.account.findFirst({
      where: { id: accountId },
      select: { name: true },
    });
    const accountLabel = accountWithUser?.name ?? 'Conta';
    await createAuditLog({
      ...getAuditContextFromRequest(req),
      userId: req.userId,
      action: 'plan_change',
      entity: 'Subscription',
      entityId: accountId,
      payload: {
        description: `Plano da conta '${accountLabel}' alterado para '${plan.name}'`,
        planId,
        planName: plan.name,
        entityName: accountLabel,
      },
    });
    res.json({ success: true, data: { planId, planName: plan.name } });
  } catch (e) {
    next(e);
  }
}
