import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Sale {
  id: string;
  vehicleId: string;
  clientId?: string;
  salePrice: number;
  profit: number;
  profitPercent: number;
  paymentMethod: string;
  saleDate: string;
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate?: string;
    image?: string | null;
  };
  client?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    cpfCnpj?: string;
    city?: string;
  };
}

export interface SalesResponse {
  data: Sale[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSaleData {
  vehicleId: string;
  clientId?: string;
  salePrice: number;
  paymentMethod: 'PIX' | 'DINHEIRO' | 'CARTÃO DE CRÉDITO' | 'FINANCIAMENTO' | 'TROCA';
  saleDate?: string;
  observations?: string;
}

export interface SalesStats {
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  vehiclesInStock: number;
}

export interface SalesByMonth {
  month: string;
  year: number;
  sales: number;
  revenue: number;
  profit: number;
}

export const useSales = (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const safeParams =
    params && Object.keys(params).length > 0
      ? (Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
        ) as Record<string, string | number>)
      : undefined;

  return useQuery({
    queryKey: ['sales', safeParams],
    queryFn: async (): Promise<SalesResponse> => {
      const response = await apiClient.get<{ data: Sale[]; pagination?: SalesResponse['pagination'] }>(
        '/sales',
        safeParams
      );
      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination,
      };
    },
  });
};

export const useSale = (id: string) => {
  return useQuery({
    queryKey: ['sale', id],
    queryFn: async (): Promise<Sale> => {
      const response = await apiClient.get<{ data: Sale }>(`/sales/${id}`);
      if (response.data == null) throw new Error('Venda não encontrada');
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSaleData) => {
      const response = await apiClient.post<{ data: Sale }>('/sales', data);
      return response.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['salesStats'] });
      await queryClient.invalidateQueries({ queryKey: ['salesByMonth'] });
    },
  });
};

export const useUpdateSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateSaleData> & { id: string }) => {
      const response = await apiClient.put<{ data: Sale }>(`/sales/${id}`, data);
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['sale', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['salesStats'] });
      await queryClient.invalidateQueries({ queryKey: ['salesByMonth'] });
    },
  });
};

export const useDeleteSale = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/sales/${id}`);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles-metrics'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['salesStats'] });
      await queryClient.invalidateQueries({ queryKey: ['salesByMonth'] });
    },
  });
};

export const useSalesStats = () => {
  return useQuery({
    queryKey: ['salesStats'],
    queryFn: async (): Promise<SalesStats> => {
      const response = await apiClient.get<{ data: SalesStats }>('/sales/stats');
      return response.data!;
    },
  });
};

export const useSalesByMonth = (months: number = 6) => {
  return useQuery({
    queryKey: ['salesByMonth', months],
    queryFn: async (): Promise<SalesByMonth[]> => {
      const response = await apiClient.get<{ data: SalesByMonth[] }>('/sales/by-month', { months });
      return response.data!;
    },
  });
};
