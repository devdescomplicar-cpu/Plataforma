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
    revenue: number;
    sales: number;
    profit: number;
  }>;
  monthlyChart: Array<{
    date: string;
    monthKey: string;
    revenue: number;
    sales: number;
    profit: number;
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

export const useDashboardData = (period?: string, startDate?: Date, endDate?: Date) => {
  const params: Record<string, string> = {};
  if (period) params.period = period;
  if (startDate) params.startDate = startDate.toISOString();
  if (endDate) params.endDate = endDate.toISOString();

  return useQuery({
    queryKey: ['dashboard', 'data', period, startDate?.toISOString(), endDate?.toISOString()],
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
