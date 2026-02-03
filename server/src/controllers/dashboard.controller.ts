import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { getPublicImageUrl } from '../services/minio.service.js';

function getDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate && endDate) {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    parsedEnd.setHours(23, 59, 59, 999);
    return { start: parsedStart, end: parsedEnd };
  }

  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case 'current-month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last-month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case '3m':
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

export const getDashboardMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { month, year } = req.query;

    const startDate = month && year
      ? new Date(parseInt(year as string), parseInt(month as string) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    
    const endDate = month && year
      ? new Date(parseInt(year as string), parseInt(month as string), 0, 23, 59, 59)
      : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const [vehiclesCount, salesCount, totalProfit, avgDaysInStock] = await Promise.all([
      // Veículos em estoque
      prisma.vehicle.count({
        where: {
          accountId,
          deletedAt: null,
          status: { in: ['available', 'reserved'] },
        },
      }),
      // Vendas do mês
      prisma.sale.count({
        where: {
          accountId,
          deletedAt: null,
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      // Lucro do mês
      prisma.sale.aggregate({
        where: {
          accountId,
          deletedAt: null,
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: {
          profit: true,
        },
      }),
      // Tempo médio em estoque (veículos vendidos)
      prisma.sale.findMany({
        where: {
          accountId,
          deletedAt: null,
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          vehicle: true,
        },
      }),
    ]);

    // Calcular tempo médio em estoque
    const daysInStockArray = avgDaysInStock.map((sale) => {
      const days = Math.floor(
        (sale.saleDate.getTime() - sale.vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return days;
    });
    const avgDays = daysInStockArray.length > 0
      ? Math.round(daysInStockArray.reduce((a, b) => a + b, 0) / daysInStockArray.length)
      : 0;

    res.json({
      success: true,
      data: {
        vehiclesInStock: vehiclesCount,
        monthlySales: salesCount,
        monthlyProfit: totalProfit._sum.profit || 0,
        avgDaysInStock: avgDays,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardVehicles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const limit = parseInt(req.query.limit as string) || 10;

    const vehicles = await prisma.vehicle.findMany({
      where: {
        accountId,
        deletedAt: null,
        status: { in: ['available', 'reserved'] },
      },
      include: {
        images: {
          where: { deletedAt: null },
          orderBy: { order: 'asc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const vehiclesWithCalculations = vehicles.map((vehicle) => {
      const daysInStock = Math.floor(
        (Date.now() - vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const purchasePrice = vehicle.purchasePrice ?? 0;
      const salePrice = vehicle.salePrice ?? 0;
      const profit = salePrice - purchasePrice;
      const profitPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;

      return {
        ...vehicle,
        daysInStock,
        profit,
        profitPercent: parseFloat(profitPercent.toFixed(2)),
        image: vehicle.images[0] ? getPublicImageUrl(vehicle.images[0].key) : null,
      };
    });

    res.json({
      success: true,
      data: vehiclesWithCalculations,
    });
  } catch (error) {
    next(error);
  }
};

export const getDashboardData = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const period = req.query.period as string || 'current-month';
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const { start, end } = getDateRange(period, startDate, endDate);

    // Calcular período anterior para comparação
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff - 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    // Buscar vendas do período atual
    const sales = await prisma.sale.findMany({
      where: {
        accountId,
        deletedAt: null,
        saleDate: { gte: start, lte: end },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            year: true,
          },
        },
        client: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    // Buscar vendas do período anterior
    const prevSales = await prisma.sale.findMany({
      where: {
        accountId,
        deletedAt: null,
        saleDate: { gte: prevStart, lte: prevEnd },
      },
      select: {
        salePrice: true,
        profit: true,
      },
    });

    // Calcular faturamento
    const totalRevenue = sales.reduce((acc, s) => acc + s.salePrice, 0);
    const prevRevenue = prevSales.reduce((acc, s) => acc + s.salePrice, 0);
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Veículos vendidos
    const vehiclesSold = sales.length;
    const prevVehiclesSold = prevSales.length;
    const vehiclesSoldChange = prevVehiclesSold > 0 ? ((vehiclesSold - prevVehiclesSold) / prevVehiclesSold) * 100 : 0;
    const daysInPeriod = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const avgPerDay = vehiclesSold / daysInPeriod;

    // Lucro líquido
    const totalProfit = sales.reduce((acc, s) => acc + s.profit, 0);
    const prevProfit = prevSales.reduce((acc, s) => acc + s.profit, 0);
    const profitChange = prevProfit !== 0 ? ((totalProfit - prevProfit) / Math.abs(prevProfit)) * 100 : (totalProfit > 0 ? 100 : 0);

    // Ticket médio
    const avgTicket = vehiclesSold > 0 ? totalRevenue / vehiclesSold : 0;

    // Dados dia a dia: quando período > 30 dias, gráfico mostra apenas últimos 30 dias
    const daysInRange = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const chartStart = daysInRange > 30 ? new Date(end) : new Date(start);
    if (daysInRange > 30) {
      chartStart.setDate(chartStart.getDate() - 29);
      chartStart.setHours(0, 0, 0, 0);
    }
    const chartEnd = new Date(end);
    chartEnd.setHours(23, 59, 59, 999);

    const dailyData = new Map<string, { date: string; revenue: number; sales: number; profit: number }>();
    const d = new Date(chartStart);
    while (d <= chartEnd) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      dailyData.set(key, {
        date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        revenue: 0,
        sales: 0,
        profit: 0,
      });
      d.setDate(d.getDate() + 1);
    }

    sales.forEach((s) => {
      const key = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, '0')}-${String(s.saleDate.getDate()).padStart(2, '0')}`;
      const entry = dailyData.get(key);
      if (entry) {
        entry.revenue += s.salePrice;
        entry.sales += 1;
        entry.profit += s.profit;
      }
    });

    const dailyChart = Array.from(dailyData.values()).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/').map(Number);
      const [dayB, monthB] = b.date.split('/').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    // Dados mensais: últimos 6 meses (mês atual para trás) para gráficos em visualização "Mês"
    const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyData = new Map<string, { date: string; monthKey: string; revenue: number; sales: number; profit: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      monthlyData.set(key, {
        date: MONTH_SHORT[m.getMonth()],
        monthKey: key,
        revenue: 0,
        sales: 0,
        profit: 0,
      });
    }
    sales.forEach((s) => {
      const key = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyData.get(key);
      if (entry) {
        entry.revenue += s.salePrice;
        entry.sales += 1;
        entry.profit += s.profit;
      }
    });
    const monthlyChart = Array.from(monthlyData.values()).sort(
      (a, b) => a.monthKey.localeCompare(b.monthKey)
    );

    // Melhor dia
    const bestDay = dailyChart.reduce((best, current) => 
      current.revenue > best.revenue ? current : best,
      { date: '', revenue: 0, sales: 0 }
    );

    // Cliente destaque
    const topClientMap = new Map<string, { name: string; count: number }>();
    sales.forEach((s) => {
      if (s.clientId && s.client) {
        const current = topClientMap.get(s.clientId) || { name: s.client.name, count: 0 };
        current.count += 1;
        topClientMap.set(s.clientId, current);
      }
    });
    const topClient = Array.from(topClientMap.values())
      .sort((a, b) => b.count - a.count)[0] || null;

    // Veículo mais vendido
    const vehicleCountMap = new Map<string, number>();
    sales.forEach((s) => {
      if (s.vehicle) {
        const name = `${s.vehicle.brand} ${s.vehicle.model}`;
        vehicleCountMap.set(name, (vehicleCountMap.get(name) || 0) + 1);
      }
    });
    const topVehicle = Array.from(vehicleCountMap.entries())
      .sort((a, b) => b[1] - a[1])[0] || null;

    // Taxa de recorrência (clientes que compraram no período e já tinham comprado antes)
    const clientsInPeriod = await prisma.client.findMany({
      where: {
        accountId,
        deletedAt: null,
        sales: {
          some: {
            deletedAt: null,
            saleDate: { gte: start, lte: end },
          },
        },
      },
      include: {
        sales: {
          where: {
            deletedAt: null,
          },
          select: {
            saleDate: true,
          },
        },
      },
    });
    const totalClients = clientsInPeriod.length;
    const recurringClientsCount = clientsInPeriod.filter(c => {
      const salesInPeriod = c.sales.filter(s => s.saleDate >= start && s.saleDate <= end);
      const salesBeforePeriod = c.sales.filter(s => s.saleDate < start);
      return salesInPeriod.length > 0 && salesBeforePeriod.length > 0;
    }).length;
    const recurrenceRate = totalClients > 0 ? (recurringClientsCount / totalClients) * 100 : 0;

    // Últimas vendas (limitado a 10)
    const lastSales = sales.slice(0, 10).map((s) => ({
      id: s.id,
      date: s.saleDate.toISOString(),
      client: s.client?.name || 'Cliente não informado',
      vehicle: s.vehicle ? `${s.vehicle.brand} ${s.vehicle.model} ${s.vehicle.year}` : 'Veículo não encontrado',
      value: s.salePrice,
    }));

    res.json({
      success: true,
      data: {
        cards: {
          revenue: {
            value: Math.round(totalRevenue),
            change: parseFloat(revenueChange.toFixed(1)),
          },
          vehiclesSold: {
            count: vehiclesSold,
            avgPerDay: parseFloat(avgPerDay.toFixed(1)),
            change: parseFloat(vehiclesSoldChange.toFixed(1)),
          },
          netProfit: {
            value: Math.round(totalProfit),
            change: parseFloat(profitChange.toFixed(1)),
          },
          avgTicket: {
            value: Math.round(avgTicket),
          },
        },
        dailyChart,
        monthlyChart,
        insights: {
          bestDay: bestDay.revenue > 0 ? {
            day: bestDay.date,
            revenue: Math.round(bestDay.revenue),
          } : null,
          topClient: topClient,
          topVehicle: topVehicle ? {
            name: topVehicle[0],
            count: topVehicle[1],
          } : null,
          recurrenceRate: parseFloat(recurrenceRate.toFixed(0)),
        },
        lastSales,
      },
    });
  } catch (error) {
    next(error);
  }
};
