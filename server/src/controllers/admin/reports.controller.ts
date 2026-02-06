import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware.js';
import { prisma } from '../../services/prisma.service.js';
import { getDateRange } from '../../utils/date-range.js';
import { getBrazilDateParts, getBrazilMonthRange, startOfDayBrazil, endOfDayBrazil, getLastDayOfMonth } from '../../utils/timezone.js';

function getDateRangeOld(period?: string, startDate?: string, endDate?: string): { start: Date; end: Date } {
  if (startDate && endDate) {
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    parsedStart.setHours(0, 0, 0, 0);
    parsedEnd.setHours(23, 59, 59, 999);
    return { start: parsedStart, end: parsedEnd };
  }

  const today = new Date();
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case 'current-month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      // Para current-month, end deve ser hoje, não o último dia do mês
      end.setHours(23, 59, 59, 999);
      break;
    case 'last-month':
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth());
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case '3m':
      start.setMonth(start.getMonth() - 3);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case '6m':
      start.setMonth(start.getMonth() - 6);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
  }
  return { start, end };
}

/** General report: users, accounts, vehicles, sales, storage usage (admin). */
export async function getGeneralReport(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [
      totalUsers,
      totalAccounts,
      totalVehicles,
      totalSales,
      totalClients,
      usersByRole,
      accountsByStatus,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.account.count({ where: { deletedAt: null } }),
      prisma.vehicle.count({ where: { deletedAt: null } }),
      prisma.sale.count({ where: { deletedAt: null } }),
      prisma.client.count({ where: { deletedAt: null } }),
      prisma.user.groupBy({
        by: ['role'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
      prisma.account.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true },
      }),
    ]);

    const data = {
      totalUsers,
      totalAccounts,
      totalVehicles,
      totalSales,
      totalClients,
      usersByRole: usersByRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count.id }), {} as Record<string, number>),
      accountsByStatus: accountsByStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count.id }), {} as Record<string, number>),
      generatedAt: new Date().toISOString(),
    };
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

