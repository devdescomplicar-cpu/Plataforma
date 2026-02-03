import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { prisma } from '../services/prisma.service.js';

function getDateRange(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  // Se tiver datas personalizadas, usar elas
  if (startDate && endDate) {
    return {
      start: new Date(startDate),
      end: new Date(endDate),
    };
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
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 6);
  }
  return { start, end };
}

const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
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
    const daysInStockArray: number[] = [];
    sales.forEach((s) => {
      if (s.vehicle?.createdAt) {
        const daysInStock = Math.floor(
          (s.saleDate.getTime() - s.vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        daysInStockArray.push(daysInStock);
      }
    });
    const avgDaysInStock = daysInStockArray.length > 0
      ? Math.round(daysInStockArray.reduce((sum, d) => sum + d, 0) / daysInStockArray.length)
      : 0;

    // Dados mensais: vendas, lucro, faturamento, tempo médio em estoque
    // Sempre incluir os últimos 7 meses (mês atual + 6 anteriores) para os gráficos
    const byMonth = new Map<string, { vendas: number; lucro: number; faturamento: number; daysInStock: number[] }>();
    const today = new Date();
    const chartStart = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const chartEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    
    // Inicializar todos os meses dos últimos 7 meses
    const d = new Date(chartStart);
    while (d <= chartEnd) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, { vendas: 0, lucro: 0, faturamento: 0, daysInStock: [] });
      d.setMonth(d.getMonth() + 1);
    }
    
    // Buscar TODAS as vendas dos últimos 7 meses para os gráficos (não apenas as do período filtrado)
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
    
    // Preencher dados mensais com todas as vendas dos últimos 7 meses
    for (const s of allSalesForCharts) {
      const key = `${s.saleDate.getFullYear()}-${String(s.saleDate.getMonth() + 1).padStart(2, '0')}`;
      const cur = byMonth.get(key);
      if (cur) {
        cur.vendas += 1;
        cur.lucro += s.profit;
        cur.faturamento += s.salePrice;
        
        // Calcular dias em estoque
        if (s.vehicle?.createdAt) {
          const daysInStock = Math.floor(
            (s.saleDate.getTime() - s.vehicle.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          cur.daysInStock.push(daysInStock);
        }
      }
    }
    
    const vendasMensais = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => {
        const [y, m] = key.split('-');
        const avgDaysInStock = v.daysInStock.length > 0
          ? Math.round(v.daysInStock.reduce((sum, d) => sum + d, 0) / v.daysInStock.length)
          : 0;
        return {
          month: MONTH_NAMES[parseInt(m, 10) - 1],
          vendas: v.vendas,
          lucro: Math.round(v.lucro),
          faturamento: Math.round(v.faturamento),
          tempoMedioEstoque: avgDaysInStock,
        };
      });

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
      },
    });
  } catch (error) {
    next(error);
  }
};
