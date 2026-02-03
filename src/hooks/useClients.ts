import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface ClientReferral {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  accountId: string;
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  observations?: string | null;
  referredByClientId?: string | null;
  referredBy?: ClientReferral | null;
  purchases?: number;
  totalSpent?: number;
  lastPurchase?: string | null;
  sales?: ClientSale[];
}

export interface ClientSale {
  id: string;
  salePrice: number;
  saleDate: string;
  paymentMethod: string;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate?: string;
  };
}

export interface ClientsStats {
  totalClients: number;
  recurringClients: number;
  newClients: number;
  topClient: {
    id: string;
    name: string;
    totalSpent: number;
  } | null;
}

export interface ClientsResponse {
  data: Client[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateClientData {
  name: string;
  email?: string;
  phone?: string;
  cpfCnpj?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  observations?: string;
  referredByClientId?: string | null;
}

export const useClients = (params?: {
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
    queryKey: ['clients', safeParams],
    queryFn: async (): Promise<ClientsResponse> => {
      const response = await apiClient.get<{ data: Client[]; pagination?: ClientsResponse['pagination'] }>(
        '/clients',
        safeParams
      );
      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination,
      };
    },
  });
};

export const useClient = (id: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async (): Promise<Client> => {
      const response = await apiClient.get<{ data: Client }>(`/clients/${id}`);
      if (response.data == null) throw new Error('Cliente não encontrado');
      return response.data;
    },
    enabled: options?.enabled !== undefined ? options.enabled : !!id,
  });
};

export const useCreateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateClientData) => {
      const response = await apiClient.post<{ data: Client }>('/clients', data);
      return response.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clientsStats'] });
    },
  });
};

export const useUpdateClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateClientData> & { id: string }) => {
      const response = await apiClient.put<{ data: Client }>(`/clients/${id}`, data);
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['client', variables.id] });
      await queryClient.invalidateQueries({ queryKey: ['clientsStats'] });
    },
  });
};

export const useDeleteClient = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/clients/${id}`);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['clientsStats'] });
    },
  });
};

export const useClientsStats = () => {
  return useQuery({
    queryKey: ['clientsStats'],
    queryFn: async (): Promise<ClientsStats> => {
      const response = await apiClient.get<{ data: ClientsStats }>('/clients/stats');
      return response.data;
    },
  });
};
