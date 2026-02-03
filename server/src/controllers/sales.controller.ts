import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { saleSchema, parseSaleBody, normalizeSaleUpdateBody } from '../utils/validators.js';
import { getPublicImageUrl } from '../services/minio.service.js';

export const getSales = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { search, page = '1', limit = '20' } = req.query;

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const where: any = {
      accountId,
      deletedAt: null,
    };

    if (search) {
      where.OR = [
        { vehicle: { brand: { contains: search as string, mode: 'insensitive' } } },
        { vehicle: { model: { contains: search as string, mode: 'insensitive' } } },
        { client: { name: { contains: search as string, mode: 'insensitive' } } },
      ];
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take,
        include: {
          vehicle: {
            include: {
              images: {
                where: { deletedAt: null },
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              cpfCnpj: true,
              city: true,
            },
          },
        },
        orderBy: { saleDate: 'desc' },
      }),
      prisma.sale.count({ where }),
    ]);

    // Processar imagens dos veículos e selecionar apenas campos necessários
    const salesWithImages = sales.map((sale) => ({
      ...sale,
      vehicle: sale.vehicle
        ? {
            id: sale.vehicle.id,
            brand: sale.vehicle.brand,
            model: sale.vehicle.model,
            year: sale.vehicle.year,
            plate: sale.vehicle.plate,
            image: sale.vehicle.images && sale.vehicle.images[0] ? getPublicImageUrl(sale.vehicle.images[0].key) : null,
          }
        : sale.vehicle,
    }));

    res.json({
      success: true,
      data: salesWithImages,
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

export const getSaleById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const sale = await prisma.sale.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      include: {
        vehicle: true,
        client: true,
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        error: { message: 'Venda não encontrada' },
      });
      return;
    }

    res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

export const createSale = async (
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
    const saleData = saleSchema.parse({
      ...req.body,
      salePrice: parseFloat(req.body.salePrice),
      saleDate: req.body.saleDate ? new Date(req.body.saleDate) : undefined,
    });

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: saleData.vehicleId,
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

    // Buscar despesas do veículo
    const expenses = await prisma.expense.findMany({
      where: {
        vehicleId: saleData.vehicleId,
        accountId,
        deletedAt: null,
      },
      select: {
        value: true,
      },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.value, 0);
    const purchasePrice = vehicle.purchasePrice ?? 0;
    const totalCost = purchasePrice + totalExpenses;
    const profit = saleData.salePrice - totalCost;
    const profitPercent = totalCost > 0 ? (profit / totalCost) * 100 : 0;

    const sale = await prisma.sale.create({
      data: {
        ...saleData,
        accountId,
        profit,
        profitPercent: parseFloat(profitPercent.toFixed(2)),
      },
      include: {
        vehicle: true,
        client: true,
      },
    });

    await prisma.vehicle.updateMany({
      where: {
        id: saleData.vehicleId,
        accountId,
      },
      data: {
        status: 'sold',
        updatedAt: new Date(),
      },
    });

    res.status(201).json({
      success: true,
      data: sale,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSale = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    const normalized = normalizeSaleUpdateBody(req.body);
    const saleData = saleSchema.partial().parse(normalized);

    const updatePayload: {
      salePrice?: number;
      vehicleId?: string;
      clientId?: string;
      paymentMethod?: string; // Aceita múltiplas formas separadas por vírgula
      saleDate?: Date;
      profit?: number;
      profitPercent?: number;
      updatedAt: Date;
    } = {
      ...saleData,
      updatedAt: new Date(),
    };

    if (saleData.salePrice !== undefined) {
      const sale = await prisma.sale.findFirst({
        where: { id, accountId },
        include: { vehicle: true },
      });

      if (sale) {
        // Buscar despesas do veículo
        const expenses = await prisma.expense.findMany({
          where: {
            vehicleId: sale.vehicleId,
            accountId,
            deletedAt: null,
          },
          select: {
            value: true,
          },
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.value, 0);
        const purchasePrice = sale.vehicle.purchasePrice ?? 0;
        const totalCost = purchasePrice + totalExpenses;
        updatePayload.profit = saleData.salePrice - totalCost;
        updatePayload.profitPercent = totalCost > 0
          ? parseFloat(((updatePayload.profit / totalCost) * 100).toFixed(2))
          : 0;
      }
    }

    const sale = await prisma.sale.updateMany({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      data: updatePayload,
    });

    if (sale.count === 0) {
      res.status(404).json({
        success: false,
        error: { message: 'Venda não encontrada' },
      });
      return;
    }

    const updatedSale = await prisma.sale.findUnique({
      where: { id },
      include: {
        vehicle: true,
        client: true,
      },
    });

    res.json({
      success: true,
      data: updatedSale,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSale = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { id } = req.params;

    // Buscar a venda para obter o vehicleId
    const sale = await prisma.sale.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      select: {
        vehicleId: true,
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        error: { message: 'Venda não encontrada' },
      });
      return;
    }

    // Soft delete da venda
    await prisma.sale.updateMany({
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

    // Voltar o veículo para estoque
    await prisma.vehicle.updateMany({
      where: {
        id: sale.vehicleId,
        accountId,
      },
      data: {
        status: 'available',
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Venda cancelada com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;

    const [
      totalSold,
      totalRevenue,
      totalProfit,
      vehiclesInStock,
    ] = await Promise.all([
      // Total de veículos vendidos
      prisma.sale.count({
        where: {
          accountId,
          deletedAt: null,
        },
      }),
      // Faturamento total
      prisma.sale.aggregate({
        where: {
          accountId,
          deletedAt: null,
        },
        _sum: {
          salePrice: true,
        },
      }),
      // Lucro total
      prisma.sale.aggregate({
        where: {
          accountId,
          deletedAt: null,
        },
        _sum: {
          profit: true,
        },
      }),
      // Veículos em estoque
      prisma.vehicle.count({
        where: {
          accountId,
          deletedAt: null,
          status: { in: ['available', 'reserved'] },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalSold,
        totalRevenue: totalRevenue._sum.salePrice ?? 0,
        totalProfit: totalProfit._sum.profit ?? 0,
        vehiclesInStock,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSalesByMonth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { months = '6' } = req.query;
    const monthsCount = parseInt(months as string, 10) || 6;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsCount);

    const sales = await prisma.sale.findMany({
      where: {
        accountId,
        deletedAt: null,
        saleDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        saleDate: true,
        salePrice: true,
        profit: true,
      },
      orderBy: {
        saleDate: 'asc',
      },
    });

    // Agrupar por mês
    const byMonth = new Map<string, { sales: number; revenue: number; profit: number }>();
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, { sales: 0, revenue: 0, profit: 0 });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    sales.forEach((sale) => {
      const key = `${sale.saleDate.getFullYear()}-${String(sale.saleDate.getMonth() + 1).padStart(2, '0')}`;
      const monthData = byMonth.get(key);
      if (monthData) {
        monthData.sales += 1;
        monthData.revenue += sale.salePrice;
        monthData.profit += sale.profit;
      }
    });

    const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const result = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        return {
          month: MONTH_NAMES[parseInt(month, 10) - 1],
          year: parseInt(year, 10),
          sales: data.sales,
          revenue: Math.round(data.revenue),
          profit: Math.round(data.profit),
        };
      });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
