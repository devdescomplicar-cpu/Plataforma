import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface Collaborator {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'manager' | 'seller';
  status: 'active' | 'inactive';
  commissionType: 'fixed' | 'percent' | null;
  commissionValue: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollaboratorInput {
  name: string;
  email: string;
  password: string;
  role: 'manager' | 'seller';
  status?: 'active' | 'inactive';
  commissionType?: 'fixed' | 'percent';
  commissionValue?: number;
}

export interface UpdateCollaboratorInput {
  name?: string;
  email?: string;
  role?: 'manager' | 'seller';
  status?: 'active' | 'inactive';
  commissionType?: 'fixed' | 'percent';
  commissionValue?: number;
}

export function useCollaborators() {
  return useQuery({
    queryKey: ['collaborators'],
    queryFn: async (): Promise<Collaborator[]> => {
      const res = await apiClient.get<Collaborator[]>('/collaborators');
      if (!res.success || res.data == null) {
        // Se não for dono, retornar array vazio em vez de erro
        if (res.error?.message?.includes('Apenas o dono')) {
          return [];
        }
        throw new Error(res.error?.message ?? 'Erro ao listar colaboradores');
      }
      return res.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCollaboratorInput) => {
      const res = await apiClient.post<Collaborator>('/collaborators', input);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro ao criar colaborador');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useUpdateCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateCollaboratorInput }) => {
      const res = await apiClient.put<Collaborator>(`/collaborators/${id}`, input);
      if (!res.success || res.data == null) throw new Error(res.error?.message ?? 'Erro ao atualizar colaborador');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}

export function useRemoveCollaborator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete<{ id: string }>(`/collaborators/${id}`);
      if (!res.success) throw new Error(res.error?.message ?? 'Erro ao remover colaborador');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators'] });
    },
  });
}
