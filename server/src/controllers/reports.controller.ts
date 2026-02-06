import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';
import { getDateRange } from '../utils/date-range.js';
import { getBrazilDateParts, getLastDayOfMonth, startOfDayBrazil, endOfDayBrazil, daysDifferenceBrazil, getBrazilMonthRange } from '../utils/timezone.js';

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function saleDateKeyBrazil(saleDate: Date): string {
  const br = getBrazilDateParts(saleDate);
  return `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
}

/** Relatório limitado do vendedor: vendas, comissão, evolução mensal; sem custos/lucro. */
export const getReportsSeller = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { accountId, userId } = req;
    if (!userId) {
      res.status(401).json({ success: false, error: { message: 'Não autenticado' } });
      return;
    }
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const { start, end } = getDateRange(period, startDate, endDate);

    const sales = await prisma.sale.findMany({
      where: {
        accountId,
        registeredById: userId,
        deletedAt: null,
        saleDate: { gte: start, lte: end },
      },
      include: {
        vehicle: {
          select: { id: true, brand: true, model: true, version: true, year: true },
        },
        client: { select: { id: true, name: true } },
      },
      orderBy: { saleDate: 'desc' },
    });

    const totalCommission = sales.reduce((acc, s) => acc + (s.commissionAmount ?? 0), 0);
    const totalVendido = sales.reduce((acc, s) => acc + s.salePrice, 0);

    // Últimos 7 meses (fuso Brasil) para gráfico de evolução de comissão
    const brNow = getBrazilDateParts(new Date());
    const byMonth = new Map<string, { vendas: number; faturamento: number; comissao: number }>();
    for (let i = 6; i >= 0; i--) {
      let month = brNow.month - i;
      let year = brNow.year;
      if (month < 1) {
        month += 12;
        year -= 1;
      }
      const key = `${year}-${String(month).padStart(2, '0')}`;
      byMonth.set(key, { vendas: 0, faturamento: 0, comissao: 0 });
    }
    const firstMonth = brNow.month - 6 >= 1 ? brNow.month - 6 : brNow.month - 6 + 12;
    const firstYear = brNow.month - 6 >= 1 ? brNow.year : brNow.year - 1;
    const chartStart = startOfDayBrazil(firstYear, firstMonth, 1);
    const lastDay = getLastDayOfMonth(brNow.year, brNow.month);
    const chartEnd = endOfDayBrazil(brNow.year, brNow.month, lastDay);

    const salesForCharts = await prisma.sale.findMany({
      where: {
        accountId,
        registeredById: userId,
        deletedAt: null,
        saleDate: { gte: chartStart, lte: chartEnd },
      },
      select: { saleDate: true, salePrice: true, commissionAmount: true },
    });

    for (const s of salesForCharts) {
      const key = saleMonthKeyBrazil(s.saleDate);
      const cur = byMonth.get(key);
      if (cur) {
        cur.vendas += 1;
        cur.faturamento += s.salePrice;
        cur.comissao += s.commissionAmount ?? 0;
      }
    }

    const comissaoMensais = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [, m] = key.split('-');
        return {
          month: MONTH_NAMES[parseInt(m, 10) - 1],
          vendas: v.vendas,
          faturamento: Math.round(v.faturamento),
          comissao: Math.round(v.comissao * 100) / 100,
        };
      });

    res.json({
      success: true,
      data: {
        summary: {
          veiculosVendidos: sales.length,
          totalVendido: Math.round(totalVendido * 100) / 100,
          totalComissaoReceber: Math.round(totalCommission * 100) / 100,
        },
        comissaoMensais,
        vendas: sales.map((s) => ({
          id: s.id,
          saleDate: s.saleDate,
          salePrice: s.salePrice,
          commissionAmount: s.commissionAmount,
          vehicle: s.vehicle ? `${s.vehicle.brand} ${s.vehicle.model}${s.vehicle.version ? ` ${s.vehicle.version}` : ''} ${s.vehicle.year}`.trim() : null,
          clientName: s.client?.name ?? null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};

/** Lista colaboradores com métricas de vendas e comissão (apenas dono). */
export const getReportsCollaborators = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.isAccountOwner) {
      res.status(403).json({ success: false, error: { message: 'Apenas o dono da conta pode ver esta seção.' } });
      return;
    }
    const accountId = req.accountId!;
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const { start, end } = getDateRange(period, startDate, endDate);

    const collaborators = await prisma.accountCollaborator.findMany({
      where: { accountId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const stats = await Promise.all(
      collaborators.map(async (c) => {
        const sales = await prisma.sale.findMany({
          where: {
            accountId,
            registeredById: c.userId,
            deletedAt: null,
            saleDate: { gte: start, lte: end },
          },
          select: { id: true, salePrice: true, commissionAmount: true },
        });
        const totalSold = sales.reduce((acc, s) => acc + s.salePrice, 0);
        const totalCommission = sales.reduce((acc, s) => acc + (s.commissionAmount ?? 0), 0);
        return {
          userId: c.userId,
          name: c.user.name,
          email: c.user.email,
          role: c.role,
          status: c.status,
          vendasCount: sales.length,
          totalVendido: Math.round(totalSold * 100) / 100,
          totalComissao: Math.round(totalCommission * 100) / 100,
        };
      })
    );

    res.json({ success: true, data: stats });
  } catch (e) {
    next(e);
  }
};

/** Relatório individual de um colaborador (apenas dono). */
export const getReportsCollaboratorById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.isAccountOwner) {
      res.status(403).json({ success: false, error: { message: 'Apenas o dono da conta pode ver este relatório.' } });
      return;
    }
    const accountId = req.accountId!;
    const userId = req.params.userId;
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const { start, end } = getDateRange(period, startDate, endDate);

    const collaborator = await prisma.accountCollaborator.findFirst({
      where: { accountId, userId, deletedAt: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!collaborator) {
      res.status(404).json({ success: false, error: { message: 'Colaborador não encontrado' } });
      return;
    }

    const sales = await prisma.sale.findMany({
      where: {
        accountId,
        registeredById: userId,
        deletedAt: null,
        saleDate: { gte: start, lte: end },
      },
      include: {
        vehicle: { select: { id: true, brand: true, model: true, version: true, year: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { saleDate: 'desc' },
    });

    const totalCommission = sales.reduce((acc, s) => acc + (s.commissionAmount ?? 0), 0);
    const totalVendido = sales.reduce((a, s) => a + s.salePrice, 0);

    // Últimos 7 meses para gráfico de evolução de comissão (igual ao relatório do vendedor)
    const brNow = getBrazilDateParts(new Date());
    const byMonth = new Map<string, { vendas: number; faturamento: number; comissao: number }>();
    for (let i = 6; i >= 0; i--) {
      let month = brNow.month - i;
      let year = brNow.year;
      if (month < 1) {
        month += 12;
        year -= 1;
      }
      const key = `${year}-${String(month).padStart(2, '0')}`;
      byMonth.set(key, { vendas: 0, faturamento: 0, comissao: 0 });
    }
    const firstMonth = brNow.month - 6 >= 1 ? brNow.month - 6 : brNow.month - 6 + 12;
    const firstYear = brNow.month - 6 >= 1 ? brNow.year : brNow.year - 1;
    const chartStart = startOfDayBrazil(firstYear, firstMonth, 1);
    const lastDay = getLastDayOfMonth(brNow.year, brNow.month);
    const chartEnd = endOfDayBrazil(brNow.year, brNow.month, lastDay);

    const salesForCharts = await prisma.sale.findMany({
      where: {
        accountId,
        registeredById: userId,
        deletedAt: null,
        saleDate: { gte: chartStart, lte: chartEnd },
      },
      select: { saleDate: true, salePrice: true, commissionAmount: true },
    });

    for (const s of salesForCharts) {
      const key = saleMonthKeyBrazil(s.saleDate);
      const cur = byMonth.get(key);
      if (cur) {
        cur.vendas += 1;
        cur.faturamento += s.salePrice;
        cur.comissao += s.commissionAmount ?? 0;
      }
    }

    const comissaoMensais = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [, m] = key.split('-');
        return {
          month: MONTH_NAMES[parseInt(m, 10) - 1],
          vendas: v.vendas,
          faturamento: Math.round(v.faturamento),
          comissao: Math.round(v.comissao * 100) / 100,
        };
      });

    res.json({
      success: true,
      data: {
        collaborator: {
          userId: collaborator.userId,
          name: collaborator.user.name,
          email: collaborator.user.email,
          role: collaborator.role,
        },
        summary: {
          veiculosVendidos: sales.length,
          totalVendido: Math.round(totalVendido * 100) / 100,
          totalComissao: Math.round(totalCommission * 100) / 100,
        },
        comissaoMensais,
        vendas: sales.map((s) => ({
          id: s.id,
          saleDate: s.saleDate,
          salePrice: s.salePrice,
          commissionAmount: s.commissionAmount,
          vehicle: s.vehicle ? `${s.vehicle.brand} ${s.vehicle.model}${s.vehicle.version ? ` ${s.vehicle.version}` : ''} ${s.vehicle.year}`.trim() : null,
          clientName: s.client?.name ?? null,
        })),
      },
    });
  } catch (e) {
    next(e);
  }
};

function saleMonthKeyBrazil(saleDate: Date): string {
  const br = getBrazilDateParts(saleDate);
  return `${br.year}-${String(br.month).padStart(2, '0')}`;
}
const CATEGORY_COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(160, 65%, 40%)',
  'hsl(38, 92%, 50%)',
  'hsl(0, 72%, 51%)',
  'hsl(280, 70%, 55%)',
  'hsl(200, 80%, 55%)',
];

export const getReports = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.collaboratorRole === 'seller') {
      return getReportsSeller(req, res, next);
    }
    const { accountId } = req;
    const period = req.query.period as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;
    const { start, end } = getDateRange(period, startDate, endDate);

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
            version: true,
            year: true,
            createdAt: true,
            purchasePrice: true,
          } 
        },
        client: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { saleDate: 'asc' },
    });

    const totalRevenue = sales.reduce((acc, s) => acc + s.salePrice, 0);
    const totalProfit = sales.reduce((acc, s) => acc + s.profit, 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    // Clientes recorrentes (2+ compras no período)
    const clientPurchaseCount = new Map<string, number>();
    sales.forEach((s) => {
      if (s.clientId) {
        clientPurchaseCount.set(s.clientId, (clientPurchaseCount.get(s.clientId) || 0) + 1);
      }
    });
    const recurringClients = Array.from(clientPurchaseCount.values()).filter(count => count >= 2).length;

    // Tempo médio em estoque (apenas vendas no período filtrado)
    // Calcular considerando apenas datas (dia/mês/ano), ignorando horário
    const daysInStockArray: number[] = [];
    sales.forEach((s) => {
      if (s.vehicle?.createdAt) {
        // Calcular diferença entre data de criação e data de venda (apenas datas)
        const daysInStock = daysDifferenceBrazil(s.vehicle.createdAt, s.saleDate);
        daysInStockArray.push(daysInStock);
      }
    });
    const avgDaysInStock = daysInStockArray.length > 0
      ? Math.round(daysInStockArray.reduce((sum, d) => sum + d, 0) / daysInStockArray.length)
      : 0;

    // Determinar se deve mostrar dia a dia ou mês a mês baseado no período
    const startBr = getBrazilDateParts(start);
    const endBr = getBrazilDateParts(end);
    let isSingleMonthPeriod = false;
    const isCustomPeriod = (!period || period === 'custom') && startDate && endDate;
    if (isCustomPeriod) {
      isSingleMonthPeriod = startBr.year === endBr.year && startBr.month === endBr.month;
    } else {
      isSingleMonthPeriod = period === 'current-month' || period === 'last-month';
    }

    // Dados dia a dia (quando for 1 mês)
    const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dailyData = new Map<string, { date: string; tooltipDate: string; vendas: number; lucro: number; faturamento: number; daysInStock: number[] }>();
    
    let chartStart: Date;
    let chartEnd: Date;
    
    if (isSingleMonthPeriod) {
      const { start: monthStart, end: monthEnd } = getBrazilMonthRange(endBr.year, endBr.month);
      chartStart = monthStart;
      chartEnd = monthEnd;
    } else {
      chartStart = start;
      chartEnd = end;
    }

    if (isSingleMonthPeriod) {
      let t = chartStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      while (t <= chartEnd.getTime()) {
        const br = getBrazilDateParts(new Date(t));
        const key = `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
        dailyData.set(key, {
          date: `${String(br.day).padStart(2, '0')}/${String(br.month).padStart(2, '0')}`,
          tooltipDate: `${String(br.day).padStart(2, '0')} ${MONTH_SHORT[br.month - 1]}, ${br.year}`,
          vendas: 0,
          lucro: 0,
          faturamento: 0,
          daysInStock: [],
        });
        t += dayMs;
      }
    }

    // Dados mensais (quando for múltiplos meses)
    const monthlyData = new Map<string, { date: string; tooltipDate: string; monthKey: string; vendas: number; lucro: number; faturamento: number; daysInStock: number[]; showLabel: boolean; showTick: boolean }>();
    
    if (!isSingleMonthPeriod) {
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
      let labelInterval = 1;
      let labelFormat: 'month' | 'year' = 'month';
      
      if (totalMonths <= 6) {
        labelInterval = 1;
      } else if (totalMonths <= 12) {
        labelInterval = 2;
      } else if (totalMonths <= 24) {
        labelInterval = 3;
      } else {
        labelInterval = 1;
        labelFormat = 'year';
      }
      
      let monthIndex = 0;
      while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
        const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        
        let showLabel = false;
        let showTick = false;
        if (labelFormat === 'year') {
          showLabel = currentMonth === 1;
          showTick = showLabel;
          if (showLabel) {
            monthlyData.set(key, {
              date: `${currentYear}`,
              tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
              monthKey: key,
              vendas: 0,
              lucro: 0,
              faturamento: 0,
              daysInStock: [],
              showLabel: true,
              showTick: true,
            });
          } else {
            monthlyData.set(key, {
              date: `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
              tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
              monthKey: key,
              vendas: 0,
              lucro: 0,
              faturamento: 0,
              daysInStock: [],
              showLabel: false,
              showTick: false,
            });
          }
        } else {
          showLabel = monthIndex % labelInterval === 0;
          showTick = showLabel;
          monthlyData.set(key, {
            date: `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
            tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
            monthKey: key,
            vendas: 0,
            lucro: 0,
            faturamento: 0,
            daysInStock: [],
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

    // Buscar vendas do período para os gráficos
    const allSalesForCharts = await prisma.sale.findMany({
      where: {
        accountId,
        deletedAt: null,
        saleDate: { gte: chartStart, lte: chartEnd },
      },
      include: {
        vehicle: { 
          select: { 
            id: true, 
            brand: true, 
            model: true,
            version: true,
            year: true,
            createdAt: true,
            purchasePrice: true,
          } 
        },
        client: {
          select: {
            id: true,
          },
        },
      },
      orderBy: { saleDate: 'asc' },
    });
    
    // Preencher dados com as vendas
    for (const s of allSalesForCharts) {
      if (isSingleMonthPeriod) {
        const key = saleDateKeyBrazil(s.saleDate);
        const entry = dailyData.get(key);
        if (entry) {
          entry.vendas += 1;
          entry.lucro += s.profit;
          entry.faturamento += s.salePrice;
          if (s.vehicle?.createdAt) {
            const daysInStock = daysDifferenceBrazil(s.vehicle.createdAt, s.saleDate);
            entry.daysInStock.push(daysInStock);
          }
        }
      } else {
        const key = saleMonthKeyBrazil(s.saleDate);
        const entry = monthlyData.get(key);
        if (entry) {
          entry.vendas += 1;
          entry.lucro += s.profit;
          entry.faturamento += s.salePrice;
          if (s.vehicle?.createdAt) {
            const daysInStock = daysDifferenceBrazil(s.vehicle.createdAt, s.saleDate);
            entry.daysInStock.push(daysInStock);
          }
        }
      }
    }
    
    // Converter para array final
    let vendasMensais: Array<{
      month: string;
      date?: string;
      tooltipDate?: string;
      showLabel?: boolean;
      showTick?: boolean;
      vendas: number;
      lucro: number;
      faturamento: number;
      tempoMedioEstoque: number;
    }>;
    
    if (isSingleMonthPeriod) {
      vendasMensais = Array.from(dailyData.values())
        .sort((a, b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          if (monthA !== monthB) return monthA - monthB;
          return dayA - dayB;
        })
        .map((v) => ({
          month: v.date,
          date: v.date,
          tooltipDate: v.tooltipDate,
          vendas: v.vendas,
          lucro: Math.round(v.lucro),
          faturamento: Math.round(v.faturamento),
          tempoMedioEstoque: v.daysInStock.length > 0
            ? Math.round(v.daysInStock.reduce((sum, d) => sum + d, 0) / v.daysInStock.length)
            : 0,
        }));
    } else {
      vendasMensais = Array.from(monthlyData.values())
        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
        .map((v) => ({
          month: v.date,
          date: v.date,
          tooltipDate: v.tooltipDate,
          showLabel: v.showLabel,
          showTick: v.showTick,
          vendas: v.vendas,
          lucro: Math.round(v.lucro),
          faturamento: Math.round(v.faturamento),
          tempoMedioEstoque: v.daysInStock.length > 0
            ? Math.round(v.daysInStock.reduce((sum, d) => sum + d, 0) / v.daysInStock.length)
            : 0,
        }));
    }

    // Veículos mais lucrativos (por lucro total)
    const byVehicleProfit = new Map<string, { name: string; profit: number; revenue: number; sales: number }>();
    for (const s of sales) {
      const name = s.vehicle ? `${s.vehicle.brand} ${s.vehicle.model} ${s.vehicle.year || ''}`.trim() : 'Outros';
      const cur = byVehicleProfit.get(name);
      if (cur) {
        cur.profit += s.profit;
        cur.revenue += s.salePrice;
        cur.sales += 1;
      } else {
        byVehicleProfit.set(name, { name, profit: s.profit, revenue: s.salePrice, sales: 1 });
      }
    }
    const topVeiculosLucrativos = Array.from(byVehicleProfit.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5)
      .map((v) => ({
        name: v.name,
        lucro: Math.round(v.profit),
        faturamento: Math.round(v.revenue),
        margem: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 100 * 100) / 100 : 0,
        vendas: v.sales,
      }));

    // Marcas mais lucrativas
    const byBrandProfit = new Map<string, { name: string; profit: number; revenue: number }>();
    for (const s of sales) {
      const brand = s.vehicle?.brand || 'Outros';
      const cur = byBrandProfit.get(brand);
      if (cur) {
        cur.profit += s.profit;
        cur.revenue += s.salePrice;
      } else {
        byBrandProfit.set(brand, { name: brand, profit: s.profit, revenue: s.salePrice });
      }
    }
    const marcasLucrativas = Array.from(byBrandProfit.values())
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 6)
      .map((v, i) => ({
        name: v.name,
        lucro: Math.round(v.profit),
        faturamento: Math.round(v.revenue),
        margem: v.revenue > 0 ? Math.round((v.profit / v.revenue) * 100 * 100) / 100 : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));

    // Veículos em estoque há mais tempo
    const vehiclesInStock = await prisma.vehicle.findMany({
      where: {
        accountId,
        deletedAt: null,
        status: { in: ['available', 'reserved'] },
      },
      select: {
        id: true,
        brand: true,
        model: true,
        version: true,
        year: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calcular dias em estoque considerando apenas a data (dia/mês/ano), ignorando horário
    const veiculosMaisTempoEstoque = vehiclesInStock
      .map((v) => {
        const daysInStock = daysDifferenceBrazil(v.createdAt);
        const name = `${v.brand} ${v.model}${v.version ? ` ${v.version}` : ''}${v.year ? ` ${v.year}` : ''}`.trim();
        return {
          name,
          dias: daysInStock,
        };
      })
      .sort((a, b) => b.dias - a.dias)
      .slice(0, 5)
      .map((v, i) => ({
        ...v,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));

    // Veículos que venderam mais rápido (menor tempo em estoque)
    // Buscar veículos vendidos com informações completas incluindo version
    const soldVehicles = await prisma.sale.findMany({
      where: {
        accountId,
        deletedAt: null,
        saleDate: { gte: chartStart, lte: chartEnd },
      },
      include: {
        vehicle: {
          select: {
            id: true,
            brand: true,
            model: true,
            version: true,
            year: true,
            createdAt: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    // Calcular dias até venda considerando apenas a data (dia/mês/ano), ignorando horário
    const veiculosVendaRapida = soldVehicles
      .map((s) => {
        if (!s.vehicle?.createdAt) return null;
        const daysInStock = daysDifferenceBrazil(s.vehicle.createdAt, s.saleDate);
        const name = s.vehicle 
          ? `${s.vehicle.brand} ${s.vehicle.model}${s.vehicle.version ? ` ${s.vehicle.version}` : ''}${s.vehicle.year ? ` ${s.vehicle.year}` : ''}`.trim()
          : 'Outros';
        return {
          name,
          dias: daysInStock,
        };
      })
      .filter((v): v is { name: string; dias: number } => v !== null)
      .sort((a, b) => a.dias - b.dias)
      .slice(0, 5)
      .map((v, i) => ({
        ...v,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      }));

    res.json({
      success: true,
      data: {
        summary: {
          faturamentoTotal: Math.round(totalRevenue),
          lucroLiquido: Math.round(totalProfit),
          margemLucro: Math.round(profitMargin * 100) / 100,
          veiculosVendidos: sales.length,
          clientesRecorrentes: recurringClients,
          tempoMedioEstoque: avgDaysInStock,
        },
        vendasMensais,
        topVeiculosLucrativos,
        marcasLucrativas,
        veiculosMaisTempoEstoque,
        veiculosVendaRapida,
      },
    });
  } catch (error) {
    next(error);
  }
};
