import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { expenseSchema, parseExpenseBody, normalizeExpenseUpdateBody } from '../utils/validators.js';
import { getPublicImageUrl } from '../services/minio.service.js';

export const getExpenses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { search, status, vehicleId, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      accountId,
      deletedAt: null,
    };

    if (status) {
      where.status = status;
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (search) {
      where.OR = [
        { type: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { vehicle: { brand: { contains: search as string, mode: 'insensitive' } } },
        { vehicle: { model: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
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
        },
        orderBy: { date: 'desc' },
      }),
      prisma.expense.count({ where }),
    ]);

    res.json({
      success: true,
      data: expenses,
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

export const getExpenseById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: {
        vehicle: true,
      },
    });

    if (!expense) {
      res.status(404).json({
        success: false,
        error: { message: 'Despesa não encontrada' },
      });
      return;
    }

    res.json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

export const createExpense = async (
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
    const expenseData = expenseSchema.parse({
      ...req.body,
      value: parseFloat(req.body.value),
      date: req.body.date ? new Date(req.body.date) : undefined,
    });

    if (expenseData.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: expenseData.vehicleId,
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
    }

    const expense = await prisma.expense.create({
      data: {
        ...expenseData,
        accountId,
      },
      include: {
        vehicle: true,
      },
    });

    res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

export const updateExpense = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const normalized = normalizeExpenseUpdateBody(req.body);
    const expenseData = expenseSchema.partial().parse(normalized);

    if (expenseData.vehicleId) {
      const vehicle = await prisma.vehicle.findFirst({
        where: {
          id: expenseData.vehicleId,
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
    }

    const expense = await prisma.expense.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: {
        ...expenseData,
        updatedAt: new Date(),
      },
    });

    if (expense.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Despesa não encontrada' },
      });
      return;
    }

    const updatedExpense = await prisma.expense.findUnique({
      where: { id },
      include: {
        vehicle: true,
      },
    });

    res.json({
      success: true,
      data: updatedExpense,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteExpense = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const expense = await prisma.expense.updateMany({
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

    if (expense.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Despesa não encontrada' },
      });
      return;
    }

    res.json({
      success: true,
      message: 'Despesa excluída com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const getVehiclesWithExpenses = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;

    // Buscar todos os veículos com imagens
    const vehicles = await prisma.vehicle.findMany({
      where: {
        accountId,
        deletedAt: null,
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          take: 1, // Apenas imagem da capa
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Buscar estatísticas de despesas para cada veículo
    const vehiclesWithExpenses = await Promise.all(
      vehicles.map(async (vehicle) => {
        const expensesStats = await prisma.expense.aggregate({
          where: {
            vehicleId: vehicle.id,
            deletedAt: null,
          },
          _count: {
            id: true,
          },
          _sum: {
            value: true,
          },
        });

        const expensesCount = expensesStats._count.id ?? 0;
        const expensesTotal = expensesStats._sum.value ?? 0;

        return {
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          version: vehicle.version,
          year: vehicle.year,
          km: vehicle.km,
          plate: vehicle.plate,
          color: vehicle.color,
          image: vehicle.images[0] ? getPublicImageUrl(vehicle.images[0].key) : null,
          expensesCount,
          expensesTotal,
        };
      })
    );

    // Filtrar apenas veículos com despesas
    const vehiclesWithExpensesFiltered = vehiclesWithExpenses.filter((v) => v.expensesCount > 0);

    // Calcular estatísticas gerais
    const totalVehiclesWithExpenses = vehiclesWithExpensesFiltered.length;
    const totalExpensesValue = vehiclesWithExpensesFiltered.reduce((sum, v) => sum + v.expensesTotal, 0);
    const averageExpensesPerVehicle = totalVehiclesWithExpenses > 0 
      ? totalExpensesValue / totalVehiclesWithExpenses 
      : 0;
    const vehicleWithHighestExpense = vehiclesWithExpensesFiltered.reduce(
      (max, v) => (v.expensesTotal > max.expensesTotal ? v : max),
      vehiclesWithExpensesFiltered[0] || null
    );

    res.json({
      success: true,
      data: {
        vehicles: vehiclesWithExpensesFiltered,
        stats: {
          totalVehiclesWithExpenses,
          totalExpensesValue,
          averageExpensesPerVehicle,
          vehicleWithHighestExpense: vehicleWithHighestExpense
            ? {
                id: vehicleWithHighestExpense.id,
                brand: vehicleWithHighestExpense.brand,
                model: vehicleWithHighestExpense.model,
                version: vehicleWithHighestExpense.version,
                year: vehicleWithHighestExpense.year,
                km: vehicleWithHighestExpense.km,
                color: vehicleWithHighestExpense.color,
                expensesTotal: vehicleWithHighestExpense.expensesTotal,
              }
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
