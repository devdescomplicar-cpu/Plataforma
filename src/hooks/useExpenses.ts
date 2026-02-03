import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Expense {
  id: string;
  accountId: string;
  vehicleId?: string;
  type: string;
  value: number;
  description?: string;
  date: string;
  status: 'pending' | 'paid';
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate?: string;
  };
}

export interface ExpensesResponse {
  data: Expense[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateExpenseData {
  vehicleId?: string;
  type: string;
  value: number;
  description?: string;
  date?: string;
  status?: 'pending' | 'paid';
}

export const useExpenses = (params?: {
  search?: string;
  status?: string;
  vehicleId?: string;
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
    queryKey: ['expenses', safeParams],
    queryFn: async (): Promise<ExpensesResponse> => {
      const response = await apiClient.get<{ data: Expense[]; pagination?: ExpensesResponse['pagination'] }>(
        '/expenses',
        safeParams
      );
      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination,
      };
    },
  });
};

export const useExpense = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: async (): Promise<Expense> => {
      const response = await apiClient.get<{ data: Expense }>(`/expenses/${id}`);
      if (response.data == null) throw new Error('Despesa não encontrada');
      return response.data;
    },
    enabled: options?.enabled !== false && !!id,
  });
};

export const useCreateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateExpenseData) => {
      const response = await apiClient.post<{ data: Expense }>('/expenses', data);
      return response.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['vehiclesWithExpenses'] });
      await queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
  });
};

export const useUpdateExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateExpenseData> & { id: string }) => {
      const response = await apiClient.put<{ data: Expense }>(`/expenses/${id}`, data);
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['expense', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useDeleteExpense = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/expenses/${id}`);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['vehiclesWithExpenses'] });
    },
  });
};

export interface VehicleWithExpenses {
  id: string;
  brand: string;
  model: string;
  version?: string;
  year: number;
  km?: number | null;
  plate?: string | null;
  color?: string | null;
  image?: string | null;
  expensesCount: number;
  expensesTotal: number;
}

export interface VehiclesWithExpensesResponse {
  vehicles: VehicleWithExpenses[];
  stats: {
    totalVehiclesWithExpenses: number;
    totalExpensesValue: number;
    averageExpensesPerVehicle: number;
    vehicleWithHighestExpense: {
      id: string;
      brand: string;
      model: string;
      version?: string;
      year: number;
      expensesTotal: number;
    } | null;
  };
}

export const useVehiclesWithExpenses = () => {
  return useQuery({
    queryKey: ['vehiclesWithExpenses'],
    queryFn: async (): Promise<VehiclesWithExpensesResponse> => {
      const response = await apiClient.get<{ data: VehiclesWithExpensesResponse }>('/expenses/vehicles');
      return response.data!;
    },
  });
};
