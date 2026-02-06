import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { getPublicImageUrl } from '../services/minio.service.js';
import { getDateRange } from '../utils/date-range.js';
import { getBrazilDateParts, getBrazilMonthRange, daysDifferenceBrazil, getLastDayOfMonth } from '../utils/timezone.js';

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
    const period = req.query.period as string | undefined;
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    
    // Se não tiver período mas tiver datas, usar as datas. Caso contrário, usar período padrão
    const periodToUse = (!startDate || !endDate) && !period ? 'current-month' : period;
    const { start, end } = getDateRange(periodToUse, startDate, endDate);

    // Calcular período anterior para comparação
    const daysDiff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - daysDiff - 1);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevEnd.setHours(23, 59, 59, 999);

    // Se for vendedor, filtrar apenas vendas dele. Se for dono/gerente, mostrar todas
    const isSeller = req.collaboratorRole === 'seller';
    const baseWhere: any = {
      accountId,
      deletedAt: null,
      saleDate: { gte: start, lte: end },
    };
    
    if (isSeller && req.userId) {
      baseWhere.registeredById = req.userId;
    }

    // Buscar vendas do período atual
    const sales = await prisma.sale.findMany({
      where: baseWhere,
      select: {
        id: true,
        salePrice: true,
        profit: true,
        commissionAmount: true,
        saleDate: true,
        clientId: true,
        vehicleId: true,
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

    // Buscar vendas do período anterior (mesmo filtro de vendedor)
    const prevSalesWhere: any = {
      accountId,
      deletedAt: null,
      saleDate: { gte: prevStart, lte: prevEnd },
    };
    
    if (isSeller && req.userId) {
      prevSalesWhere.registeredById = req.userId;
    }
    
    const prevSales = await prisma.sale.findMany({
      where: prevSalesWhere,
      select: {
        salePrice: true,
        profit: true,
        commissionAmount: true,
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

    // Lucro líquido (para vendedor, usar commissionAmount ao invés de profit)
    const totalProfit = isSeller
      ? sales.reduce((acc, s) => acc + (s.commissionAmount ?? 0), 0)
      : sales.reduce((acc, s) => acc + s.profit, 0);
    const prevProfit = isSeller
      ? prevSales.reduce((acc, s) => acc + (s.commissionAmount ?? 0), 0)
      : prevSales.reduce((acc, s) => acc + s.profit, 0);
    const profitChange = prevProfit !== 0 ? ((totalProfit - prevProfit) / Math.abs(prevProfit)) * 100 : (totalProfit > 0 ? 100 : 0);

    // Ticket médio
    const avgTicket = vehiclesSold > 0 ? totalRevenue / vehiclesSold : 0;

    // Determinar se o período é de 1 mês ou múltiplos meses
    const startBr = getBrazilDateParts(start);
    const endBr = getBrazilDateParts(end);
    
    // Se for período customizado, verificar se está dentro do mesmo mês
    let isSingleMonthPeriod = false;
    const isCustomPeriod = (!periodToUse || periodToUse === 'custom') && startDate && endDate;
    if (isCustomPeriod) {
      // Verificar se start e end estão no mesmo mês e ano
      isSingleMonthPeriod = startBr.year === endBr.year && startBr.month === endBr.month;
    } else {
      // Para períodos predefinidos
      isSingleMonthPeriod = periodToUse === 'current-month' || periodToUse === 'last-month';
    }

    // Dados dia a dia (datas no fuso Brasil): mostrar todos os dias do mês quando for 1 mês
    let chartStart: Date;
    let chartEnd: Date;
    
    if (isSingleMonthPeriod) {
      // Se for 1 mês, mostrar todos os dias do mês (do dia 1 até o último dia)
      const { start: monthStart, end: monthEnd } = getBrazilMonthRange(endBr.year, endBr.month);
      chartStart = monthStart;
      chartEnd = monthEnd;
    } else {
      // Se for múltiplos meses, usar o período completo
      chartStart = start;
      chartEnd = end;
    }

    const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dailyData = new Map<string, { date: string; tooltipDate: string; revenue: number; sales: number; profit: number }>();
    let t = chartStart.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    while (t <= chartEnd.getTime()) {
      const br = getBrazilDateParts(new Date(t));
      const key = `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
      dailyData.set(key, {
        date: `${String(br.day).padStart(2, '0')}/${String(br.month).padStart(2, '0')}`,
        tooltipDate: `${String(br.day).padStart(2, '0')} ${MONTH_SHORT[br.month - 1]}, ${br.year}`,
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
        entry.profit += isSeller ? (s.commissionAmount ?? 0) : s.profit;
      }
    });

    const dailyChart = Array.from(dailyData.values()).sort((a, b) => {
      const [dayA, monthA] = a.date.split('/').map(Number);
      const [dayB, monthB] = b.date.split('/').map(Number);
      if (monthA !== monthB) return monthA - monthB;
      return dayA - dayB;
    });

    // Dados mensais (fuso Brasil): quando for múltiplos meses, mostrar mês a mês do período
    const monthlyData = new Map<string, { date: string; tooltipDate: string; monthKey: string; revenue: number; sales: number; profit: number; showLabel: boolean; showTick: boolean }>();
    
    if (!isSingleMonthPeriod) {
      // Calcular todos os meses entre start e end
      let currentYear = startBr.year;
      let currentMonth = startBr.month;
      const endYear = endBr.year;
      const endMonth = endBr.month;
      
      // Contar total de meses
      let totalMonths = 0;
      let tempYear = startBr.year;
      let tempMonth = startBr.month;
      while (tempYear < endYear || (tempYear === endYear && tempMonth <= endMonth)) {
        totalMonths++;
        tempMonth++;
        if (tempMonth > 12) {
          tempMonth = 1;
          tempYear++;
        }
      }
      
      // Determinar intervalo de exibição baseado no total de meses
      let labelInterval = 1; // Padrão: mostrar todos
      let labelFormat: 'month' | 'year' = 'month';
      
      if (totalMonths <= 6) {
        labelInterval = 1; // Mostrar todos
      } else if (totalMonths <= 12) {
        labelInterval = 2; // Mês sim, mês não (pular 1)
      } else if (totalMonths <= 24) {
        labelInterval = 3; // A cada 3 meses (pular 2)
      } else {
        labelInterval = 1; // Por ano
        labelFormat = 'year';
      }
      
      let monthIndex = 0;
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        
        // Determinar se deve mostrar o label e o tick
        let showLabel = false;
        let showTick = false;
        if (labelFormat === 'year') {
          // Mostrar apenas no primeiro mês de cada ano
          showLabel = currentMonth === 1;
          showTick = showLabel; // Tick apenas onde há label
          if (showLabel) {
            // Usar formato de ano no label
            monthlyData.set(key, {
              date: `${currentYear}`,
              tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
              monthKey: key,
              revenue: 0,
              sales: 0,
              profit: 0,
              showLabel: true,
              showTick: true,
            });
          } else {
            monthlyData.set(key, {
              date: `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
              tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
              monthKey: key,
              revenue: 0,
              sales: 0,
              profit: 0,
              showLabel: false,
              showTick: false,
            });
          }
        } else {
          // Mostrar baseado no intervalo
          showLabel = monthIndex % labelInterval === 0;
          showTick = showLabel; // Tick apenas onde há label
          monthlyData.set(key, {
            date: `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
            tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
            monthKey: key,
            revenue: 0,
            sales: 0,
            profit: 0,
            showLabel,
            showTick,
          });
        }
        
        monthIndex++;
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    }
    
    sales.forEach((s) => {
      const key = saleMonthKeyBrazil(s.saleDate);
      const entry = monthlyData.get(key);
      if (entry) {
        entry.revenue += s.salePrice;
        entry.sales += 1;
        entry.profit += isSeller ? (s.commissionAmount ?? 0) : s.profit;
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

    // Determinar qual tipo de gráfico usar
    const chartData = isSingleMonthPeriod ? dailyChart : monthlyChart;
    const chartType = isSingleMonthPeriod ? 'day' : 'month';

    res.json({
      success: true,
      data: {
        chartType, // 'day' ou 'month'
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
        chart: chartData, // Dados do gráfico (diário ou mensal)
        dailyChart: dailyChart, // Manter para compatibilidade
        monthlyChart: monthlyChart, // Manter para compatibilidade
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