/** Financial reports (admin). */
export async function getFinancialReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

    // Get all active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        deletedAt: null,
        status: 'active',
      },
      include: {
        plan: {
          select: {
            price: true,
            durationType: true,
            durationMonths: true,
            name: true,
          },
        },
      },
    });

    // Calculate MRR
    let mrr = 0;
    for (const sub of subscriptions) {
      const { price, durationType, durationMonths } = sub.plan;
      if (durationType === 'monthly') {
        mrr += price;
      } else if (durationType === 'quarterly') {
        mrr += price / 3;
      } else if (durationType === 'semiannual') {
        mrr += price / 6;
      } else if (durationType === 'annual') {
        mrr += price / 12;
      } else if (durationMonths) {
        mrr += price / durationMonths;
      }
    }

    // Total revenue from subscriptions in period
    const subscriptionsInPeriod = subscriptions.filter((sub) => {
      const subStart = new Date(sub.startDate);
      return subStart >= start && subStart <= end;
    });

    let totalRevenue = 0;
    for (const sub of subscriptionsInPeriod) {
      totalRevenue += sub.plan.price;
    }

    // Active subscriptions
    const activeSubscriptions = subscriptions.length;

    // ARPU (Average Revenue Per User)
    const uniqueAccounts = new Set(subscriptions.map((s) => s.accountId));
    const arpu = uniqueAccounts.size > 0 ? mrr / uniqueAccounts.size : 0;

    // LTV calculation - média de tempo que usuários ficam ativos (em meses)
    // Calcula a diferença entre data de criação da conta e hoje (ou data de cancelamento)
    const activeAccounts = await prisma.account.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        subscriptions: {
          some: {
            deletedAt: null,
            status: 'active',
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        subscriptions: {
          where: {
            deletedAt: null,
            status: { in: ['active', 'cancelled', 'expired'] },
          },
          select: {
            startDate: true,
            endDate: true,
            status: true,
          },
          orderBy: {
            startDate: 'asc',
          },
        },
      },
    });

    let totalMonthsActive = 0;
    let activeAccountsCount = 0;

    for (const account of activeAccounts) {
      if (account.subscriptions.length === 0) continue;
      
      const firstSubscription = account.subscriptions[0];
      const lastSubscription = account.subscriptions[account.subscriptions.length - 1];
      
      const startDate = firstSubscription.startDate;
      const endDate = lastSubscription.endDate || new Date();
      
      const diffTime = endDate.getTime() - startDate.getTime();
      const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30); // Aproximação de 30 dias por mês
      
      totalMonthsActive += diffMonths;
      activeAccountsCount++;
    }

    const ltv = activeAccountsCount > 0 ? totalMonthsActive / activeAccountsCount : 0;

    // Cancelled subscriptions in period
    const cancelledSubscriptions = await prisma.subscription.count({
      where: {
        deletedAt: null,
        status: 'cancelled',
        updatedAt: { gte: start, lte: end },
      },
    });

    // Churn rate
    const churnRate = activeSubscriptions > 0 
      ? (cancelledSubscriptions / activeSubscriptions) * 100 
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

    const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const MONTH_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    
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

    // Dados dia a dia (quando for 1 mês)
    const dailyData = new Map<string, { date: string; tooltipDate: string; value: number }>();
    
    if (isSingleMonthPeriod) {
      let t = chartStart.getTime();
      const dayMs = 24 * 60 * 60 * 1000;
      while (t <= chartEnd.getTime()) {
        const br = getBrazilDateParts(new Date(t));
        const key = `${br.year}-${String(br.month).padStart(2, '0')}-${String(br.day).padStart(2, '0')}`;
        dailyData.set(key, {
          date: `${String(br.day).padStart(2, '0')}/${String(br.month).padStart(2, '0')}`,
          tooltipDate: `${String(br.day).padStart(2, '0')} ${MONTH_SHORT[br.month - 1]}, ${br.year}`,
          value: 0,
        });
        t += dayMs;
      }
    }

    // Dados mensais (quando for múltiplos meses)
    const monthlyData = new Map<string, { date: string; tooltipDate: string; monthKey: string; value: number; showLabel: boolean; showTick: boolean }>();
    
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
              value: 0,
              showLabel: true,
              showTick: true,
            });
          } else {
            monthlyData.set(key, {
              date: `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
              tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
              monthKey: key,
              value: 0,
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
            value: 0,
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

    // Buscar assinaturas do período
    const subscriptionsForChart = await prisma.subscription.findMany({
      where: {
        deletedAt: null,
        status: 'active',
        startDate: { gte: chartStart, lte: chartEnd },
      },
      include: { plan: { select: { price: true } } },
    });

    // Preencher dados com as assinaturas
    for (const sub of subscriptionsForChart) {
      const subDate = getBrazilDateParts(sub.startDate);
      if (isSingleMonthPeriod) {
        const key = `${subDate.year}-${String(subDate.month).padStart(2, '0')}-${String(subDate.day).padStart(2, '0')}`;
        const entry = dailyData.get(key);
        if (entry) {
          entry.value += sub.plan.price;
        }
      } else {
        const key = `${subDate.year}-${String(subDate.month).padStart(2, '0')}`;
        const entry = monthlyData.get(key);
        if (entry) {
          entry.value += sub.plan.price;
        }
      }
    }

    // Converter para array final
    const revenueOverTime: Array<{
      date: string;
      tooltipDate?: string;
      showLabel?: boolean;
      showTick?: boolean;
      value: number;
    }> = isSingleMonthPeriod
      ? Array.from(dailyData.values()).sort((a, b) => {
          const [dayA, monthA] = a.date.split('/').map(Number);
          const [dayB, monthB] = b.date.split('/').map(Number);
          if (monthA !== monthB) return monthA - monthB;
          return dayA - dayB;
        })
      : Array.from(monthlyData.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // MRR over time (monthly) - mostra desde o início do período até hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const mrrChartEnd = end > today ? today : end;
    const mrrOverTime: Array<{
      date: string;
      tooltipDate?: string;
      showLabel?: boolean;
      showTick?: boolean;
      value: number;
    }> = [];

    // Usar a mesma lógica de meses do revenueOverTime
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
      
      // Determinar intervalo de exibição
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
        const monthStart = startOfDayBrazil(currentYear, currentMonth, 1);
        const lastDay = getLastDayOfMonth(currentYear, currentMonth);
        const monthEnd = endOfDayBrazil(currentYear, currentMonth, lastDay);
        const monthEndActual = monthEnd > mrrChartEnd ? mrrChartEnd : monthEnd;
        const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
      
        // MRR no final deste mês (assinaturas ativas até o final do mês)
        const monthSubs = await prisma.subscription.findMany({
          where: {
            deletedAt: null,
            status: 'active',
            startDate: { lte: monthEndActual },
            OR: [
              { endDate: null },
              { endDate: { gte: monthStart } },
            ],
          },
          include: {
            plan: {
              select: {
                price: true,
                durationType: true,
                durationMonths: true,
              },
            },
          },
        });
        
        let monthMRR = 0;
        for (const sub of monthSubs) {
          const { price, durationType, durationMonths } = sub.plan;
          if (durationType === 'monthly') {
            monthMRR += price;
          } else if (durationType === 'quarterly') {
            monthMRR += price / 3;
          } else if (durationType === 'semiannual') {
            monthMRR += price / 6;
          } else if (durationType === 'annual') {
            monthMRR += price / 12;
          } else if (durationMonths) {
            monthMRR += price / durationMonths;
          }
        }
        
        let showLabel = false;
        let showTick = false;
        if (labelFormat === 'year') {
          showLabel = currentMonth === 1;
          showTick = showLabel;
        } else {
          showLabel = monthIndex % labelInterval === 0;
          showTick = showLabel;
        }
        
        mrrOverTime.push({
          date: labelFormat === 'year' && showLabel
            ? `${currentYear}`
            : `${MONTH_SHORT[currentMonth - 1]}, ${currentYear}`,
          tooltipDate: `${MONTH_FULL[currentMonth - 1]}, ${currentYear}`,
          showLabel,
          showTick,
          value: monthMRR,
        });
        
        monthIndex++;
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    }

    // Revenue by plan
    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        deletedAt: null,
        status: 'active',
        startDate: { gte: start, lte: end },
      },
      _count: {
        id: true,
      },
    });

    const revenueByPlanData = await Promise.all(
      subscriptionsByPlan.map(async (item) => {
        const plan = await prisma.plan.findUnique({
          where: { id: item.planId },
          select: { name: true, price: true },
        });
        const count = item._count.id;
        return {
          planName: plan?.name || 'Desconhecido',
          revenue: (plan?.price || 0) * count,
        };
      })
    );

    // LTV by plan - média de tempo que usuários ficam ativos por plano (em meses)
    const ltvByPlan = await Promise.all(
      subscriptionsByPlan.map(async (item) => {
        const planSubscriptions = await prisma.subscription.findMany({
          where: {
            deletedAt: null,
            planId: item.planId,
            status: { in: ['active', 'cancelled', 'expired'] },
          },
          select: {
            startDate: true,
            endDate: true,
            accountId: true,
          },
          orderBy: {
            startDate: 'asc',
          },
        });

        // Agrupar por accountId para calcular tempo total por usuário
        const accountDurations = new Map<string, number>();
        for (const sub of planSubscriptions) {
          const startDate = sub.startDate;
          const endDate = sub.endDate || new Date();
          const diffTime = endDate.getTime() - startDate.getTime();
          const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30);
          
          const current = accountDurations.get(sub.accountId) || 0;
          accountDurations.set(sub.accountId, current + diffMonths);
        }

        const durations = Array.from(accountDurations.values());
        const avgLtv = durations.length > 0 
          ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
          : 0;

        const plan = await prisma.plan.findUnique({
          where: { id: item.planId },
          select: { name: true },
        });

        return {
          planName: plan?.name || 'Desconhecido',
          ltv: avgLtv,
        };
      })
    );

    res.json({
      success: true,
      data: {
        totalRevenue,
        mrr,
        arpu,
        ltv,
        activeSubscriptions,
        cancelledSubscriptions,
        churnRate,
        revenueOverTime,
        mrrOverTime,
        revenueByPlan: revenueByPlanData,
        ltvByPlan,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Users report (admin). */
export async function getUsersReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

    const totalUsers = await prisma.user.count({
      where: { deletedAt: null },
    });

    const activeUsers = await prisma.user.count({
      where: {
        deletedAt: null,
        accounts: {
          some: {
            deletedAt: null,
            status: 'active',
          },
        },
      },
    });

    const inactiveUsers = totalUsers - activeUsers;

    const newUsers = await prisma.user.count({
      where: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
    });

    // New users over time (daily) - mostra desde o início do período até hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const chartEnd = end > today ? today : end;
    
    const newUsersOverTime: { date: string; value: number }[] = [];
    const current = new Date(start);
    while (current <= chartEnd) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);
      
      const count = await prisma.user.count({
        where: {
          deletedAt: null,
          createdAt: { gte: dayStart, lte: dayEnd },
        },
      });
      
      newUsersOverTime.push({
        date: current.toISOString().split('T')[0],
        value: count,
      });
      
      current.setDate(current.getDate() + 1);
    }

    // Users by plan
    const usersByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        deletedAt: null,
        status: 'active',
      },
      _count: {
        accountId: true,
      },
    });

    const usersByPlanData = await Promise.all(
      usersByPlan.map(async (item) => {
        const plan = await prisma.plan.findUnique({
          where: { id: item.planId },
          select: { name: true },
        });
        return {
          planName: plan?.name || 'Desconhecido',
          count: item._count.accountId,
        };
      })
    );

    // Users by status
    const usersByStatus = await prisma.account.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const usersByStatusData = usersByStatus.map((item) => ({
      status: item.status,
      count: item._count.id,
    }));

    // Top user by sales
    const topUserBySales = await prisma.sale.groupBy({
      by: ['accountId'],
      where: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 1,
    });

    let topUserBySalesData = null;
    if (topUserBySales.length > 0 && topUserBySales[0].accountId) {
      const account = await prisma.account.findUnique({
        where: { id: topUserBySales[0].accountId },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      if (account?.user) {
        topUserBySalesData = {
          userId: account.user.id,
          userName: account.user.name,
          userEmail: account.user.email,
          salesCount: topUserBySales[0]._count.id,
        };
      }
    }

    // Top user by vehicles
    const topUserByVehicles = await prisma.vehicle.groupBy({
      by: ['accountId'],
      where: {
        deletedAt: null,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 1,
    });

    let topUserByVehiclesData = null;
    if (topUserByVehicles.length > 0 && topUserByVehicles[0].accountId) {
      const account = await prisma.account.findUnique({
        where: { id: topUserByVehicles[0].accountId },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });
      if (account?.user) {
        topUserByVehiclesData = {
          userId: account.user.id,
          userName: account.user.name,
          userEmail: account.user.email,
          vehiclesCount: topUserByVehicles[0]._count.id,
        };
      }
    }

    // Oldest active user
    const oldestActiveUser = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        accounts: {
          some: {
            deletedAt: null,
            status: 'active',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    let oldestActiveUserData = null;
    if (oldestActiveUser) {
      const daysSinceCreation = Math.floor(
        (new Date().getTime() - new Date(oldestActiveUser.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      oldestActiveUserData = {
        userId: oldestActiveUser.id,
        userName: oldestActiveUser.name,
        userEmail: oldestActiveUser.email,
        daysActive: daysSinceCreation,
        createdAt: oldestActiveUser.createdAt.toISOString(),
      };
    }

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        newUsers,
        newUsersOverTime,
        usersByPlan: usersByPlanData,
        usersByStatus: usersByStatusData,
        topUserBySales: topUserBySalesData,
        topUserByVehicles: topUserByVehiclesData,
        oldestActiveUser: oldestActiveUserData,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Subscriptions report (admin). */
export async function getSubscriptionsReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

    const activeSubscriptions = await prisma.subscription.count({
      where: {
        deletedAt: null,
        status: 'active',
      },
    });

    const newSubscriptions = await prisma.subscription.count({
      where: {
        deletedAt: null,
        status: 'active',
        startDate: { gte: start, lte: end },
      },
    });

    const cancellations = await prisma.subscription.count({
      where: {
        deletedAt: null,
        status: 'cancelled',
        updatedAt: { gte: start, lte: end },
      },
    });

    // Active vs Cancelled over time - mostra desde o início do período até hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const chartEnd = end > today ? today : end;
    
    const subscriptionsOverTime: { date: string; active: number; cancelled: number }[] = [];
    const current = new Date(start);
    while (current <= chartEnd) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
      const monthEndActual = monthEnd > today ? today : monthEnd;
      
      const active = await prisma.subscription.count({
        where: {
          deletedAt: null,
          status: 'active',
          startDate: { lte: monthEndActual },
          OR: [
            { endDate: null },
            { endDate: { gte: monthStart } },
          ],
        },
      });
      
      const cancelled = await prisma.subscription.count({
        where: {
          deletedAt: null,
          status: 'cancelled',
          updatedAt: { gte: monthStart, lte: monthEndActual },
        },
      });
      
      subscriptionsOverTime.push({
        date: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-01`,
        active,
        cancelled,
      });
      
      current.setMonth(current.getMonth() + 1);
      if (current > chartEnd) break;
    }

    // Churn over time
    const churnOverTime = subscriptionsOverTime.map((item) => ({
      date: item.date,
      churnRate: item.active > 0 ? (item.cancelled / item.active) * 100 : 0,
    }));

    // Subscriptions by plan
    const subscriptionsByPlan = await prisma.subscription.groupBy({
      by: ['planId'],
      where: {
        deletedAt: null,
        status: 'active',
      },
      _count: {
        id: true,
      },
    });

    const subscriptionsByPlanData = await Promise.all(
      subscriptionsByPlan.map(async (item) => {
        const plan = await prisma.plan.findUnique({
          where: { id: item.planId },
          select: { name: true },
        });
        return {
          planName: plan?.name || 'Desconhecido',
          count: item._count.id,
        };
      })
    );

    res.json({
      success: true,
      data: {
        activeSubscriptions,
        newSubscriptions,
        cancellations,
        subscriptionsOverTime,
        churnOverTime,
        subscriptionsByPlan: subscriptionsByPlanData,
      },
    });
  } catch (e) {
    next(e);
  }
}

