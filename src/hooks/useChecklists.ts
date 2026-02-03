import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface ChecklistItem {
  id: string;
  checklistId: string;
  name: string;
  done: boolean;
}

export interface Checklist {
  id: string;
  accountId: string;
  vehicleId: string;
  status: 'pending' | 'in_progress' | 'completed';
  vehicle?: {
    id: string;
    brand: string;
    model: string;
    year: number;
    plate?: string;
  };
  items: ChecklistItem[];
}

export interface ChecklistsResponse {
  data: Checklist[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateChecklistData {
  vehicleId: string;
  items: Array<{
    name: string;
    done?: boolean;
  }>;
  status?: 'pending' | 'in_progress' | 'completed';
}

export const useChecklists = (params?: {
  vehicleId?: string;
  status?: string;
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
    queryKey: ['checklists', safeParams],
    queryFn: async (): Promise<ChecklistsResponse> => {
      const response = await apiClient.get<{ data: Checklist[]; pagination?: ChecklistsResponse['pagination'] }>(
        '/checklists',
        safeParams
      );
      return {
        data: Array.isArray(response.data) ? response.data : [],
        pagination: response.pagination,
      };
    },
  });
};

export const useChecklist = (id: string) => {
  return useQuery({
    queryKey: ['checklist', id],
    queryFn: async (): Promise<Checklist> => {
      const response = await apiClient.get<{ data: Checklist }>(`/checklists/${id}`);
      if (response.data == null) throw new Error('Checklist não encontrado');
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChecklistData) => {
      const response = await apiClient.post<{ data: Checklist }>('/checklists', data);
      return response.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
};

export const useUpdateChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateChecklistData> & { id: string }) => {
      const response = await apiClient.put<{ data: Checklist }>(`/checklists/${id}`, data);
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
      await queryClient.invalidateQueries({ queryKey: ['checklist', variables.id] });
    },
  });
};

export const useUpdateChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ checklistId, itemId, ...data }: { checklistId: string; itemId: string; done?: boolean; name?: string }) => {
      const response = await apiClient.put<{ data: ChecklistItem }>(`/checklists/${checklistId}/items/${itemId}`, data);
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
      await queryClient.invalidateQueries({ queryKey: ['checklist', variables.checklistId] });
    },
  });
};

export const useCreateChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ checklistId, name }: { checklistId: string; name: string }) => {
      const response = await apiClient.post<{ data: ChecklistItem }>(`/checklists/${checklistId}/items`, { name });
      return response.data!;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
      await queryClient.invalidateQueries({ queryKey: ['checklist', variables.checklistId] });
    },
  });
};

export const useDeleteChecklistItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ checklistId, itemId }: { checklistId: string; itemId: string }) => {
      const response = await apiClient.delete<{ message: string }>(`/checklists/${checklistId}/items/${itemId}`);
      return response;
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
      await queryClient.invalidateQueries({ queryKey: ['checklist', variables.checklistId] });
    },
  });
};

export const useDeleteChecklist = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete<{ message: string }>(`/checklists/${id}`);
      return response;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['checklists'] });
    },
  });
};
