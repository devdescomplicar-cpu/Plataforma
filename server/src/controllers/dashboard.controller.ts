import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { getPublicImageUrl } from '../services/minio.service.js';
import { getDateRange } from '../utils/date-range.js';
import { getBrazilDateParts, getBrazilMonthRange, daysDifferenceBrazil } from '../utils/timezone.js';

function saleDateKeyBrazil(saleDate: Date): string {
  const br = getBrazilDateParts(saleDate);
  return `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
}
function saleMonthKeyBrazil(saleDate: Date): string {
  const br = getBrazilDateParts(saleDate);
  return `${br.year}-${String(br.month).padStart(2, '0')}`;
}

export const getDashboardMetrics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId } = req;
    const { month, year } = req.query;

    const br = getBrazilDateParts(new Date());
    const useMonth = month && year
      ? parseInt(month as string)
      : br.month;
    const useYear = month && year
      ? parseInt(year as string)
      : br.year;
    const { start: startDate, end: endDate } = getBrazilMonthRange(useYear, useMonth);

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

    // Calcular tempo médio em estoque (apenas datas, ignorando horário)
    const daysInStockArray = avgDaysInStock.map((sale) => {
      const days = daysDifferenceBrazil(sale.vehicle.createdAt, sale.saleDate);
      return days;
    });
    const avgDays = daysInStockArray.length > 0
      ? Math.round(daysInStockArray.reduce((a, b) => a + b, 0) / daysInStockArray.length)
      : 0;

    const monthlyProfit = req.collaboratorRole === 'seller' ? 0 : (totalProfit._sum.profit || 0);
    res.json({
      success: true,
      data: {
        vehiclesInStock: vehiclesCount,
        monthlySales: salesCount,
        monthlyProfit,
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

    // Calcular dias em estoque considerando apenas a data (dia/mês/ano), ignorando horário
    // Para veículos vendidos, usar data de venda; para em estoque, usar data atual
    const vehiclesWithCalculations = await Promise.all(
      vehicles.map(async (vehicle) => {
        // Buscar venda do veículo para obter data de venda (se vendido)
        const sale = await prisma.sale.findFirst({
          where: {
            vehicleId: vehicle.id,
            accountId,
            deletedAt: null,
          },
          orderBy: { saleDate: 'desc' },
          select: { saleDate: true },
        });

        // Calcular dias em estoque:
        // - Se vendido: data de entrada até data de venda
        // - Se ainda em estoque: data de entrada até hoje
        const daysInStock = sale?.saleDate
          ? daysDifferenceBrazil(vehicle.createdAt, sale.saleDate)
          : daysDifferenceBrazil(vehicle.createdAt);
        const purchasePrice = vehicle.purchasePrice ?? 0;
        const salePrice = vehicle.salePrice ?? 0;
        const profit = salePrice - purchasePrice;
        const profitPercent = purchasePrice > 0 ? (profit / purchasePrice) * 100 : 0;
        const isSeller = req.collaboratorRole === 'seller';

        return {
          ...vehicle,
          purchasePrice: isSeller ? undefined : vehicle.purchasePrice,
          daysInStock,
          profit: isSeller ? undefined : profit,
          profitPercent: isSeller ? undefined : parseFloat(profitPercent.toFixed(2)),
          image: vehicle.images && vehicle.images[0] && vehicle.images[0].key 
            ? getPublicImageUrl(vehicle.images[0].key) 
            : null,
        };
      })
    );

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

    // Dados dia a dia (datas no fuso Brasil): sempre mostrar todos os dias do mês selecionado
    // Para visualização "Dia", sempre usar o mês mais recente do período (último mês)
    const endBr = getBrazilDateParts(end);
    // Sempre usar o mês do fim do período (último mês) para mostrar todos os dias
    const { start: monthStart, end: monthEnd } = getBrazilMonthRange(endBr.year, endBr.month);
    const chartStart = monthStart;
    const chartEnd = monthEnd;

    const dailyData = new Map<string, { date: string; revenue: number; sales: number; profit: number }>();
    let t = chartStart.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    while (t <= chartEnd.getTime()) {
      const br = getBrazilDateParts(new Date(t));
      const key = `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
      dailyData.set(key, {
        date: `${String(br.day).padStart(2, '0')}/${String(br.month).padStart(2, '0')}`,
        revenue: 0,
        sales: 0,
        profit: 0,
      });
      t += dayMs;
    }

    sales.forEach((s) => {
      const key = saleDateKeyBrazil(s.saleDate);
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

    // Dados mensais (fuso Brasil): últimos 6 meses para gráficos em visualização "Mês"
    const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthlyData = new Map<string, { date: string; monthKey: string; revenue: number; sales: number; profit: number }>();
    const brNow = getBrazilDateParts(new Date());
    for (let i = 5; i >= 0; i--) {
      let month = brNow.month - i;
      let year = brNow.year;
      if (month < 1) {
        month += 12;
        year -= 1;
      }
      const key = `${year}-${String(month).padStart(2, '0')}`;
      monthlyData.set(key, {
        date: MONTH_SHORT[month - 1],
        monthKey: key,
        revenue: 0,
        sales: 0,
        profit: 0,
      });
    }
    sales.forEach((s) => {
      const key = saleMonthKeyBrazil(s.saleDate);
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

    // Cliente destaque: quem mais comprou veículos no período (desempate por valor total)
    const topClientMap = new Map<string, { name: string; count: number; revenue: number }>();
    sales.forEach((s) => {
      if (s.clientId && s.client) {
        const current = topClientMap.get(s.clientId) || { name: s.client.name, count: 0, revenue: 0 };
        current.count += 1;
        current.revenue += s.salePrice;
        topClientMap.set(s.clientId, current);
      }
    });
    const topClient = Array.from(topClientMap.values())
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)[0] || null;

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

    const isSeller = req.collaboratorRole === 'seller';
    const dailyChartForResponse = isSeller
      ? dailyChart.map((d) => ({ ...d, profit: 0 }))
      : dailyChart;
    const monthlyChartForResponse = isSeller
      ? monthlyChart.map((m) => ({ ...m, profit: 0 }))
      : monthlyChart;

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
            value: isSeller ? 0 : Math.round(totalProfit),
            change: isSeller ? 0 : parseFloat(profitChange.toFixed(1)),
          },
          avgTicket: {
            value: Math.round(avgTicket),
          },
        },
        dailyChart: dailyChartForResponse,
        monthlyChart: monthlyChartForResponse,
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