/** Platform usage report (admin). */
export async function getPlatformUsageReport(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { period, startDate, endDate } = req.query;
    const { start, end } = getDateRange(period as string, startDate as string, endDate as string);

    const vehiclesCreated = await prisma.vehicle.count({
      where: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
    });

    const salesCreated = await prisma.sale.count({
      where: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
    });

    const expensesCreated = await prisma.expense.count({
      where: {
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
    });

    const checklistsCompleted = await prisma.checklist.count({
      where: {
        deletedAt: null,
        status: 'completed',
        updatedAt: { gte: start, lte: end },
      },
    });

    // Daily activity by type - mostra desde o início do período até hoje
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const chartEnd = end > today ? today : end;
    
    const dailyActivity: { date: string; vehicles: number; sales: number; expenses: number; checklists: number }[] = [];
    const current = new Date(start);
    while (current <= chartEnd) {
      const dayStart = new Date(current);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(current);
      dayEnd.setHours(23, 59, 59, 999);
      
      const [vehicles, sales, expenses, checklists] = await Promise.all([
        prisma.vehicle.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.sale.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.expense.count({
          where: {
            deletedAt: null,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        }),
        prisma.checklist.count({
          where: {
            deletedAt: null,
            status: 'completed',
            updatedAt: { gte: dayStart, lte: dayEnd },
          },
        }),
      ]);
      
      dailyActivity.push({
        date: current.toISOString().split('T')[0],
        vehicles,
        sales,
        expenses,
        checklists,
      });
      
      current.setDate(current.getDate() + 1);
    }

    // Top active users - count activities per account
    const accountsWithActivity = await prisma.account.findMany({
      where: {
        deletedAt: null,
        OR: [
          {
            vehicles: {
              some: {
                deletedAt: null,
                createdAt: { gte: start, lte: end },
              },
            },
          },
          {
            sales: {
              some: {
                deletedAt: null,
                createdAt: { gte: start, lte: end },
              },
            },
          },
          {
            expenses: {
              some: {
                deletedAt: null,
                createdAt: { gte: start, lte: end },
              },
            },
          },
          {
            checklists: {
              some: {
                deletedAt: null,
                status: 'completed',
                updatedAt: { gte: start, lte: end },
              },
            },
          },
        ],
      },
      select: {
        userId: true,
        id: true,
      },
    });

    // Count activities per user
    const userActivityMap = new Map<string, number>();
    for (const account of accountsWithActivity) {
      const [vehicles, sales, expenses, checklists] = await Promise.all([
        prisma.vehicle.count({
          where: {
            deletedAt: null,
            accountId: account.id,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.sale.count({
          where: {
            deletedAt: null,
            accountId: account.id,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.expense.count({
          where: {
            deletedAt: null,
            accountId: account.id,
            createdAt: { gte: start, lte: end },
          },
        }),
        prisma.checklist.count({
          where: {
            deletedAt: null,
            accountId: account.id,
            status: 'completed',
            updatedAt: { gte: start, lte: end },
          },
        }),
      ]);
      
      const totalActivity = vehicles + sales + expenses + checklists;
      const current = userActivityMap.get(account.userId) || 0;
      userActivityMap.set(account.userId, current + totalActivity);
    }

    // Sort and get top 10
    const sortedUsers = Array.from(userActivityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const topActiveUsersData = await Promise.all(
      sortedUsers.map(async ([userId, activityCount]) => {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        return {
          userId,
          userName: user?.name || 'Desconhecido',
          userEmail: user?.email || '',
          activityCount,
        };
      })
    );

    res.json({
      success: true,
      data: {
        vehiclesCreated,
        salesCreated,
        expensesCreated,
        checklistsCompleted,
        dailyActivity,
        topActiveUsers: topActiveUsersData,
      },
    });
  } catch (e) {
    next(e);
  }
}
