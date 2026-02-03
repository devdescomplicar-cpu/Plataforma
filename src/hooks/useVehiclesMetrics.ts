import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface VehiclesMetrics {
  totalVehicles: number;
  totalSold: number;
  totalInStock: number;
  totalInvested: number;
  avgDaysInStock: number;
  totalExpectedProfit: number;
}

export const useVehiclesMetrics = () => {
  return useQuery({
    queryKey: ['vehicles-metrics'],
    queryFn: async (): Promise<VehiclesMetrics> => {
      const response = await apiClient.get<{ data: VehiclesMetrics }>(
        '/vehicles/metrics'
      );
      return response.data!;
    },
  });
};
