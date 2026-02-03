import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { checklistSchema, parseChecklistBody, normalizeChecklistUpdateBody } from '../utils/validators.js';

export const getChecklists = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { vehicleId, status, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      accountId,
      deletedAt: null,
    };

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (status) {
      where.status = status;
    }

    const [checklists, total] = await Promise.all([
      prisma.checklist.findMany({
        where,
        skip,
        take,
        include: {
          vehicle: {
            select: {
              id: true,
              brand: true,
              model: true,
              year: true,
              plate: true,
            },
          },
          items: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checklist.count({ where }),
    ]);

    res.json({
      success: true,
      data: checklists,
      pagination: {
        page: parseInt(page as string),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getChecklistById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const checklist = await prisma.checklist.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: {
        vehicle: true,
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!checklist) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    res.json({
      success: true,
      data: checklist,
    });
  } catch (error) {
    next(error);
  }
};

export const createChecklist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    if (!accountId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }
    const checklistData = checklistSchema.parse(req.body);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: checklistData.vehicleId,
        accountId,
        deletedAt: null,
      },
    });

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: { message: 'Veículo não encontrado' },
      });
      return;
    }

    const checklist = await prisma.checklist.create({
      data: {
        accountId,
        vehicleId: checklistData.vehicleId,
        status: checklistData.status || 'pending',
        items: {
          create: checklistData.items.map((item) => ({
            name: item.name,
            done: item.done || false,
          })),
        },
      },
      include: {
        vehicle: true,
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.status(201).json({
      success: true,
      data: checklist,
    });
  } catch (error) {
    next(error);
  }
};

export const updateChecklist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const normalized = normalizeChecklistUpdateBody(req.body);
    const checklistData = checklistSchema.partial().parse(normalized);

    const checklist = await prisma.checklist.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        status: checklistData.status,
        updatedAt: new Date(),
      },
    });

    if (checklist.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    const updatedChecklist = await prisma.checklist.findUnique({
      where: { id },
      include: {
        vehicle: true,
        items: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    res.json({
      success: true,
      data: updatedChecklist,
    });
  } catch (error) {
    next(error);
  }
};

export const updateChecklistItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id, itemId } = req.params;
    const { done, name } = req.body;

    const checklist = await prisma.checklist.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
    });

    if (!checklist) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    const item = await prisma.checklistItem.update({
      where: { id: itemId },
      data: {
        ...(done !== undefined && { done }),
        ...(name !== undefined && { name }),
        updatedAt: new Date(),
      },
    });

    const allItems = await prisma.checklistItem.findMany({
      where: { checklistId: id },
    });

    const allDone = allItems.every((i) => i.done);
    const newStatus = allDone ? 'completed' : 'in_progress';

    await prisma.checklist.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const createChecklistItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      res.status(400).json({
        success: false,
        error: { message: 'Nome do item é obrigatório' },
      });
      return;
    }

    const checklist = await prisma.checklist.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
    });

    if (!checklist) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    const item = await prisma.checklistItem.create({
      data: {
        checklistId: id,
        name: name.trim(),
        done: false,
      },
    });

    // Atualizar status do checklist para in_progress se estava completed
    if (checklist.status === 'completed') {
      await prisma.checklist.update({
        where: { id },
        data: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
      });
    }

    res.status(201).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteChecklistItem = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id, itemId } = req.params;

    const checklist = await prisma.checklist.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
    });

    if (!checklist) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    // Verificar se o item pertence ao checklist
    const item = await prisma.checklistItem.findFirst({
      where: {
        id: itemId,
        checklistId: id,
      },
    });

    if (!item) {
      res.status(404).json({
        success: false,
        error: { message: 'Item não encontrado' },
      });
      return;
    }

    // Deletar o item
    await prisma.checklistItem.delete({
      where: { id: itemId },
    });

    // Atualizar status do checklist
    const allItems = await prisma.checklistItem.findMany({
      where: { checklistId: id },
    });

    const allDone = allItems.length > 0 && allItems.every((i) => i.done);
    const newStatus = allDone ? 'completed' : allItems.length > 0 ? 'in_progress' : 'pending';

    await prisma.checklist.update({
      where: { id },
      data: {
        status: newStatus,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Item excluído com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const deleteChecklist = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const checklist = await prisma.checklist.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (checklist.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Checklist não encontrado' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Checklist excluído com sucesso',
    });
  } catch (error) {
    next(error);
  }
};
