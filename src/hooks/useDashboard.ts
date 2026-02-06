import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface DashboardMetrics {
  vehiclesInStock: number;
  monthlySales: number;
  monthlyProfit: number;
  avgDaysInStock: number;
}

export interface DashboardVehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  plate?: string;
  purchasePrice: number;
  salePrice: number;
  profit: number;
  profitPercent: number;
  daysInStock: number;
  fuel: string;
  color: string;
  status: 'available' | 'reserved' | 'sold';
  image?: string;
}

const defaultMetrics: DashboardMetrics = {
  vehiclesInStock: 0,
  monthlySales: 0,
  monthlyProfit: 0,
  avgDaysInStock: 0,
};

export const useDashboardMetrics = (params?: { month?: number; year?: number }) => {
  return useQuery({
    queryKey: ['dashboard', 'metrics', params],
    queryFn: async (): Promise<DashboardMetrics> => {
      const response = await apiClient.get<{ data: DashboardMetrics }>('/dashboard/metrics', params as Record<string, string | number>);
      return response.data ?? defaultMetrics;
    },
  });
};

export interface DashboardData {
  chartType?: 'day' | 'month';
  chart?: Array<{
    date: string;
    tooltipDate?: string;
    monthKey?: string;
    revenue: number;
    sales: number;
    profit: number;
    showLabel?: boolean;
    showTick?: boolean;
  }>;
  cards: {
    revenue: {
      value: number;
      change: number;
    };
    vehiclesSold: {
      count: number;
      avgPerDay: number;
      change: number;
    };
    netProfit: {
      value: number;
      change: number;
    };
    avgTicket: {
      value: number;
    };
  };
  dailyChart: Array<{
    date: string;
    tooltipDate?: string;
    revenue: number;
    sales: number;
    profit: number;
  }>;
  monthlyChart: Array<{
    date: string;
    tooltipDate?: string;
    monthKey: string;
    revenue: number;
    sales: number;
    profit: number;
    showLabel?: boolean;
    showTick?: boolean;
  }>;
  insights: {
    bestDay: {
      day: string;
      revenue: number;
    } | null;
    topClient: {
      name: string;
      count: number;
    } | null;
    topVehicle: {
      name: string;
      count: number;
    } | null;
    recurrenceRate: number;
  };
  lastSales: Array<{
    id: string;
    date: string;
    client: string;
    vehicle: string;
    value: number;
  }>;
}

function toDateParam(d: Date | string | undefined): string | undefined {
  if (d == null) return undefined;
  if (typeof d === 'string') return d;
  return d.toISOString().split('T')[0];
}

export const useDashboardData = (period?: string, startDate?: string | Date, endDate?: string | Date) => {
  const params: Record<string, string> = {};
  if (period) params.period = period;
  if (startDate) params.startDate = toDateParam(startDate);
  if (endDate) params.endDate = toDateParam(endDate);

  return useQuery({
    queryKey: ['dashboard', 'data', period, toDateParam(startDate), toDateParam(endDate)],
    queryFn: async (): Promise<DashboardData> => {
      const response = await apiClient.get<{ data: DashboardData }>(
        '/dashboard/data',
        Object.keys(params).length > 0 ? params : undefined
      );
      return response.data ?? {
        cards: {
          revenue: { value: 0, change: 0 },
          vehiclesSold: { count: 0, avgPerDay: 0, change: 0 },
          netProfit: { value: 0, change: 0 },
          avgTicket: { value: 0 },
        },
        dailyChart: [],
        monthlyChart: [],
        insights: {
          bestDay: null,
          topClient: null,
          topVehicle: null,
          recurrenceRate: 0,
        },
        lastSales: [],
      };
    },
  });
};

export const useDashboardVehicles = (limit?: number) => {
  return useQuery({
    queryKey: ['dashboard', 'vehicles', limit],
    queryFn: async (): Promise<DashboardVehicle[]> => {
      const response = await apiClient.get<{ data: DashboardVehicle[] }>('/dashboard/vehicles', limit ? { limit } : undefined);
      return response.data ?? [];
    },
  });
};
