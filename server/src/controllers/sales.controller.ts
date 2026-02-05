import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { saleSchema, parseSaleBody, normalizeSaleUpdateBody } from '../utils/validators.js';
import { getPublicImageUrl } from '../services/minio.service.js';
import { getBrazilDateParts, getBrazilMonthRange, parseDateStringAsBrazilDay } from '../utils/timezone.js';

export const getSales = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { search, page = '1', limit = '20', registeredById } = req.query;

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

    // Filtro por colaborador (vendedor que registrou a venda)
    if (registeredById && registeredById !== 'all') {
      where.registeredById = registeredById as string;
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
          registeredBy: { select: { id: true, name: true } },
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
        registeredBy: { select: { id: true, name: true } },
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
    const rawSaleDate = req.body.saleDate;
    const saleDateParsed = rawSaleDate
      ? (typeof rawSaleDate === 'string' && rawSaleDate.length <= 10
          ? parseDateStringAsBrazilDay(rawSaleDate)
          : new Date(rawSaleDate))
      : undefined;
    const saleData = saleSchema.parse({
      ...req.body,
      salePrice: parseFloat(req.body.salePrice),
      saleDate: saleDateParsed,
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

    // Salvar o salePrice original (preço pretendido) antes de atualizar
    // Este valor será usado quando a venda for deletada para restaurar o preço pretendido
    const originalSalePrice = vehicle.salePrice;

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

    let commissionAmount: number | undefined;
    if (req.userId) {
      const collaborator = await prisma.accountCollaborator.findFirst({
        where: { accountId, userId: req.userId, role: 'seller', status: 'active', deletedAt: null },
      });
      if (collaborator?.commissionType && collaborator.commissionValue != null) {
        commissionAmount =
          collaborator.commissionType === 'percent'
            ? (saleData.salePrice * collaborator.commissionValue) / 100
            : collaborator.commissionValue;
      }
    }

    // Usar registeredById do body se fornecido (dono/gerente), senão usar req.userId
    const registeredById = saleData.registeredById || req.userId || undefined;
    
    const sale = await prisma.sale.create({
      data: {
        ...saleData,
        accountId,
        originalSalePrice: originalSalePrice ?? undefined, // Salvar o preço pretendido original
        profit,
        profitPercent: parseFloat(profitPercent.toFixed(2)),
        registeredById,
        commissionAmount: commissionAmount ?? undefined,
      },
      include: {
        vehicle: true,
        client: true,
        registeredBy: { select: { id: true, name: true } },
      },
    });

    // Atualizar veículo: status sold e salePrice
    await prisma.vehicle.updateMany({
      where: {
        id: saleData.vehicleId,
        accountId,
      },
      data: {
        status: 'sold',
        salePrice: saleData.salePrice,
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
      registeredById?: string;
      updatedAt: Date;
    } = {
      ...saleData,
      updatedAt: new Date(),
    };

    // Recalcular lucro se o preço ou veículo mudar
    if (saleData.salePrice !== undefined || saleData.vehicleId !== undefined) {
      const sale = await prisma.sale.findFirst({
        where: { id, accountId },
        include: { vehicle: true },
      });

      if (sale) {
        // Usar o vehicleId novo se foi alterado, senão usar o atual
        const vehicleIdToUse = saleData.vehicleId || sale.vehicleId;
        
        // Buscar despesas do veículo
        const expenses = await prisma.expense.findMany({
          where: {
            vehicleId: vehicleIdToUse,
            accountId,
            deletedAt: null,
          },
          select: {
            value: true,
          },
        });

        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.value, 0);
        
        // Buscar o veículo correto (novo ou atual)
        const vehicle = saleData.vehicleId 
          ? await prisma.vehicle.findFirst({
              where: { id: saleData.vehicleId, accountId, deletedAt: null },
            })
          : sale.vehicle;
        
        const purchasePrice = vehicle?.purchasePrice ?? 0;
        const totalCost = purchasePrice + totalExpenses;
        const salePriceToUse = saleData.salePrice ?? sale.salePrice;
        updatePayload.profit = salePriceToUse - totalCost;
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
        registeredBy: { select: { id: true, name: true } },
      },
    });

    // Atualizar salePrice do veículo se o preço da venda foi alterado
    if (updatedSale && (saleData.salePrice !== undefined || saleData.vehicleId !== undefined)) {
      const vehicleIdToUpdate = saleData.vehicleId || updatedSale.vehicleId;
      
      // Buscar a venda mais recente do veículo para atualizar o salePrice
      const latestSale = await prisma.sale.findFirst({
        where: {
          vehicleId: vehicleIdToUpdate,
          accountId,
          deletedAt: null,
        },
        orderBy: { saleDate: 'desc' },
        select: { salePrice: true },
      });

      await prisma.vehicle.updateMany({
        where: {
          id: vehicleIdToUpdate,
          accountId,
        },
        data: {
          salePrice: latestSale?.salePrice ?? null,
          updatedAt: new Date(),
        },
      });
    }

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

    // Buscar a venda que está sendo deletada ANTES do soft delete para obter o originalSalePrice
    const saleToDelete = await prisma.sale.findFirst({
      where: {
        id,
        accountId,
        deletedAt: null,
      },
      select: {
        vehicleId: true,
        originalSalePrice: true,
      },
    });

    if (!saleToDelete) {
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

    // Verificar se há outras vendas ativas para o veículo
    const otherSales = await prisma.sale.findFirst({
      where: {
        vehicleId: saleToDelete.vehicleId,
        accountId,
        id: { not: id }, // Excluir a venda atual
        deletedAt: null,
      },
      orderBy: { saleDate: 'desc' },
      select: { salePrice: true },
    });

    // Se não há outras vendas ativas, restaurar o originalSalePrice (preço pretendido)
    // Se há outras vendas, usar o salePrice da venda mais recente
    const salePriceToRestore = otherSales 
      ? otherSales.salePrice 
      : (saleToDelete.originalSalePrice ?? null);

    // Voltar o veículo para estoque e restaurar salePrice
    await prisma.vehicle.updateMany({
      where: {
        id: saleToDelete.vehicleId,
        accountId,
      },
      data: {
        status: otherSales ? 'sold' : 'available',
        salePrice: salePriceToRestore,
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

function saleMonthKeyBrazil(saleDate: Date): string {
  const br = getBrazilDateParts(saleDate);
  return `${br.year}-${String(br.month).padStart(2, '0')}`;
}

export const getSalesByMonth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { months = '6' } = req.query;
    const monthsCount = Math.min(24, Math.max(1, parseInt(months as string, 10) || 6));
    const brNow = getBrazilDateParts(new Date());
    let startYear = brNow.year;
    let startMonth = brNow.month - monthsCount;
    if (startMonth < 1) {
      startMonth += 12;
      startYear -= 1;
    }
    const startDate = getBrazilMonthRange(startYear, startMonth).start;
    const endDate = getBrazilMonthRange(brNow.year, brNow.month).end;

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

    // Agrupar por mês (fuso Brasil)
    const byMonth = new Map<string, { sales: number; revenue: number; profit: number }>();
    for (let i = 0; i < monthsCount; i++) {
      let m = startMonth + i;
      let y = startYear;
      if (m > 12) {
        m -= 12;
        y += 1;
      }
      const key = `${y}-${String(m).padStart(2, '0')}`;
      byMonth.set(key, { sales: 0, revenue: 0, profit: 0 });
    }

    sales.forEach((sale) => {
      const key = saleMonthKeyBrazil(sale.saleDate);
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
