import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { normalizeEmail } from '../utils/email.js';

const COLLABORATOR_ROLES = ['manager', 'seller'] as const;
const COLLABORATOR_STATUSES = ['active', 'inactive'] as const;
const COMMISSION_TYPES = ['fixed', 'percent'] as const;

function ensureOwner(req: AuthRequest, res: Response, next: NextFunction): boolean {
  if (req.isAccountOwner) return true;
  res.status(403).json({
    success: false,
    error: { message: 'Apenas o dono da conta pode gerenciar colaboradores.' },
  });
  return false;
}

export const listCollaborators = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!ensureOwner(req, res, next)) return;
    const accountId = req.accountId!;

    const rows = await prisma.accountCollaborator.findMany({
      where: { accountId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      role: r.role,
      status: r.status,
      commissionType: r.commissionType,
      commissionValue: r.commissionValue,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
};

export const getCollaboratorById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!ensureOwner(req, res, next)) return;
    const accountId = req.accountId!;
    const id = req.params.id;

    const row = await prisma.accountCollaborator.findFirst({
      where: { id, accountId, deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!row) {
      res.status(404).json({
        success: false,
        error: { message: 'Colaborador não encontrado' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: row.id,
        userId: row.userId,
        name: row.user.name,
        email: row.user.email,
        role: row.role,
        status: row.status,
        commissionType: row.commissionType,
        commissionValue: row.commissionValue,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
};

type CreateBody = {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'seller';
  status?: 'active' | 'inactive';
  commissionType?: 'fixed' | 'percent';
  commissionValue?: number;
};

export const createCollaborator = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!ensureOwner(req, res, next)) return;
    const accountId = req.accountId!;
    const body = req.body as CreateBody;

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = normalizeEmail(body.email ?? '');
    const password = typeof body.password === 'string' ? body.password : '';
    const role = COLLABORATOR_ROLES.includes(body.role as (typeof COLLABORATOR_ROLES)[number])
      ? (body.role as (typeof COLLABORATOR_ROLES)[number])
      : null;
    const status = COLLABORATOR_STATUSES.includes(body.status as (typeof COLLABORATOR_STATUSES)[number])
      ? (body.status as (typeof COLLABORATOR_STATUSES)[number])
      : 'active';
    const commissionType = body.role === 'seller' && COMMISSION_TYPES.includes(body.commissionType as (typeof COMMISSION_TYPES)[number])
      ? (body.commissionType as (typeof COMMISSION_TYPES)[number])
      : null;
    const commissionValue = body.role === 'seller' && typeof body.commissionValue === 'number'
      ? body.commissionValue
      : null;

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Nome, e-mail e senha são obrigatórios.' },
      });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: { message: 'A senha deve ter no mínimo 6 caracteres.' },
      });
      return;
    }
    if (!role) {
      res.status(400).json({
        success: false,
        error: { message: 'Cargo inválido. Use "manager" ou "seller".' },
      });
      return;
    }
    if (role === 'seller' && (commissionType == null || commissionValue == null)) {
      res.status(400).json({
        success: false,
        error: { message: 'Vendedor deve ter tipo e valor de comissão definidos.' },
      });
      return;
    }
    if (role === 'seller' && commissionValue != null && commissionValue < 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Valor da comissão não pode ser negativo.' },
      });
      return;
    }
    if (role === 'seller' && commissionType === 'percent' && commissionValue != null && commissionValue > 100) {
      res.status(400).json({
        success: false,
        error: { message: 'Comissão percentual não pode ser maior que 100%.' },
      });
      return;
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
    });
    if (existingUser) {
      const alreadyInAccount = await prisma.accountCollaborator.findFirst({
        where: { accountId, userId: existingUser.id, deletedAt: null },
      });
      if (alreadyInAccount) {
        res.status(400).json({
          success: false,
          error: { message: 'Este e-mail já é colaborador desta conta.' },
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: { message: 'Este e-mail já está cadastrado no sistema. Use outro e-mail.' },
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'user',
      },
    });

    await prisma.accountCollaborator.create({
      data: {
        accountId,
        userId: user.id,
        role,
        status,
        commissionType: role === 'seller' ? commissionType! : null,
        commissionValue: role === 'seller' ? commissionValue! : null,
      },
    });

    const collaborator = await prisma.accountCollaborator.findFirst({
      where: { accountId, userId: user.id, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: collaborator!.id,
        userId: user.id,
        name: user.name,
        email: user.email,
        role: collaborator!.role,
        status: collaborator!.status,
        commissionType: collaborator!.commissionType,
        commissionValue: collaborator!.commissionValue,
        createdAt: collaborator!.createdAt,
        updatedAt: collaborator!.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
};

type UpdateBody = {
  name?: string;
  email?: string;
  role?: 'manager' | 'seller';
  status?: 'active' | 'inactive';
  commissionType?: 'fixed' | 'percent';
  commissionValue?: number;
};

export const updateCollaborator = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!ensureOwner(req, res, next)) return;
    const accountId = req.accountId!;
    const id = req.params.id;
    const body = req.body as UpdateBody;

    const row = await prisma.accountCollaborator.findFirst({
      where: { id, accountId, deletedAt: null },
      include: { user: true },
    });

    if (!row) {
      res.status(404).json({
        success: false,
        error: { message: 'Colaborador não encontrado' },
      });
      return;
    }

    const updates: { role?: string; status?: string; commissionType?: string | null; commissionValue?: number | null } = {};
    if (body.role !== undefined) {
      if (!COLLABORATOR_ROLES.includes(body.role)) {
        res.status(400).json({ success: false, error: { message: 'Cargo inválido.' } });
        return;
      }
      updates.role = body.role;
      if (body.role === 'seller') {
        updates.commissionType = body.commissionType ?? row.commissionType;
        updates.commissionValue = body.commissionValue ?? row.commissionValue;
      } else {
        updates.commissionType = null;
        updates.commissionValue = null;
      }
    }
    if (body.status !== undefined) {
      if (!COLLABORATOR_STATUSES.includes(body.status)) {
        res.status(400).json({ success: false, error: { message: 'Status inválido.' } });
        return;
      }
      updates.status = body.status;
    }
    if (body.role === 'seller' && (body.commissionType != null || body.commissionValue != null)) {
      updates.commissionType = body.commissionType ?? row.commissionType;
      updates.commissionValue = body.commissionValue ?? row.commissionValue;
      if (updates.commissionValue != null && updates.commissionValue < 0) {
        res.status(400).json({ success: false, error: { message: 'Comissão não pode ser negativa.' } });
        return;
      }
      if (updates.commissionType === 'percent' && updates.commissionValue != null && updates.commissionValue > 100) {
        res.status(400).json({ success: false, error: { message: 'Comissão percentual não pode ser maior que 100%.' } });
        return;
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.accountCollaborator.update({
        where: { id: row.id },
        data: updates,
      });
    }

    const userUpdates: { name?: string; email?: string } = {};
    if (typeof body.name === 'string' && body.name.trim()) userUpdates.name = body.name.trim();
    if (typeof body.email === 'string' && body.email.trim()) {
      const emailNorm = normalizeEmail(body.email);
      const existing = await prisma.user.findFirst({
        where: { email: { equals: emailNorm, mode: 'insensitive' }, id: { not: row.userId }, deletedAt: null },
      });
      if (existing) {
        res.status(400).json({ success: false, error: { message: 'E-mail já em uso por outro usuário.' } });
        return;
      }
      userUpdates.email = emailNorm;
    }
    if (Object.keys(userUpdates).length > 0) {
      await prisma.user.update({
        where: { id: row.userId },
        data: userUpdates,
      });
    }

    const updated = await prisma.accountCollaborator.findFirst({
      where: { id: row.id, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json({
      success: true,
      data: {
        id: updated!.id,
        userId: updated!.userId,
        name: updated!.user.name,
        email: updated!.user.email,
        role: updated!.role,
        status: updated!.status,
        commissionType: updated!.commissionType,
        commissionValue: updated!.commissionValue,
        createdAt: updated!.createdAt,
        updatedAt: updated!.updatedAt,
      },
    });
  } catch (e) {
    next(e);
  }
};

/** Soft delete: marca colaborador como removido (apenas dono). */
export const removeCollaborator = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!ensureOwner(req, res, next)) return;
    const accountId = req.accountId!;
    const id = req.params.id;

    const row = await prisma.accountCollaborator.findFirst({
      where: { id, accountId, deletedAt: null },
    });

    if (!row) {
      res.status(404).json({
        success: false,
        error: { message: 'Colaborador não encontrado' },
      });
      return;
    }

    await prisma.accountCollaborator.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });

    res.json({ success: true, data: { id: row.id } });
  } catch (e) {
    next(e);
  }
};
